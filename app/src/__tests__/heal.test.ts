import request from 'supertest';
import app from '../index';
import gitService from '../services/git';
import llmService from '../services/llm';

// Mock Git Service and LLM Service
jest.mock('../services/git');
jest.mock('../services/llm');

describe('POST /api/heal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if required fields are missing', async () => {
    const response = await request(app).post('/api/heal').send({ logs: 'build failed' }); // Missing repoUrl and githubToken

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  it('should return 422 if LLM fails to isolate errors', async () => {
    (llmService.analyzeLogs as jest.Mock).mockResolvedValue({
      errors: [], // No errors isolated
    });

    const response = await request(app).post('/api/heal').send({
      logs: 'pure successful log trace',
      repoUrl: 'https://github.com/User/Repo',
      githubToken: 'ghp_token123',
    });

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('failed to isolate');
  });

  it('should return 200 and PR metadata upon successful self-healing', async () => {
    // Mock successful LLM analysis
    (llmService.analyzeLogs as jest.Mock).mockResolvedValue({
      errors: [
        {
          rootCause: 'Type error in middleware.ts line 22',
          file: 'src/middleware.ts',
          suggestedFix: 'Wrap parameter in Optional wrapper',
          confidence: 90,
          severity: 'high',
        },
      ],
    });

    // Mock successful Git self-healing operations
    (gitService.applySelfHealing as jest.Mock).mockResolvedValue({
      success: true,
      branchName: 'devops-copilot/fix-abcd123',
      prUrl: 'https://github.com/User/Repo/pull/42',
      prNumber: 42,
    });

    const response = await request(app).post('/api/heal').send({
      logs: '##[error]TypeError: Cannot read property role of undefined',
      repoUrl: 'https://github.com/User/Repo',
      githubToken: 'ghp_token123',
      branch: 'main',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.prUrl).toBe('https://github.com/User/Repo/pull/42');
    expect(response.body.prNumber).toBe(42);
    expect(response.body.triage.targetFile).toBe('src/middleware.ts');
  });

  it('should return 500 if Git self-healing engine fails', async () => {
    (llmService.analyzeLogs as jest.Mock).mockResolvedValue({
      errors: [
        {
          rootCause: 'Type error in middleware.ts line 22',
          file: 'src/middleware.ts',
          suggestedFix: 'Wrap parameter in Optional wrapper',
          confidence: 90,
          severity: 'high',
        },
      ],
    });

    // Mock failing Git self-healing operations
    (gitService.applySelfHealing as jest.Mock).mockResolvedValue({
      success: false,
      branchName: 'devops-copilot/fix-fail',
      error: 'Git clone authentication failed',
    });

    const response = await request(app).post('/api/heal').send({
      logs: '##[error]TypeError: Cannot read property role of undefined',
      repoUrl: 'https://github.com/User/Repo',
      githubToken: 'ghp_token123',
    });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.details).toBe('Git clone authentication failed');
  });
});
