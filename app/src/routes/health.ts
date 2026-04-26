import { Router } from 'express';
import https from 'https';

const router = Router();

/**
 * Liveness probe — indicates the service process is running.
 * Kubernetes restarts the pod if this fails.
 */
router.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * Readiness probe — indicates the service is ready to accept traffic.
 * Kubernetes stops sending traffic if this fails.
 *
 * Checks:
 *   - NVIDIA NIM API reachability (if NVIDIA_API_KEY is set)
 */
router.get('/readyz', async (_req, res): Promise<void> => {
  const checks: Record<string, string> = {};

  // Check NVIDIA NIM reachability if a key is configured
  if (process.env.NVIDIA_API_KEY) {
    try {
      await pingNvidiaApi();
      checks['nvidia-nim'] = 'ok';
    } catch {
      checks['nvidia-nim'] = 'unreachable';
      res.status(503).json({ status: 'not ready', checks });
      return;
    }
  } else {
    checks['nvidia-nim'] = 'not configured (mock mode)';
  }

  res.status(200).json({ status: 'ready', checks });
});

/**
 * Ping the NVIDIA NIM /models endpoint with a short timeout.
 * Resolves if reachable, rejects if not.
 */
function pingNvidiaApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'integrate.api.nvidia.com',
        path: '/v1/models',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        },
        timeout: 3000, // 3-second timeout — fast enough for a readiness probe
      },
      (res) => {
        // 200 or 401 both mean the endpoint is reachable
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          reject(new Error(`Unexpected status: ${res.statusCode}`));
        }
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('NVIDIA NIM request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

export default router;
