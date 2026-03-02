/**
 * Pipeline Service
 *
 * Handles parsing and processing of CI/CD pipeline logs and configurations.
 * Acts as the preprocessor before sending data to the LLM service.
 *
 * TODO: Phase 3 implementation
 *   - Parse GitHub Actions log format
 *   - Extract relevant error sections from verbose logs
 *   - Normalize different CI provider formats (GitHub Actions, GitLab CI, Jenkins)
 */

export interface PipelineLog {
    pipelineId: string;
    provider: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'unknown';
    rawLogs: string;
    timestamp: Date;
}

export class PipelineService {
    /**
     * Parse raw log output and extract structured information.
     */
    async parseLogs(_rawLogs: string): Promise<PipelineLog> {
        throw new Error('Pipeline log parsing not yet implemented — coming in Phase 3');
    }

    /**
     * Extract error-relevant sections from full log output
     * to reduce token usage when sending to LLM.
     */
    async extractErrorContext(_rawLogs: string): Promise<string> {
        throw new Error('Error context extraction not yet implemented — coming in Phase 3');
    }
}

export default new PipelineService();
