import client from 'prom-client';

/**
 * Metrics Service
 *
 * Centralized Prometheus metrics registry and custom metric definitions.
 */

export const register = new client.Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// --- HTTP Metrics ---

export const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
});
register.registerMetric(httpRequestCounter);

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDuration);

// --- LLM Metrics (Phase 3) ---

export const llmRequestCounter = new client.Counter({
    name: 'llm_requests_total',
    help: 'Total number of LLM API calls',
    labelNames: ['operation', 'model', 'status'],
});
register.registerMetric(llmRequestCounter);

export const llmTokensUsed = new client.Counter({
    name: 'llm_tokens_used_total',
    help: 'Total LLM tokens consumed',
    labelNames: ['operation', 'type'],
});
register.registerMetric(llmTokensUsed);

export const llmRequestDuration = new client.Histogram({
    name: 'llm_request_duration_seconds',
    help: 'Duration of LLM API calls in seconds',
    labelNames: ['operation', 'model'],
    buckets: [0.5, 1, 2, 5, 10, 30],
});
register.registerMetric(llmRequestDuration);
