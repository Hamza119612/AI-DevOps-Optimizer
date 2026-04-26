import { Router, Request, Response } from 'express';
import llmService from '../services/llm';
import pipelineService from '../services/pipeline';

const router = Router();

/**
 * POST /api/analyze
 *
 * Send raw CI/CD pipeline logs → get back a structured failure analysis.
 *
 * The pipeline service pre-processes the logs first:
 *   1. Detects the CI provider (GitHub Actions, GitLab CI, Jenkins)
 *   2. Strips noise (timestamps, progress bars, download output)
 *   3. Extracts error-relevant lines + surrounding context
 *   4. Passes the trimmed context to the LLM (saves tokens & improves accuracy)
 *
 * Request body:
 *   - logs (required):      the raw pipeline log text
 *   - pipelineId (optional): identifier for the pipeline run
 *   - skipPreprocess (optional): bypass the pre-processor and send raw logs (for debugging)
 *
 * Response:
 *   - rootCause, file, line, suggestedFix, confidence, severity
 *   - meta: provider, totalLines, extractedLines
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const { logs, pipelineId, skipPreprocess } = req.body;

  if (!logs || typeof logs !== 'string') {
    res.status(400).json({ error: 'Missing required field: logs (string)' });
    return;
  }

  if (logs.length > 100000) {
    res.status(413).json({ error: 'Logs too large — max 100,000 characters' });
    return;
  }

  try {
    // --- Step 1: Pre-process logs to extract relevant context ---
    const parsed = pipelineService.parseLogs(logs, pipelineId || 'unknown');

    // Use the trimmed error context for the LLM unless the caller explicitly opts out
    const logsForLLM = skipPreprocess ? logs : parsed.errorContext;

    // --- Step 2: Send to LLM ---
    const analysis = await llmService.analyzeLogs(logsForLLM);

    res.json({
      success: true,
      pipelineId: pipelineId || null,
      analysis,
      meta: {
        provider: parsed.provider,
        failedStep: parsed.failedStep || null,
        totalLines: parsed.totalLines,
        extractedLines: parsed.extractedLines,
        preprocessed: !skipPreprocess,
      },
    });
  } catch (err) {
    console.error('LLM analysis error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze pipeline logs',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
