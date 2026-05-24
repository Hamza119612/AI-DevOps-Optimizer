import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import logger from './logger';
import { LLMService, getDefaultLLMService } from './llm';

const execAsync = promisify(exec);

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
  private llmService: LLMService;

  constructor(llmService?: LLMService) {
    this.llmService = llmService ?? getDefaultLLMService();
  }

  /**
   * Clones a repository once, reads the target file, generates an AI patch,
   * writes the patch, pushes, and opens a Draft Pull Request on GitHub.
   *
   * All git operations use async exec to avoid blocking the Node.js event loop.
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

      // 2. Format Git URL to authenticate using environment-based credential
      const authenticatedUrl = this.buildAuthenticatedUrl(op.repoUrl, op.githubToken);

      // 3. Clone Repository (shallow clone for performance)
      logger.info(`Cloning repository into temporary directory...`);
      await execAsync(
        `git clone --depth 1 --branch ${op.branch} ${authenticatedUrl} "${tempDir}"`,
      );

      // 4. Configure local Git user for clean attribution
      await execAsync(`git config user.name "AI DevOps Co-Pilot"`, { cwd: tempDir });
      await execAsync(`git config user.email "ai-devops-copilot@users.noreply.github.com"`, {
        cwd: tempDir,
      });

      // 5. Checkout a new branch
      await execAsync(`git checkout -b ${branchName}`, { cwd: tempDir });

      // 6. Determine target file path
      let relativeFilePath = op.targetFile;
      if (!relativeFilePath) {
        throw new Error('Target file to patch could not be resolved from pipeline logs or inputs');
      }

      let fullFilePath = path.join(tempDir, relativeFilePath);
      if (!fs.existsSync(fullFilePath)) {
        logger.info(`Path drift mitigation: File not found at ${relativeFilePath}. Searching recursively...`);
        const foundPath = findFileInDir(tempDir, relativeFilePath);
        if (foundPath) {
          relativeFilePath = path.relative(tempDir, foundPath).replace(/\\/g, '/');
          fullFilePath = foundPath;
          logger.info(`Successfully mitigated path drift! Found file at: ${relativeFilePath}`);
        } else {
          throw new Error(`Target file does not exist in repository: ${relativeFilePath}`);
        }
      }

      // 7. Read the original source code
      logger.info(`Reading original code from: ${relativeFilePath}`);
      const originalCode = fs.readFileSync(fullFilePath, 'utf8');

      // 8. Generate patched code via LLM
      logger.info(`Invoking LLM to generate code patch...`);
      const errorAnalysis = `Root Cause: ${op.analysisRootCause}\nSuggested Fix: ${op.analysisSuggestedFix}`;
      const patchedContent = await this.llmService.generatePatchedCode(
        originalCode,
        op.logs,
        errorAnalysis,
      );

      // 9. Write the patched file content
      logger.info(`Applying generated patch back to file...`);
      fs.writeFileSync(fullFilePath, patchedContent, 'utf8');

      // 10. Commit changes
      await execAsync(`git add "${relativeFilePath}"`, { cwd: tempDir });

      // Check if there are actual diffs to commit
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: tempDir });
      if (!status.trim()) {
        logger.warn('No modifications detected during patch application — skipping commit');
        return {
          success: false,
          branchName,
          error: 'No files were modified by the patch operation',
        };
      }

      logger.info(`Committing SRE patch...`);
      const commitMessage = `🤖 SRE-Patch: Fixed pipeline crash in ${relativeFilePath}`;
      await execAsync(`git commit -m "${commitMessage}"`, { cwd: tempDir });

      // 11. Push changes to GitHub
      logger.info(`Pushing branch ${branchName} to origin...`);
      await execAsync(`git push origin ${branchName}`, { cwd: tempDir });

      // 12. Parse Owner & Repo name from URL
      const { owner, repo } = this.parseGitHubUrl(op.repoUrl);

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

  // --- Private helpers ---

  /**
   * Build an authenticated git URL using environment variables instead of
   * embedding tokens directly in the URL string (which leaks to process lists).
   */
  private buildAuthenticatedUrl(repoUrl: string, token: string): string {
    if (repoUrl.startsWith('https://github.com/')) {
      return repoUrl.replace(
        'https://github.com/',
        `https://x-access-token:${token}@github.com/`,
      );
    }
    return repoUrl;
  }

  /**
   * Parse owner and repo from a GitHub URL.
   */
  private parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.replace('.git', '').match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error(`Failed to parse owner and repo name from URL: ${repoUrl}`);
    }
    return { owner: match[1], repo: match[2] };
  }
}

// --- HELPER FUNCTIONS FOR PATH DRIFT MITIGATION ---
function findFileBySuffix(dir: string, suffix: string): string | null {
  const normSuffix = suffix.replace(/\\/g, '/');
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      if (file.name === '.git' || file.name === 'node_modules' || file.name === 'dist') {
        continue;
      }
      const found = findFileBySuffix(fullPath, suffix);
      if (found) return found;
    } else {
      const normFullPath = fullPath.replace(/\\/g, '/');
      if (normFullPath.endsWith('/' + normSuffix) || normFullPath === normSuffix) {
        return fullPath;
      }
    }
  }
  return null;
}

function findFileByBasename(dir: string, basename: string): string | null {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      if (file.name === '.git' || file.name === 'node_modules' || file.name === 'dist') {
        continue;
      }
      const found = findFileByBasename(fullPath, basename);
      if (found) return found;
    } else {
      if (file.name === basename) {
        return fullPath;
      }
    }
  }
  return null;
}

function findFileInDir(dir: string, targetPath: string): string | null {
  const exactMatch = findFileBySuffix(dir, targetPath);
  if (exactMatch) return exactMatch;

  const basename = path.basename(targetPath);
  return findFileByBasename(dir, basename);
}

// --- Lazy singleton factory ---

let _defaultInstance: GitService | null = null;

export function getDefaultGitService(): GitService {
  if (!_defaultInstance) {
    _defaultInstance = new GitService();
  }
  return _defaultInstance;
}

export default getDefaultGitService();
