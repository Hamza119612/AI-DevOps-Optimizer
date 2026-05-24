import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import logger from './logger';
import llmService from './llm';

export interface HealingOperation {
  repoUrl: string; // e.g. "https://github.com/Hamza119612/AI-DevOps-Optimizer.git"
  branch: string; // e.g. "main"
  logs: string; // cleaned logs context
  githubToken: string;
  targetFile?: string; // explicit file path to patch, e.g. "app/src/index.ts" (optional)
  analysisRootCause: string;
  analysisSuggestedFix: string;
}

export interface PRResult {
  success: boolean;
  branchName: string;
  prUrl?: string;
  prNumber?: number;
  error?: string;
}

export class GitService {
  /**
   * Clones a repository once, reads the target file, generates an AI patch,
   * writes the patch, pushes, and opens a Draft Pull Request on GitHub.
   */
  async applySelfHealing(op: HealingOperation): Promise<PRResult> {
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const branchName = `devops-copilot/fix-${uniqueId}`;

    // Create temporary workspace inside the project workspace to satisfy sandbox constraints
    const tempDir = path.join(process.cwd(), 'scratch', `repo-${uniqueId}`);

    logger.info({
      message: `Starting automated Git self-healing operation`,
      repoUrl: op.repoUrl,
      branch: op.branch,
      tempDir,
      branchName,
    });

    try {
      // 1. Ensure scratch parent directory exists
      fs.mkdirSync(path.dirname(tempDir), { recursive: true });

      // 2. Format Git URL to authenticate using Personal Access Token
      let authenticatedUrl = op.repoUrl;
      if (op.repoUrl.startsWith('https://github.com/')) {
        authenticatedUrl = op.repoUrl.replace(
          'https://github.com/',
          `https://${op.githubToken}@github.com/`,
        );
      }

      // 3. Clone Repository (shallow clone for performance)
      logger.info(`Cloning repository into temporary directory...`);
      execSync(`git clone --depth 1 --branch ${op.branch} ${authenticatedUrl} "${tempDir}"`, {
        stdio: 'ignore',
      });

      // 4. Configure local Git user for clean attribution
      execSync(`git config user.name "AI DevOps Co-Pilot"`, { cwd: tempDir });
      execSync(`git config user.email "ai-devops-copilot@users.noreply.github.com"`, {
        cwd: tempDir,
      });

      // 5. Checkout a new branch
      execSync(`git checkout -b ${branchName}`, { cwd: tempDir });

      // 6. Determine target file path
      const relativeFilePath = op.targetFile;
      if (!relativeFilePath) {
        throw new Error('Target file to patch could not be resolved from pipeline logs or inputs');
      }

      const fullFilePath = path.join(tempDir, relativeFilePath);
      if (!fs.existsSync(fullFilePath)) {
        throw new Error(`Target file does not exist in repository: ${relativeFilePath}`);
      }

      // 7. Read the original source code
      logger.info(`Reading original code from: ${relativeFilePath}`);
      const originalCode = fs.readFileSync(fullFilePath, 'utf8');

      // 8. Generate patched code via LLM
      logger.info(`Invoking LLM to generate code patch...`);
      const errorAnalysis = `Root Cause: ${op.analysisRootCause}\nSuggested Fix: ${op.analysisSuggestedFix}`;
      const patchedContent = await llmService.generatePatchedCode(
        originalCode,
        op.logs,
        errorAnalysis,
      );

      // 9. Write the patched file content
      logger.info(`Applying generated patch back to file...`);
      fs.writeFileSync(fullFilePath, patchedContent, 'utf8');

      // 10. Commit changes
      execSync(`git add "${relativeFilePath}"`, { cwd: tempDir });

      // Check if there are actual diffs to commit
      const status = execSync('git status --porcelain', { cwd: tempDir }).toString().trim();
      if (!status) {
        logger.warn('No modifications detected during patch application — skipping commit');
        return {
          success: false,
          branchName,
          error: 'No files were modified by the patch operation',
        };
      }

      logger.info(`Committing SRE patch...`);
      const commitMessage = `🤖 SRE-Patch: Fixed pipeline crash in ${relativeFilePath}`;
      execSync(`git commit -m "${commitMessage}"`, { cwd: tempDir });

      // 11. Push changes to GitHub
      logger.info(`Pushing branch ${branchName} to origin...`);
      execSync(`git push origin ${branchName}`, { cwd: tempDir, stdio: 'ignore' });

      // 12. Parse Owner & Repo name from URL
      const repoPathMatch = op.repoUrl.replace('.git', '').match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!repoPathMatch) {
        throw new Error(`Failed to parse owner and repo name from URL: ${op.repoUrl}`);
      }
      const [, owner, repo] = repoPathMatch;

      // 13. Open Draft PR via Octokit Client
      logger.info(`Opening Draft Pull Request on GitHub for ${owner}/${repo}...`);
      const octokit = new Octokit({ auth: op.githubToken });

      const prTitle = `🤖 SRE: Auto-Triage & Draft Patch for ${relativeFilePath}`;

      const prBody = `### 🤖 AI SRE Co-Pilot: Automated Failure Diagnostic & Draft Patch

This is an automated SRE Draft Pull Request opened to fix a pipeline build failure. 

#### 🔍 Root Cause Analysis:
* **Failing File:** \`${relativeFilePath}\`
* **Root Cause:** ${op.analysisRootCause}

#### 🩹 Suggested Resolution applied:
* ${op.analysisSuggestedFix}

---
*Generated with 🔧 by **AI DevOps Optimizer**.*
`;

      const prResponse = await octokit.rest.pulls.create({
        owner,
        repo,
        title: prTitle,
        head: branchName,
        base: op.branch,
        body: prBody,
        draft: true, // Crucial: Open as a Draft PR for SRE oversight!
      });

      logger.info({
        message: `Successfully opened Draft PR #${prResponse.data.number}`,
        prUrl: prResponse.data.html_url,
        prNumber: prResponse.data.number,
      });

      return {
        success: true,
        branchName,
        prUrl: prResponse.data.html_url,
        prNumber: prResponse.data.number,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown git error';
      logger.error({
        message: `Automated patch and Draft-PR self-healing failed`,
        error: errorMsg,
      });
      return {
        success: false,
        branchName,
        error: errorMsg,
      };
    } finally {
      // 14. Cleanup temporary filesystem clone
      try {
        if (fs.existsSync(tempDir)) {
          logger.info(`Cleaning up temporary clone directory: ${tempDir}`);
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupErr) {
        logger.error(`Failed to cleanup temp clone directory: ${cleanupErr}`);
      }
    }
  }
}

export default new GitService();
