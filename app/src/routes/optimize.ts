import { Router, Request, Response } from 'express';
import llmService from '../services/llm';

const router = Router();

// Allowed config types (tells the LLM what kind of file it's reviewing)
const VALID_CONFIG_TYPES = [
  'dockerfile',
  'github-actions',
  'gitlab-ci',
  'kubernetes',
  'helm',
  'terraform',
  'docker-compose',
  'jenkinsfile',
  'other',
];

/**
 * POST /api/optimize
 *
 * Send a pipeline config → get back ranked optimization suggestions.
 *
 * Request body:
 *   - config (required): the config file content (YAML, Dockerfile, etc.)
 *   - configType (optional): type of config (defaults to "other")
 *
 * Response:
 *   - summary, suggestions[] with category/title/description/impact/effort/before/after
 */
router.post('/optimize', async (req: Request, res: Response) => {
  const { config, configType } = req.body;

  if (!config || typeof config !== 'string') {
    res.status(400).json({ error: 'Missing required field: config (string)' });
    return;
  }

  if (config.length > 50000) {
    res
      .status(413)
      .json({ error: 'Config too large — max 50,000 characters' });
    return;
  }

  // Default to "other" if not specified or invalid
  const resolvedType = VALID_CONFIG_TYPES.includes(configType?.toLowerCase())
    ? configType.toLowerCase()
    : 'other';

  try {
    const result = await llmService.optimizeConfig(config, resolvedType);

    res.json({
      success: true,
      configType: resolvedType,
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
