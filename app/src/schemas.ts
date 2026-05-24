/**
 * Zod Validation Schemas
 *
 * Centralized request validation for all API endpoints.
 * Replaces ad-hoc manual `if (!field)` checks with strict,
 * type-safe schemas that auto-generate TypeScript types.
 *
 * Uses Zod v4 API — `message` instead of `required_error`.
 */

import { z } from 'zod';

// --- /api/analyze ---

export const analyzeSchema = z.object({
  logs: z
    .string({ message: 'Missing required field: logs (string)' })
    .min(1, 'Logs must not be empty')
    .max(100_000, 'Logs too large — max 100,000 characters'),
  pipelineId: z.string().optional(),
  skipPreprocess: z.boolean().optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeSchema>;

// --- /api/optimize ---

export const VALID_CONFIG_TYPES = [
  'dockerfile',
  'github-actions',
  'gitlab-ci',
  'kubernetes',
  'helm',
  'terraform',
  'docker-compose',
  'jenkinsfile',
  'other',
] as const;

export const optimizeSchema = z.object({
  config: z
    .string({ message: 'Missing required field: config (string)' })
    .min(1, 'Config must not be empty')
    .max(50_000, 'Config too large — max 50,000 characters'),
  configType: z.enum(VALID_CONFIG_TYPES).optional().default('other'),
});

export type OptimizeRequest = z.infer<typeof optimizeSchema>;

// --- /api/heal ---

export const healSchema = z.object({
  logs: z
    .string({ message: 'Missing required field: logs (string)' })
    .min(1, 'Logs must not be empty'),
  repoUrl: z
    .string({ message: 'Missing required field: repoUrl (string)' })
    .url('repoUrl must be a valid URL')
    .optional(),
  githubToken: z.string().optional(),
  branch: z.string().optional(),
  filePath: z.string().optional(),
});

export type HealRequest = z.infer<typeof healSchema>;

// --- Shared Zod error formatter ---

/**
 * Extracts a clean, user-facing error message from a ZodError.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join('; ');
}
