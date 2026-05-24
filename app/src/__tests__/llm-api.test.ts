import request from 'supertest';
import app from '../index';

/**
 * Tests for the LLM-powered API endpoints.
 *
 * These tests run WITHOUT an OpenAI API key, so they exercise
 * the mock/fallback path — proving the endpoints work end-to-end.
 *
 * Auth middleware is disabled in test mode (NODE_ENV=test).
 */

describe('POST /api/analyze', () => {
  // These tests must run in mock mode. Clear any keys injected by CI.
  beforeAll(() => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('should return 400 if logs are missing', async () => {
    const res = await request(app).post('/api/analyze').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if logs is not a string', async () => {
    const res = await request(app).post('/api/analyze').send({ logs: 12345 });
    expect(res.status).toBe(400);
  });

  it('should return a mock analysis when no API key is set', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ logs: 'Error: npm run build failed with exit code 1', pipelineId: 'test-123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pipelineId).toBe('test-123');
    expect(res.body.analysis).toHaveProperty('errors');
    expect(Array.isArray(res.body.analysis.errors)).toBe(true);
    expect(res.body.analysis.errors[0]).toHaveProperty('rootCause');
    expect(res.body.analysis.errors[0]).toHaveProperty('suggestedFix');
    expect(res.body.analysis.errors[0]).toHaveProperty('confidence');
    expect(res.body.analysis.errors[0]).toHaveProperty('severity');
  });

  it('should include meta field with provider and line counts', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ logs: 'Error: build failed', pipelineId: 'test-456' });

    expect(res.status).toBe(200);
    expect(res.body.meta).toHaveProperty('provider');
    expect(res.body.meta).toHaveProperty('totalLines');
    expect(res.body.meta).toHaveProperty('extractedLines');
    expect(res.body.meta).toHaveProperty('preprocessed');
    expect(res.body.meta.preprocessed).toBe(true);
  });

  it('should detect Docker-related errors in mock mode', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ logs: 'Dockerfile: COPY failed: file not found' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.errors[0].rootCause).toMatch(/docker/i);
  });

  it('should detect test-related errors in mock mode', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ logs: 'FAIL src/__tests__/index.test.ts - Jest test suite failed' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.errors[0].rootCause).toMatch(/test/i);
  });

  it('should detect GitHub Actions provider', async () => {
    const ghActionsLog = `
##[group]Run npm run build
##[error]Process completed with exit code 1.
##[endgroup]
        `.trim();

    const res = await request(app).post('/api/analyze').send({ logs: ghActionsLog });

    expect(res.status).toBe(200);
    expect(res.body.meta.provider).toBe('github-actions');
  });

  it('should detect GitLab CI provider', async () => {
    const gitlabLog = `
section_start:1234567890:build
Running with gitlab-runner 16.0.0
$ npm run build
ERROR: Build failed
        `.trim();

    const res = await request(app).post('/api/analyze').send({ logs: gitlabLog });

    expect(res.status).toBe(200);
    expect(res.body.meta.provider).toBe('gitlab-ci');
  });

  it('should skip pre-processing when skipPreprocess is true', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ logs: 'Error: build failed', skipPreprocess: true });

    expect(res.status).toBe(200);
    expect(res.body.meta.preprocessed).toBe(false);
  });
});

describe('POST /api/optimize', () => {
  // These tests must run in mock mode. Clear any keys injected by CI.
  beforeAll(() => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('should return 400 if config is missing', async () => {
    const res = await request(app).post('/api/optimize').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 if config is not a string', async () => {
    const res = await request(app).post('/api/optimize').send({ config: 999 });
    expect(res.status).toBe(400);
  });

  it('should return mock suggestions when no API key is set', async () => {
    const res = await request(app)
      .post('/api/optimize')
      .send({ config: 'FROM node:14\nRUN npm install', configType: 'dockerfile' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.configType).toBe('dockerfile');
    expect(res.body.result).toHaveProperty('summary');
    expect(res.body.result.suggestions).toBeInstanceOf(Array);
    expect(res.body.result.suggestions.length).toBeGreaterThan(0);
  });

  it('should default configType to "other" for unknown types', async () => {
    const res = await request(app)
      .post('/api/optimize')
      .send({ config: 'some config', configType: 'unknown-type' });

    expect(res.status).toBe(400);
    // Zod rejects unknown enum values as invalid
  });

  it('should default configType to "other" when not provided', async () => {
    const res = await request(app)
      .post('/api/optimize')
      .send({ config: 'some config content' });
    expect(res.status).toBe(200);
    expect(res.body.configType).toBe('other');
  });

  it('should accept all valid config types', async () => {
    const validTypes = [
      'dockerfile',
      'github-actions',
      'gitlab-ci',
      'kubernetes',
      'helm',
      'terraform',
      'docker-compose',
      'jenkinsfile',
    ];
    for (const configType of validTypes) {
      const res = await request(app)
        .post('/api/optimize')
        .send({ config: 'some config content', configType });
      expect(res.status).toBe(200);
      expect(res.body.configType).toBe(configType);
    }
  });
});
