import http from 'http';
import fs from 'fs';

// --- CONFIGURATION ---
const PORT = 3000;
const GITHUB_USERNAME = 'Hamza119612';
const GITHUB_TOKEN = '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';
const LOG_FILE_PATH = 'c:/Users/Hamza/Documents/GitHub/AI-DevOps-Optimizer/scratch/large_ci_failure.log';

async function runTest() {
  console.log('🚀 Starting SRE Co-Pilot Test Harness...');

  // 1. Read the log file
  if (!fs.existsSync(LOG_FILE_PATH)) {
    console.error(`❌ Error: Log file not found at: ${LOG_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`📖 Reading log file from: ${LOG_FILE_PATH}`);
  const logs = fs.readFileSync(LOG_FILE_PATH, 'utf8');

  // 2. Build the JSON payload
  const payload = JSON.stringify({
    logs: logs,
    repoUrl: `https://github.com/${GITHUB_USERNAME}/AI-DevOps-Optimizer.git`,
    branch: 'main',
    githubToken: GITHUB_TOKEN,
    filePath: 'app/src/routes/heal.ts',
  });

  console.log(`📦 Payload compiled. Size: ${(payload.length / 1024).toFixed(2)} KB.`);
  console.log('📡 Sending POST /api/heal request...');

  // 3. Configure HTTP Request options
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/heal',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  // 4. Send request
  const req = http.request(options, (res) => {
    let rawData = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => { rawData += chunk; });

    res.on('end', () => {
      console.log(`📥 Response Received (Status: ${res.statusCode})`);
      try {
        const parsedData = JSON.parse(rawData);
        if (res.statusCode === 200) {
          console.log('\n🟢 SUCCESS! AI SRE Triaged and Patched your code!');
          console.log(`🔗 Draft Pull Request URL: ${parsedData.prUrl}`);
          console.log(`🌿 Branch Name: ${parsedData.branchName}`);
          console.log(`📋 Isolated Root Cause: ${parsedData.triage.rootCause}`);
          console.log(`🩹 Fix Applied: ${parsedData.triage.suggestedFix}`);
        } else {
          console.error('\n❌ ERROR: Self-Healing Failed!');
          console.error(JSON.stringify(parsedData, null, 2));
        }
      } catch (e) {
        console.error('\n❌ Failed to parse response JSON:', rawData);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Connection error: ${e.message}`);
  });

  // Write payload to request body
  req.write(payload);
  req.end();
}

runTest();
