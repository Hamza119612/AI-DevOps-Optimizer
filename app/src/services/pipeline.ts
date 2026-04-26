/**
 * Pipeline Service
 *
 * Handles parsing and processing of CI/CD pipeline logs before they go to the LLM.
 * The key job here is to REDUCE noise — a raw GitHub Actions log can be 10,000+ lines,
 * but only ~50 lines actually matter. We extract those so the LLM focuses on the right stuff
 * and we don't burn through tokens on timestamps and progress bars.
 */

export type CIProvider = 'github-actions' | 'gitlab-ci' | 'jenkins' | 'unknown';

export interface PipelineLog {
  pipelineId: string;
  provider: CIProvider;
  rawLogs: string;
  timestamp: Date;
}

export interface ParsedLogContext {
  provider: CIProvider;
  errorLines: string[];
  warningLines: string[];
  failedStep?: string;
  errorContext: string; // Trimmed, LLM-ready string
  totalLines: number;
  extractedLines: number;
}

// --- Provider detection patterns ---

const PROVIDER_PATTERNS: Record<CIProvider, RegExp[]> = {
  'github-actions': [
    /##\[group\]/, // GitHub Actions group markers
    /##\[error\]/,
    /Run \S+\/\S+/, // Action step header e.g. "Run actions/checkout@v4"
  ],
  'gitlab-ci': [
    /section_start:\d+:\S+/, // GitLab CI section markers
    /\$ gitlab-runner/,
    /Running with gitlab-runner/,
  ],
  jenkins: [/\[Pipeline\]/, /Started by user/, /Building in workspace/],
  unknown: [],
};

// --- Error signal patterns (lines we always want to keep) ---

const ERROR_PATTERNS: RegExp[] = [
  /error/i,
  /failed/i,
  /failure/i,
  /exception/i,
  /fatal/i,
  /panic/i,
  /cannot find/i,
  /module not found/i,
  /cannot read/i,
  /undefined is not/i,
  /type error/i,
  /syntax error/i,
  /exit code [^0]/i, // Non-zero exit codes
  /npm err!/i,
  /tsc:/i, // TypeScript compiler output
  /jest:/i,
  /assert/i,
  /expected .* to/i,
  /received:/i,
  /✕|✗|FAIL|FAILED/,
];

const WARNING_PATTERNS: RegExp[] = [
  /warn/i,
  /warning/i,
  /deprecated/i,
  /\[WARN\]/,
];

// Lines that are pure noise — timestamps, progress bars, etc.
const NOISE_PATTERNS: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO timestamps at line start
  /^##\[debug\]/, // GitHub Actions debug output
  /^\s*$/, // Empty lines (we'll add them back strategically)
  /^Downloading .+\.\.\.$/, // Download progress
  /^Extracting .+\.\.\.$/, // Extract progress
  /Progress: \d+%/, // Progress bars
  /Added \d+ packages/, // npm install noise
  /▸|▶|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/, // Spinner chars
];

export class PipelineService {
  /**
   * Detect which CI provider generated these logs.
   */
  detectProvider(rawLogs: string): CIProvider {
    for (const [provider, patterns] of Object.entries(PROVIDER_PATTERNS)) {
      if (provider === 'unknown') continue;
      const matches = patterns.filter((p) => p.test(rawLogs)).length;
      if (matches >= 1) return provider as CIProvider;
    }
    return 'unknown';
  }

  /**
   * Extract only the relevant lines from a raw log dump.
   *
   * Strategy:
   * 1. Filter out pure noise lines (timestamps, progress bars)
   * 2. Flag lines that match error/warning patterns
   * 3. Include a few lines of context around each error (±3 lines)
   * 4. Cap total output to avoid LLM token limits
   */
  extractErrorContext(rawLogs: string, maxLines = 200): string {
    const lines = rawLogs.split('\n');
    const totalLines = lines.length;

    // Find indices of lines with error signals
    const errorIndices = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (NOISE_PATTERNS.some((p) => p.test(line))) continue;
      if (ERROR_PATTERNS.some((p) => p.test(line))) {
        // Include ±3 lines of context around each error
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          errorIndices.add(j);
        }
      }
    }

    // If we found specific error lines, use those. Otherwise fall back to last N lines
    // (errors almost always appear near the end of CI logs)
    let selectedLines: string[];
    if (errorIndices.size > 0) {
      selectedLines = Array.from(errorIndices)
        .sort((a, b) => a - b)
        .map((i) => lines[i])
        .filter((line) => !NOISE_PATTERNS.some((p) => p.test(line)));
    } else {
      // Fallback: take the last 100 non-noise lines
      selectedLines = lines
        .filter((line) => !NOISE_PATTERNS.some((p) => p.test(line)))
        .slice(-100);
    }

    // Cap output
    if (selectedLines.length > maxLines) {
      const half = Math.floor(maxLines / 2);
      selectedLines = [
        ...selectedLines.slice(0, half),
        '',
        `... [${selectedLines.length - maxLines} lines omitted] ...`,
        '',
        ...selectedLines.slice(-half),
      ];
    }

    return [
      `[Log summary: ${errorIndices.size} error-relevant lines extracted from ${totalLines} total]`,
      '---',
      ...selectedLines,
    ].join('\n');
  }

  /**
   * Detect the failed step name from GitHub Actions logs.
   * Example: "##[error]Process completed with exit code 1." appears after a named step.
   */
  extractFailedStep(rawLogs: string): string | undefined {
    // GitHub Actions: step names appear as "Run <step-name>" before errors
    const stepPattern = /^Run (.+)$/m;
    const errorPattern = /##\[error\]|error:|Error:/i;

    const lines = rawLogs.split('\n');
    let lastStepName: string | undefined;

    for (const line of lines) {
      const stepMatch = line.match(stepPattern);
      if (stepMatch) {
        lastStepName = stepMatch[1].trim();
      }
      if (errorPattern.test(line) && lastStepName) {
        return lastStepName;
      }
    }

    return lastStepName; // Return last seen step even if we can't pinpoint it
  }

  /**
   * Full parse: detect provider, extract error context, identify failed step.
   * This is the main entry point called by the /api/analyze route.
   */
  parseLogs(rawLogs: string, pipelineId = 'unknown'): ParsedLogContext {
    const provider = this.detectProvider(rawLogs);
    const lines = rawLogs.split('\n');

    const errorLines = lines.filter((l) => ERROR_PATTERNS.some((p) => p.test(l)));
    const warningLines = lines.filter((l) => WARNING_PATTERNS.some((p) => p.test(l)));
    const failedStep = this.extractFailedStep(rawLogs);
    const errorContext = this.extractErrorContext(rawLogs);

    console.warn(
      `[pipeline] Parsed logs for ${pipelineId}: provider=${provider}, ` +
        `errors=${errorLines.length}, warnings=${warningLines.length}, ` +
        `extracted=${errorContext.split('\n').length} lines from ${lines.length} total`,
    );

    return {
      provider,
      errorLines,
      warningLines,
      failedStep,
      errorContext,
      totalLines: lines.length,
      extractedLines: errorContext.split('\n').length,
    };
  }
}

export default new PipelineService();
