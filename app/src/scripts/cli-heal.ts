#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import dotenv from 'dotenv';
import pipelineService from '../services/pipeline';
import llmService from '../services/llm';

// Load local environment variables (if any)
dotenv.config();

// Ensure the local scratch directory exists
const scratchDir = path.join(process.cwd(), 'scratch');
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

// --- DATA SECURITY: PII & SECRET SCRUBBER ---
function scrubSecrets(text: string): string {
  return text
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GH_TOKEN]')
    .replace(/nvapi-[a-zA-Z0-9-]{70,}/gi, '[REDACTED_NVIDIA_KEY]')
    .replace(/(mongodb(?:\+srv)?:\/\/[^\s]+)/gi, '[REDACTED_MONGO_URL]')
    .replace(/mysql:\/\/([^:]+):([^@]+)@/gi, 'mysql://$1:[REDACTED_PASS]@')
    .replace(/postgresql:\/\/([^:]+):([^@]+)@/gi, 'postgresql://$1:[REDACTED_PASS]@')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

// --- Parse CLI Arguments ---
function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function runCLI() {
  console.log('🤖 AI DevOps Co-Pilot: Local CLI Runner Mode');
  console.log('============================================');

  // --- 1. Validate logs file path argument ---
  const logsPath = getArg('--logs');
  if (!logsPath) {
    console.error('❌ Error: Missing required argument: --logs <path_to_log_file>');
    process.exit(1);
  }

  if (!fs.existsSync(logsPath)) {
    console.error(`❌ Error: Log file does not exist at: ${logsPath}`);
    process.exit(1);
  }

  // --- 2. Infinite Loop Circuit Breaker ---
  let activeBranch = 'main';
  try {
    activeBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    console.log(`🌿 Active workspace Git branch: ${activeBranch}`);

    if (activeBranch.startsWith('devops-copilot/')) {
      console.log(
        '⚠️  [Circuit Breaker] The pipeline failure occurred on an active SRE fix branch.',
      );
      console.log('🛑 Aborting to prevent infinite recursion patch loop.');
      process.exit(0); // Exit cleanly
    }
  } catch (err) {
    console.warn('⚠️  Warning: Unable to resolve active branch using Git command line');
  }

  // --- 3. Extract Git repository remote URL ---
  let repoUrl = '';
  try {
    repoUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    console.log(`🔗 Remote Repository Origin: ${repoUrl}`);
  } catch (err) {
    console.error(
      '❌ Error: Local directory is not a Git repository or has no remote origin configured.',
    );
    process.exit(1);
  }

  // --- 4. Resolve credentials ---
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error('❌ Error: GITHUB_TOKEN environment variable is not defined.');
    process.exit(1);
  }

  // --- 5. Pre-Process & Scrub Raw Logs ---
  console.log(`📖 Ingesting raw logs from: ${logsPath}`);
  const rawLogs = fs.readFileSync(logsPath, 'utf8');
  console.log('🧼 Scrubbing PII, database strings, and API secrets from logs...');
  const cleanRawLogs = scrubSecrets(rawLogs);

  const parsed = pipelineService.parseLogs(cleanRawLogs, 'cli-run');
  console.log(
    `📦 Noise reduction complete: extracted ${parsed.extractedLines} lines from ${parsed.totalLines} total.`,
  );

  // --- 6. Trigger SRE Log analysis ---
  console.log('📡 Analysing error diagnostics via AI SRE...');
  const analysis = await llmService.analyzeLogs(parsed.errorContext);

  if (!analysis.errors || analysis.errors.length === 0) {
    console.log('🟢 No concrete failure errors isolated in logs. Codebase appears stable.');
    process.exit(0);
  }

  const firstError = analysis.errors[0];
  const relativeFilePath = firstError.file;

  if (!relativeFilePath) {
    console.error(
      '❌ Error: SRE Engine failed to pinpoint a target code file path from failure logs.',
    );
    process.exit(1);
  }

  const fullFilePath = path.join(process.cwd(), relativeFilePath);
  if (!fs.existsSync(fullFilePath)) {
    console.error(
      `❌ Error: Pinpointed file does not exist in local workspace: ${relativeFilePath}`,
    );
    process.exit(1);
  }

  // --- 7. Safe patching with Local Compilation Guard ---
  console.log(`🩹 Isolated target file to heal: ${relativeFilePath}`);
  console.log(`📋 SRE Diagnosis: ${firstError.rootCause}`);

  const originalCode = fs.readFileSync(fullFilePath, 'utf8');
  let currentCode = originalCode;
  let errorContextInput = parsed.errorContext;
  let compiledSuccessfully = false;
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    console.log(`🧠 AI Generating code patch (Attempt ${attempt}/${maxRetries + 1})...`);

    if (attempt > 1) {
      console.log('🔄 Self-Correction: Feeding previous compilation failure logs back to SRE...');
    }

    const errorAnalysis = `Root Cause: ${firstError.rootCause}\nSuggested Fix: ${firstError.suggestedFix}`;
    const patchedContent = await llmService.generatePatchedCode(
      currentCode,
      errorContextInput,
      errorAnalysis,
    );

    // Apply patch locally for compilation validation
    fs.writeFileSync(fullFilePath, patchedContent, 'utf8');

    // Run local compiler validation check
    try {
      console.log('⚙️  Running Local Compilation Guard (npm run build)...');
      execSync('npm run build', { stdio: 'pipe' });
      compiledSuccessfully = true;
      console.log('🟢 SUCCESS! Code compiled successfully inside Local Compilation Guard.');
      break; // Break loop on successful build!
    } catch (buildErr: any) {
      console.warn(`⚠️  Compilation Guard failed on attempt ${attempt}.`);

      const buildStderr = buildErr.stderr ? buildErr.stderr.toString() : '';
      const buildStdout = buildErr.stdout ? buildErr.stdout.toString() : '';
      const buildLogs = (buildStderr + '\n' + buildStdout).substring(0, 1000);

      if (attempt <= maxRetries) {
        // Feed the new build crash back into the next iteration
        currentCode = patchedContent;
        errorContextInput = `[NEW COMPILER OUTRAGE ON PREVIOUS FIX]:\n${buildLogs}`;
      } else {
        // Max retries reached. Roll back filesystem changes.
        console.error(
          '❌ Compilation Guard: Max self-correction retries reached. Restoring original code.',
        );
        fs.writeFileSync(fullFilePath, originalCode, 'utf8');
      }
    }
  }

  if (!compiledSuccessfully) {
    console.error('🛑 Self-Healing aborted: AI generated fixes failed local compiler validation.');
    process.exit(1);
  }

  // --- 8. Local Git operations ---
  const uniqueId = Math.random().toString(36).substring(2, 9);
  const fixBranchName = `devops-copilot/fix-${uniqueId}`;

  try {
    console.log(`🌿 Creating local branch: ${fixBranchName}`);
    execSync(`git checkout -b ${fixBranchName}`);

    console.log('💾 Committing verified SRE patch...');
    execSync(`git add "${relativeFilePath}"`);
    execSync(`git commit -m "🤖 SRE-Patch: Fixed pipeline crash in ${relativeFilePath}"`);

    // Authenticate git remote for push using GITHUB_TOKEN
    let pushUrl = repoUrl;
    if (repoUrl.startsWith('https://github.com/')) {
      pushUrl = repoUrl.replace('https://github.com/', `https://${githubToken}@github.com/`);
    }

    console.log(`📤 Pushing branch ${fixBranchName} to origin...`);
    execSync(`git push ${pushUrl} ${fixBranchName}`, { stdio: 'ignore' });

    // --- 9. Create Draft Pull Request via Octokit ---
    const repoPathMatch = repoUrl.replace('.git', '').match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!repoPathMatch) {
      throw new Error(`Failed to parse owner and repo name from URL: ${repoUrl}`);
    }
    const [, owner, repo] = repoPathMatch;

    console.log(`📡 Creating Draft Pull Request on GitHub for ${owner}/${repo}...`);
    const octokit = new Octokit({ auth: githubToken });

    const prTitle = `🤖 SRE: Auto-Triage & Draft Patch for ${relativeFilePath}`;
    const prBody = `### 🤖 AI SRE Co-Pilot: Standalone Triage & Draft Patch

This is an automated Draft Pull Request opened to fix a pipeline build failure.

#### Resilience Check:
* **🛡️ Compiler Guard:** \`PASSED\` (Successfully compiled locally inside the CI runner before pushing!)
* **🧼 Secret Scrubber:** \`ACTIVE\` (All logs scrubbed of PII and database secrets)

#### 🔍 Root Cause Analysis:
* **Failing File:** \`${relativeFilePath}\`
* **Root Cause:** ${firstError.rootCause}

#### 🩹 Suggested Resolution applied:
* ${firstError.suggestedFix}

---
*Generated with 🔧 by **AI DevOps Optimizer** SRE CLI.*
`;

    const prResponse = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      head: fixBranchName,
      base: activeBranch,
      body: prBody,
      draft: true,
    });

    console.log('\n🟢 SUCCESS! AI SRE Triaged and Patched your code!');
    console.log(`🔗 Draft Pull Request URL: ${prResponse.data.html_url}`);
    console.log(`🌿 Branch Name: ${fixBranchName}`);

    // Switch back to original base branch to leave workspace clean
    execSync(`git checkout ${activeBranch}`);
  } catch (err: any) {
    console.error(`❌ Automated push and Draft PR failed: ${err.message}`);
    process.exit(1);
  }
}

runCLI();
