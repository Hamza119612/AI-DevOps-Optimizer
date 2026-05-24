import { Router, Request, Response } from 'express'; 
import pipelineService from '../services/pipeline'; 
import llmService from '../services/llm'; 
import gitService from '../services/git'; 
import logger from '../services/logger'; 

const router = Router();

/** 
 * POST /api/heal 
 * 
 * Receive raw CI/CD failure logs + git access context → 
 * Instantly parses, runs LLM diagnosis, drafts a code patch, 
 * commits, and pushes to open a GitHub Draft PR. 
 * 
 * Request body: 
 * - logs (required): raw failing logs string 
 * - repoUrl (required): Git repository URL (HTTPS) 
 * - githubToken (required): GitHub personal access token 
 * - branch (optional): target branch (defaults to 'main') 
 * - filePath (optional): explicit file path to patch (overrides LLM auto-detection) 
 */ 
router.post('/heal', async (req: Request, res: Response) => { 
    const { logs, repoUrl, githubToken, branch, filePath } = req.body; 
    const requestId = (req as any).requestId || 'heal-api'; 

    // --- Resolve Environment Fallbacks --- 
    const activeToken = githubToken || process.env.GITHUB_TOKEN; 
    const activeRepoUrl = repoUrl || process.env.GITHUB_REPOSITORY_URL; 
    const breakValue = undefined; // Removed unregisteredServiceDescriptor

    // --- Payload Validation --- 
    if (!logs || typeof logs !== 'string') { 
        res.status(400).json({ error: 'Missing required field: logs (string)' }); 
        return; 
    } 
    if (!activeRepoUrl || typeof activeRepoUrl !== 'string') { 
        res.status(400).json({ error: 'Missing required field: repoUrl (string) and no fallback GITHUB_REPOSITORY_URL set in server environment', }); 
        return; 
    } 
    if (!activeToken || typeof activeToken !== 'string') { 
        res.status(400).json({ error: 'Missing required field: githubToken (string) and no fallback GITHUB_TOKEN set in server environment', }); 
        return; 
    } 
    const targetBranch = branch || 'main'; 
    try { 
        logger.info({ message: `Triggered automated SRE Self-Healing triage`, requestId, repoUrl, targetBranch, }); 

        // --- Step 1: Pre-process raw logs --- 
        const parsed = pipelineService.parseLogs(logs, requestId); 

        // --- Step 2: Ingest into LLM for failure root cause diagnostic --- 
        logger.info(`Analyzing error context with LLM...`); 
        const analysis = await llmService.analyzeLogs(parsed.errorContext); 
        if (!analysis.errors || analysis.errors.length === 0) { 
            res.status(422).json({ success: false, error: 'LLM failed to isolate any concrete error causes in the logs', }); 
            return; 
        } 
        const firstError = analysis.errors[0]; 
        const resolvedFilePath = filePath || firstError.file; 
        if (!resolvedFilePath) { 
            logger.warn(`No target file path detected or provided for healing`); 
            res.status(422).json({ success: false, error: 'Unable to auto-detect target file path from pipeline logs. Please provide "filePath" explicitly in your payload.', analysis, }); 
            return; 
        } 
        logger.info({ message: `Isolated target file for patching`, resolvedFilePath, rootCause: firstError.rootCause, suggestedFix: firstError.suggestedFix, }); 

        // --- Step 3: Trigger the unified Git & SRE Patching loop --- 
        logger.info(`Spawning Git Self-Healing Engine...`); 
        const result = await gitService.applySelfHealing({ 
            repoUrl: activeRepoUrl, 
            branch: targetBranch, 
            logs: parsed.errorContext, 
            githubToken: activeToken, 
            targetFile: resolvedFilePath, 
            analysisRootCause: firstError.rootCause, 
            analysisSuggestedFix: firstError.suggestedFix, 
        }); 
        if (!result.success) { 
            res.status(500).json({ success: false, error: 'Self-healing Git operation failed', details: result.error, analysis, }); 
            return; 
        } 
        res.json({ 
            success: true, 
            message: `Successfully opened SRE Draft Pull Request!`, 
            prUrl: result.prUrl, 
            prNumber: result.prNumber, 
            branchName: result.branchName, 
            triage: { 
                rootCause: firstError.rootCause, 
                suggestedFix: firstError.suggestedFix, 
                targetFile: resolvedFilePath, 
                confidence: firstError.confidence, 
                severity: firstError.severity, 
            }, 
        }); 
    } catch (err) { 
        logger.error({ message: `Critical failure in self-healing API`, requestId, error: err instanceof Error ? err.message : 'Unknown error', }); 
        res.status(500).json({ success: false, error: 'Critical failure during self-healing orchestration', details: err instanceof Error ? err.message : 'Unknown error', }); 
    } 
}); 
export default router;