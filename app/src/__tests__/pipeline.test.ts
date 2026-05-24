import { PipelineService } from '../services/pipeline';

/**
 * Unit tests for the Pipeline Log Pre-processor.
 *
 * Tests provider detection, noise filtering, and error context extraction.
 * These are pure unit tests — no HTTP, no LLM calls.
 */

const pipeline = new PipelineService();

describe('PipelineService.detectProvider', () => {
  it('should detect GitHub Actions logs', () => {
    const log = '##[group]Run actions/checkout@v4\n##[error]Process completed with exit code 1.';
    expect(pipeline.detectProvider(log)).toBe('github-actions');
  });

  it('should detect GitLab CI logs', () => {
    const log = 'section_start:1234567890:build\nRunning with gitlab-runner 16.0.0';
    expect(pipeline.detectProvider(log)).toBe('gitlab-ci');
  });

  it('should detect Jenkins logs', () => {
    const log = '[Pipeline] Start of Pipeline\n[Pipeline] node\nStarted by user admin';
    expect(pipeline.detectProvider(log)).toBe('jenkins');
  });

  it('should return unknown for unrecognized logs', () => {
    const log = 'Some random log output without CI markers';
    expect(pipeline.detectProvider(log)).toBe('unknown');
  });
});

describe('PipelineService.extractErrorContext', () => {
  it('should extract lines containing errors', () => {
    const log = [
      'Step 1: Installing dependencies',
      'npm install success',
      'Step 2: Building TypeScript',
      'Error: Cannot find module "./missing-file"',
      'at Object.<anonymous> (src/index.ts:5:1)',
      'npm run build exited with code 1',
    ].join('\n');

    const context = pipeline.extractErrorContext(log);
    expect(context).toContain('Error: Cannot find module');
    expect(context).toContain('src/index.ts');
  });

  it('should include surrounding context lines around errors', () => {
    const log = [
      'line 1',
      'line 2',
      'line 3', // Should appear as context before error
      'ERROR: something failed here',
      'line 5', // Should appear as context after error
      'line 6',
      'line 7',
    ].join('\n');

    const context = pipeline.extractErrorContext(log);
    expect(context).toContain('line 3'); // context before
    expect(context).toContain('line 5'); // context after
  });

  it('should filter out noisy timestamp lines', () => {
    const log = [
      '2024-01-15T10:30:00.123Z Starting build',
      '2024-01-15T10:30:01.456Z Error: build failed',
      '2024-01-15T10:30:02.789Z Process exited with code 1',
    ].join('\n');

    const context = pipeline.extractErrorContext(log);
    // Should filter out the timestamp-only lines but keep the error content
    expect(context).toContain('Error: build failed');
  });

  it('should fall back to last lines when no error patterns match', () => {
    const log = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}: normal output`).join('\n');
    const context = pipeline.extractErrorContext(log);
    // Should still return something (the last N lines)
    expect(context.length).toBeGreaterThan(0);
  });

  it('should add a summary header', () => {
    const log = 'Error: something went wrong';
    const context = pipeline.extractErrorContext(log);
    expect(context).toContain('[Log summary:');
  });
});

describe('PipelineService.extractFailedStep', () => {
  it('should extract the failed step name from GitHub Actions logs', () => {
    const log = [
      'Run npm run build',
      '> tsc',
      'Error: Type error in auth.ts',
      '##[error]Process completed with exit code 1.',
    ].join('\n');

    const step = pipeline.extractFailedStep(log);
    expect(step).toBe('npm run build');
  });

  it('should return undefined when no step is found', () => {
    const log = 'Some random log with no step markers';
    const step = pipeline.extractFailedStep(log);
    expect(step).toBeUndefined();
  });
});

describe('PipelineService.parseLogs', () => {
  it('should return a full ParsedLogContext object', () => {
    const log =
      '##[group]Run npm test\n##[error]Jest: 2 tests failed.\nFAIL src/__tests__/app.test.ts';
    const result = pipeline.parseLogs(log, 'run-42');

    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('errorLines');
    expect(result).toHaveProperty('warningLines');
    expect(result).toHaveProperty('errorContext');
    expect(result).toHaveProperty('totalLines');
    expect(result).toHaveProperty('extractedLines');
    expect(result.provider).toBe('github-actions');
    expect(result.errorLines.length).toBeGreaterThan(0);
  });
});
