import request from 'supertest';
import app from '../index';

/**
 * Tests for the LLM-powered API endpoints.
 *
 * These tests run WITHOUT an OpenAI API key, so they exercise
 * the mock/fallback path — proving the endpoints work end-to-end.
 */

describe('POST /api/analyze', () => {
    it('should return 400 if logs are missing', async () => {
        const res = await request(app).post('/api/analyze').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/logs/i);
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
        expect(res.body.analysis).toHaveProperty('rootCause');
        expect(res.body.analysis).toHaveProperty('suggestedFix');
        expect(res.body.analysis).toHaveProperty('confidence');
        expect(res.body.analysis).toHaveProperty('severity');
    });

    it('should detect Docker-related errors in mock mode', async () => {
        const res = await request(app)
            .post('/api/analyze')
            .send({ logs: 'Dockerfile: COPY failed: file not found' });

        expect(res.status).toBe(200);
        expect(res.body.analysis.rootCause).toMatch(/docker/i);
    });

    it('should detect test-related errors in mock mode', async () => {
        const res = await request(app)
            .post('/api/analyze')
            .send({ logs: 'FAIL src/__tests__/index.test.ts - Jest test suite failed' });

        expect(res.status).toBe(200);
        expect(res.body.analysis.rootCause).toMatch(/test/i);
    });
});

describe('POST /api/optimize', () => {
    it('should return 400 if config is missing', async () => {
        const res = await request(app).post('/api/optimize').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/config/i);
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

        expect(res.status).toBe(200);
        expect(res.body.configType).toBe('other');
    });
});
