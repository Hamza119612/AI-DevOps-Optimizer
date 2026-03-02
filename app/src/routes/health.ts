import { Router } from 'express';

const router = Router();

/**
 * Liveness probe — indicates the service is running.
 */
router.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Readiness probe — indicates the service is ready to accept traffic.
 * Extend this with dependency checks (DB, LLM API, etc.)
 */
router.get('/readyz', (_req, res) => {
  // TODO: Add dependency health checks (database, LLM endpoint)
  res.status(200).json({ status: 'ready' });
});

export default router;
