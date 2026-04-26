/**
 * LLM Service
 *
 * Supports two providers via environment variables:
 *
 *   NVIDIA NIM (free tier)  — set NVIDIA_API_KEY
 *     Base URL : https://integrate.api.nvidia.com/v1
 *     Default model: meta/llama-3.3-70b-instruct
 *
 *   OpenAI                  — set OPENAI_API_KEY
 *     Default model: gpt-4o-mini
 *
 * NVIDIA NIM exposes an OpenAI-compatible API so the same SDK works for both.
 *
 * Every real API call is tracked with Prometheus metrics:
 *   - llm_requests_total         (success/error counts by operation)
 *   - llm_tokens_used_total      (prompt + completion tokens)
 *   - llm_request_duration_secs  (latency histogram)
 *   - llm_estimated_cost_usd     (approximate spend — $0 for NVIDIA free tier)
 */

import OpenAI from 'openai';
import {
  llmRequestCounter,
  llmTokensUsed,
  llmRequestDuration,
  llmEstimatedCostUSD,
} from './metrics';

// --- Types ---

export interface LLMAnalysisError {
  rootCause: string;
  file?: string;
  line?: number;
  suggestedFix: string;
  confidence: number; // 0–100
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface LLMAnalysisResult {
  errors: LLMAnalysisError[];
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

// --- Provider detection ---

type Provider = 'nvidia' | 'openai' | 'none';

function detectProvider(): Provider {
  if (process.env.NODE_ENV === 'test') {
    return 'none';
  }
  if (process.env.NVIDIA_API_KEY) return 'nvidia';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'none';
}

// --- Pricing (per 1M tokens) ---
// NVIDIA NIM free tier = $0. OpenAI pricing kept for reference.
const TOKEN_COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  // NVIDIA NIM — free tier
  'meta/llama-3.3-70b-instruct': { input: 0.0, output: 0.0 },
  'meta/llama-3.1-8b-instruct': { input: 0.0, output: 0.0 },
  'deepseek-ai/deepseek-r1': { input: 0.0, output: 0.0 },
  'mistral-ai/mistral-large': { input: 0.0, output: 0.0 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = TOKEN_COST_PER_MILLION[model] ?? { input: 0, output: 0 };
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

// --- Prompt Templates ---

const ANALYZE_SYSTEM_PROMPT = `You are a senior DevOps engineer specializing in CI/CD pipeline debugging.
You will receive raw pipeline logs from a failing build.

Your job:
1. Identify ALL errors and ROOT CAUSES of the failure (not just the symptoms)
2. Point to the exact file and line if possible for each error
3. Suggest a concrete fix for each error

Respond ONLY in this JSON format (no markdown, no extra text):
{
  "errors": [
    {
      "rootCause": "clear one-line description of what went wrong",
      "file": "path/to/file or null",
      "line": 42,
      "suggestedFix": "step-by-step fix instructions",
      "confidence": 85,
      "severity": "high"
    }
  ]
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
  private provider: Provider;

  constructor() {
    this.provider = detectProvider();

    if (this.provider === 'nvidia') {
      const apiKey = process.env.NVIDIA_API_KEY!;
      this.model = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      console.log(`🟢 LLM provider: NVIDIA NIM (${this.model})`);
    } else if (this.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY!;
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      this.client = new OpenAI({ apiKey });
      console.log(`🟢 LLM provider: OpenAI (${this.model})`);
    } else {
      console.warn('⚠️  No LLM API key set (NVIDIA_API_KEY or OPENAI_API_KEY) — returning mock responses');
      this.model = 'mock';
      this.client = new OpenAI({ apiKey: 'not-set' });
    }
  }

  /**
   * Analyze pipeline logs to find the root cause of a failure.
   */
  async analyzeLogs(logs: string): Promise<LLMAnalysisResult> {
    if (this.provider === 'none') {
      return this.mockAnalysis(logs);
    }

    // Truncate very long logs to stay within token limits
    const truncatedLogs =
      logs.length > 15000
        ? logs.slice(0, 5000) + '\n\n... [truncated] ...\n\n' + logs.slice(-5000)
        : logs;

    const endTimer = llmRequestDuration.startTimer({ operation: 'analyze', model: this.model });

    try {
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
        temperature: 0.2,
        max_tokens: 1000,
        ...(this.model.includes('deepseek') && { chat_template_kwargs: { thinking: false } }),
      } as any);

      endTimer();

      const usage = response.usage;
      if (usage) {
        llmTokensUsed.labels('analyze', 'prompt').inc(usage.prompt_tokens);
        llmTokensUsed.labels('analyze', 'completion').inc(usage.completion_tokens);
        llmEstimatedCostUSD
          .labels('analyze', this.model)
          .inc(estimateCost(this.model, usage.prompt_tokens, usage.completion_tokens));
      }

      llmRequestCounter.labels('analyze', this.model, 'success').inc();

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      return JSON.parse(content) as LLMAnalysisResult;
    } catch (err) {
      endTimer();
      llmRequestCounter.labels('analyze', this.model, 'error').inc();
      throw err;
    }
  }

  /**
   * Optimize a pipeline configuration (Dockerfile, YAML, etc).
   */
  async optimizeConfig(
    config: string,
    configType: string,
  ): Promise<LLMOptimizationResult> {
    if (this.provider === 'none') {
      return this.mockOptimization(configType);
    }

    const endTimer = llmRequestDuration.startTimer({ operation: 'optimize', model: this.model });

    try {
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
        ...(this.model.includes('deepseek') && { chat_template_kwargs: { thinking: false } }),
      } as any);

      endTimer();

      const usage = response.usage;
      if (usage) {
        llmTokensUsed.labels('optimize', 'prompt').inc(usage.prompt_tokens);
        llmTokensUsed.labels('optimize', 'completion').inc(usage.completion_tokens);
        llmEstimatedCostUSD
          .labels('optimize', this.model)
          .inc(estimateCost(this.model, usage.prompt_tokens, usage.completion_tokens));
      }

      llmRequestCounter.labels('optimize', this.model, 'success').inc();

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      return JSON.parse(content) as LLMOptimizationResult;
    } catch (err) {
      endTimer();
      llmRequestCounter.labels('optimize', this.model, 'error').inc();
      throw err;
    }
  }

  // --- Mock responses for when no API key is set ---

  private mockAnalysis(logs: string): LLMAnalysisResult {
    const isDockerError = logs.toLowerCase().includes('dockerfile') || logs.toLowerCase().includes('docker');
    const isTestError = logs.toLowerCase().includes('test') || logs.toLowerCase().includes('jest');
    const isBuildError = logs.toLowerCase().includes('build') || logs.toLowerCase().includes('tsc');

    return {
      errors: [
        {
          rootCause: isDockerError
            ? 'Docker build failed — likely a missing dependency or incorrect COPY path'
            : isTestError
              ? 'Test suite failed — one or more test assertions did not pass'
              : isBuildError
                ? 'TypeScript build failed — likely a type error or missing import'
                : 'Pipeline step failed — check the logs for the specific error',
          file: null as unknown as string,
          suggestedFix:
            'This is a MOCK response. Set NVIDIA_API_KEY or OPENAI_API_KEY to get real AI analysis.',
          confidence: 30,
          severity: 'medium',
        }
      ]
    };
  }

  private mockOptimization(configType: string): LLMOptimizationResult {
    return {
      summary: `Mock review of ${configType} config (set NVIDIA_API_KEY for real analysis)`,
      suggestions: [
        {
          category: 'best-practice',
          title: 'Enable real LLM analysis',
          description:
            'Set the NVIDIA_API_KEY environment variable (free at build.nvidia.com) to get actual AI-powered optimization suggestions.',
          impact: 'high',
          effort: 'low',
        },
      ],
    };
  }
}

export default new LLMService();
