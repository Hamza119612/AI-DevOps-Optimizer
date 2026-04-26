import fs from 'fs';
import path from 'path';

// Load .env manually without dotenv package
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

async function runTest() {
  // Dynamically import llmService AFTER env vars are set
  const { default: llmService } = await import('./src/services/llm.js');

  console.log('🧪 Starting LLM Test...');
  console.log('--------------------------------------------------');

  const dummyFailingLogs = `
[2024-11-15T08:34:10.123Z] INFO: Starting CI/CD pipeline execution for commit 8a9b2c3d
[2024-11-15T08:34:12.456Z] Step 1/12: Checking out code
[2024-11-15T08:34:15.789Z] Step 2/12: Setting up Node.js environment (v20.x)
[2024-11-15T08:34:18.012Z] Step 3/12: Installing dependencies
[2024-11-15T08:34:18.012Z] Running npm ci
npm WARN deprecated request@2.88.2: request has been deprecated, see https://github.com/request/request/issues/3142
npm WARN deprecated har-validator@5.1.5: this library is no longer supported
npm WARN audit 5 vulnerabilities (2 moderate, 3 high)
[2024-11-15T08:35:01.345Z] added 1420 packages, and audited 1421 packages in 43s
[2024-11-15T08:35:05.120Z] Step 4/12: Running linting
[2024-11-15T08:35:05.120Z] > eslint src/ --ext .ts,.tsx
[2024-11-15T08:35:12.890Z] src/components/UserProfile.tsx
[2024-11-15T08:35:12.890Z]   45:10  error  'userData' is missing in props validation  react/prop-types
[2024-11-15T08:35:12.890Z]   89:5   warning  React Hook useEffect has a missing dependency: 'fetchProfile'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
[2024-11-15T08:35:12.890Z] src/utils/api.ts
[2024-11-15T08:35:12.890Z]   112:20 error  'token' is defined but never used  @typescript-eslint/no-unused-vars
[2024-11-15T08:35:12.950Z] ✖ 3 problems (2 errors, 1 warning)
[2024-11-15T08:35:13.000Z] Error: Process completed with exit code 1.
[2024-11-15T08:35:14.200Z] Step 5/12: Running unit tests
[2024-11-15T08:35:14.200Z] > jest --ci --coverage
[2024-11-15T08:35:28.450Z] FAIL src/tests/authService.test.ts
[2024-11-15T08:35:28.450Z]   ● AuthService › login › should return a valid JWT token on successful login
[2024-11-15T08:35:28.450Z]     expect(received).toBeDefined()
[2024-11-15T08:35:28.450Z]     Received: undefined
[2024-11-15T08:35:28.450Z]       42 |     const token = await authService.login('user', 'pass');
[2024-11-15T08:35:28.450Z]     > 43 |     expect(token).toBeDefined();
[2024-11-15T08:35:28.450Z]          |                   ^
[2024-11-15T08:35:28.450Z]       44 |     expect(jwt.verify(token, 'secret')).toBeTruthy();
[2024-11-15T08:35:28.450Z]       at Object.<anonymous> (src/tests/authService.test.ts:43:19)
[2024-11-15T08:35:35.100Z] Test Suites: 1 failed, 24 passed, 25 total
[2024-11-15T08:35:35.100Z] Tests:       1 failed, 150 passed, 151 total
[2024-11-15T08:35:35.500Z] Error: Process completed with exit code 1.
[2024-11-15T08:35:38.200Z] Step 6/12: Building production assets
[2024-11-15T08:35:38.200Z] > tsc -b && vite build
[2024-11-15T08:35:45.890Z] src/services/database.ts:25:7 - error TS2322: Type 'string | undefined' is not assignable to type 'string'.
[2024-11-15T08:35:45.890Z]   Type 'undefined' is not assignable to type 'string'.
[2024-11-15T08:35:45.890Z] 25 const dbHost: string = process.env.DB_HOST;
[2024-11-15T08:35:45.890Z]          ~~~~~~
[2024-11-15T08:35:46.000Z] Error: Process completed with exit code 2.
[2024-11-15T08:35:48.500Z] FATAL: Pipeline failed at multiple stages (lint, test, build).
  `;

  console.log('📜 Input Logs:');
  console.log(dummyFailingLogs.trim());
  console.log('\n🤖 Sending to LLM...');

  try {
    const result = await llmService.analyzeLogs(dummyFailingLogs);
    console.log('\n✅ LLM Result:');
    console.dir(result, { depth: null, colors: true });
  } catch (error: any) {
    console.error('\n❌ Error:', error.message || error);
  }
}

runTest();
