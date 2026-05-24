/**
 * PII & Secret Scrubber
 *
 * Sanitizes raw CI/CD log text by replacing sensitive patterns
 * (API keys, tokens, credentials, emails, connection strings)
 * with safe [REDACTED] placeholders before sending to external LLMs.
 *
 * This module is shared between the CLI (`cli-heal.ts`) and the
 * API route (`heal.ts`) to avoid code duplication.
 */

const SCRUB_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // GitHub Personal Access Tokens
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, replacement: '[REDACTED_GH_TOKEN]' },
  // GitHub fine-grained tokens
  { pattern: /github_pat_[a-zA-Z0-9_]{82}/g, replacement: '[REDACTED_GH_PAT]' },
  // NVIDIA API keys
  { pattern: /nvapi-[a-zA-Z0-9-]{70,}/gi, replacement: '[REDACTED_NVIDIA_KEY]' },
  // OpenAI API keys
  { pattern: /sk-[a-zA-Z0-9]{48}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  // Generic AWS keys
  { pattern: /AKIA[A-Z0-9]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  // MongoDB connection strings
  { pattern: /(mongodb(?:\+srv)?:\/\/[^\s]+)/gi, replacement: '[REDACTED_MONGO_URL]' },
  // MySQL connection strings
  { pattern: /mysql:\/\/([^:]+):([^@]+)@/gi, replacement: 'mysql://$1:[REDACTED_PASS]@' },
  // PostgreSQL connection strings
  { pattern: /postgresql:\/\/([^:]+):([^@]+)@/gi, replacement: 'postgresql://$1:[REDACTED_PASS]@' },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
  // Generic Bearer tokens in log output
  { pattern: /Bearer\s+[a-zA-Z0-9._\-]{20,}/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Base64-encoded secrets (long base64 strings that look like credentials)
  {
    pattern: /(?:password|secret|token|key|credential)["'=:\s]+[A-Za-z0-9+/]{40,}={0,2}/gi,
    replacement: '[REDACTED_SECRET]',
  },
];

/**
 * Scrub secrets and PII from text.
 * Applies all scrub rules sequentially.
 */
export function scrubSecrets(text: string): string {
  let result = text;
  for (const rule of SCRUB_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}
