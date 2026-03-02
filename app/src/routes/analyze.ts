import { Router, Request, Response } from 'express';
import llmService from '../services/llm';

const router = Router();

/**
 * POST /api/analyze
 *
 * Send raw CI/CD pipeline logs → get back a structured failure analysis.
 *
 * Request body:
 *   - logs (required): the raw pipeline log text
 *   - pipelineId (optional): identifier for the pipeline run
 *
 * Response:
 *   - rootCause, file, line, suggestedFix, confidence, severity
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const { logs, pipelineId } = req.body;

  if (!logs || typeof logs !== 'string') {
    res.status(400).json({ error: 'Missing required field: logs (string)' });
    return;
  }

  if (logs.length > 100000) {
    res
      .status(413)
      .json({ error: 'Logs too large — max 100,000 characters' });
    return;
  }

  try {
    const analysis = await llmService.analyzeLogs(logs);

    res.json({
      success: true,
      pipelineId: pipelineId || null,
      analysis,
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
