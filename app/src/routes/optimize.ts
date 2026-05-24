import { Router, Request, Response } from 'express';
import llmService from '../services/llm';
import { optimizeSchema, formatZodError } from '../schemas';

const router = Router();

/**
 * POST /api/optimize
 *
 * Send a pipeline config → get back ranked optimization suggestions.
 *
 * Request body (validated by Zod):
 *   - config (required): the config file content (1–50k chars)
 *   - configType (optional): type of config, defaults to "other"
 *     Valid types: dockerfile, github-actions, gitlab-ci, kubernetes,
 *                  helm, terraform, docker-compose, jenkinsfile, other
 *
 * Response:
 *   - summary, suggestions[] with category/title/description/impact/effort/before/after
 */
router.post('/optimize', async (req: Request, res: Response) => {
  // --- Zod validation ---
  const parsed = optimizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { config, configType } = parsed.data;

  try {
    const result = await llmService.optimizeConfig(config, configType);

    res.json({
      success: true,
      configType,
      result,
    });
  } catch (err) {
    console.error('LLM optimization error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize configuration',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
