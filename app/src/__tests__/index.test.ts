import request from 'supertest';
import app from '../index';

describe('GET /', () => {
  it('should return 200 and a welcome message', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello, World!');
  });
});

describe('GET /healthz', () => {
  it('should return 200 with ok status', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('GET /readyz', () => {
  it('should return 200 with ready status', async () => {
    const response = await request(app).get('/readyz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });
});

describe('GET /metrics', () => {
  it('should return 200 with Prometheus metrics', async () => {
    const response = await request(app).get('/metrics');
    expect(response.status).toBe(200);
    expect(response.text).toContain('http_requests_total');
  });
});
