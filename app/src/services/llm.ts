/**
 * LLM Service
 *
 * Talks to OpenAI's API (ChatGPT) to analyze CI/CD logs and optimize configs.
 * Uses structured JSON output so we always get clean, parseable responses.
 */

import OpenAI from 'openai';

// --- Types ---

export interface LLMAnalysisResult {
  rootCause: string;
  file?: string;
  line?: number;
  suggestedFix: string;
  confidence: number; // 0–100
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationSuggestion {
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  before?: string;
  after?: string;
}

export interface LLMOptimizationResult {
  summary: string;
  suggestions: OptimizationSuggestion[];
}

// --- Prompt Templates ---

const ANALYZE_SYSTEM_PROMPT = `You are a senior DevOps engineer specializing in CI/CD pipeline debugging.
You will receive raw pipeline logs from a failing build.

Your job:
1. Identify the ROOT CAUSE of the failure (not just the symptom)
2. Point to the exact file and line if possible
3. Suggest a concrete fix

Respond ONLY in this JSON format (no markdown, no extra text):
{
  "rootCause": "clear one-line description of what went wrong",
  "file": "path/to/file or null",
  "line": 42,
  "suggestedFix": "step-by-step fix instructions",
  "confidence": 85,
  "severity": "high"
}

Where confidence is 0–100 and severity is one of: low, medium, high, critical.`;

const OPTIMIZE_SYSTEM_PROMPT = `You are a senior DevOps engineer specializing in CI/CD optimization.
You will receive a pipeline configuration (Dockerfile, GitHub Actions YAML, K8s manifest, etc).

Your job:
1. Review the config for security issues, performance problems, and best practice violations
2. Suggest concrete improvements, ranked by impact
3. For each suggestion, show a before/after code snippet if applicable

Respond ONLY in this JSON format (no markdown, no extra text):
{
  "summary": "one-line overall assessment",
  "suggestions": [
    {
      "category": "security|performance|best-practice|cost",
      "title": "short title",
      "description": "what to change and why",
      "impact": "low|medium|high",
      "effort": "low|medium|high",
      "before": "code snippet (or null)",
      "after": "improved code snippet (or null)"
    }
  ]
}`;

// --- Service Class ---

export class LLMService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn(
        '⚠️  OPENAI_API_KEY not set — LLM features will return mock responses',
      );
    }

    this.client = new OpenAI({
      apiKey: apiKey || 'not-set',
    });

    // Allow overriding the model via env var (useful for cost control)
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  /**
   * Analyze pipeline logs to find the root cause of a failure.
   *
   * Sends the logs to OpenAI with a system prompt that forces JSON output.
   * If no API key is set, returns a mock response so the app still works.
   */
  async analyzeLogs(logs: string): Promise<LLMAnalysisResult> {
    if (!process.env.OPENAI_API_KEY) {
      return this.mockAnalysis(logs);
    }

    // Truncate very long logs to stay within token limits
    const truncatedLogs =
      logs.length > 15000
        ? logs.slice(0, 5000) + '\n\n... [truncated] ...\n\n' + logs.slice(-5000)
        : logs;

    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze these failing pipeline logs:\n\n${truncatedLogs}`,
        },
      ],
      temperature: 0.2, // Low temperature = more deterministic, less creative
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(content) as LLMAnalysisResult;
  }

  /**
   * Optimize a pipeline configuration (Dockerfile, YAML, etc).
   *
   * Sends the config to OpenAI for review and returns ranked suggestions.
   */
  async optimizeConfig(
    config: string,
    configType: string,
  ): Promise<LLMOptimizationResult> {
    if (!process.env.OPENAI_API_KEY) {
      return this.mockOptimization(configType);
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Review this ${configType} configuration and suggest improvements:\n\n${config}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return JSON.parse(content) as LLMOptimizationResult;
  }

  // --- Mock responses for when no API key is set ---

  private mockAnalysis(logs: string): LLMAnalysisResult {
    // Basic keyword detection for demo purposes
    const isDockerError = logs.toLowerCase().includes('dockerfile') || logs.toLowerCase().includes('docker');
    const isTestError = logs.toLowerCase().includes('test') || logs.toLowerCase().includes('jest');
    const isBuildError = logs.toLowerCase().includes('build') || logs.toLowerCase().includes('tsc');

    return {
      rootCause: isDockerError
        ? 'Docker build failed — likely a missing dependency or incorrect COPY path'
        : isTestError
          ? 'Test suite failed — one or more test assertions did not pass'
          : isBuildError
            ? 'TypeScript build failed — likely a type error or missing import'
            : 'Pipeline step failed — check the logs for the specific error',
      file: null as unknown as string,
      suggestedFix:
        'This is a MOCK response because OPENAI_API_KEY is not set. Set the env var to get real AI analysis.',
      confidence: 30,
      severity: 'medium',
    };
  }

  private mockOptimization(configType: string): LLMOptimizationResult {
    return {
      summary: `Mock review of ${configType} config (set OPENAI_API_KEY for real analysis)`,
      suggestions: [
        {
          category: 'best-practice',
          title: 'Enable real LLM analysis',
          description:
            'Set the OPENAI_API_KEY environment variable to get actual AI-powered optimization suggestions.',
          impact: 'high',
          effort: 'low',
        },
      ],
    };
  }
}

export default new LLMService();
