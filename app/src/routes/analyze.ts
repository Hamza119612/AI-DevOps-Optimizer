import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/analyze
 * Accepts raw CI/CD pipeline logs and returns a structured failure analysis
 * powered by an LLM.
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const { logs, pipelineId } = req.body;

  if (!logs) {
    res.status(400).json({ error: 'Missing required field: logs' });
    return;
  }

  // TODO: Phase 3 — integrate LLM service for log analysis
  res.status(501).json({
    message: 'Pipeline analysis not yet implemented',
    pipelineId: pipelineId || null,
    hint: 'LLM integration coming in Phase 3',
  });
});

export default router;
