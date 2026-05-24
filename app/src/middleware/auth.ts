/**
 * API Key Authentication Middleware
 *
 * Validates Bearer tokens against a configurable allowlist of API keys.
 *
 * Configuration (via environment variables):
 *   API_KEYS — comma-separated list of valid API keys
 *              e.g. "key1,key2,key3"
 *
 * Behavior:
 *   - If API_KEYS is not set → auth is disabled (open access for local dev)
 *   - If API_KEYS is set → requires Authorization: Bearer <key> header
 *   - Skipped in test mode (NODE_ENV=test)
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../services/logger';

/**
 * Factory that creates the auth middleware.
 * Reads API_KEYS from the environment at creation time.
 */
export function createAuthMiddleware() {
  const rawKeys = process.env.API_KEYS || '';
  const validKeys = new Set(
    rawKeys
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0),
  );

  const authEnabled = validKeys.size > 0 && process.env.NODE_ENV !== 'test';

  if (!authEnabled) {
    // Return a no-op middleware when auth is not configured
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  logger.info(`🔐 API key authentication enabled (${validKeys.size} key(s) configured)`);

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized — missing or malformed Authorization header',
        hint: 'Send: Authorization: Bearer <your-api-key>',
      });
      return;
    }

    const token = authHeader.slice(7); // Strip "Bearer "

    if (!validKeys.has(token)) {
      logger.warn({
        message: 'Rejected invalid API key',
        ip: req.ip,
        url: req.url,
      });
      res.status(403).json({ error: 'Forbidden — invalid API key' });
      return;
    }

    next();
  };
}
