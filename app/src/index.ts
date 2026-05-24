import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, httpRequestCounter, httpRequestDuration } from './services/metrics';
import healthRoutes from './routes/health';
import analyzeRoutes from './routes/analyze';
import optimizeRoutes from './routes/optimize';
import healRoutes from './routes/heal';
import logger from './services/logger';

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies (limit to 1MB for log/config payloads)
app.use(express.json({ limit: '1mb' }));

// --- Rate limiter for LLM endpoints (protects your OpenAI bill!) ---
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // max 10 requests per minute per IP
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', // Disable in tests
  message: {
    error: 'Too many requests — max 10 per minute. Please slow down.',
  },
});


// --- Metrics & Request Logging middleware ---
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 9);

  // Attach requestId to request context for downstream logging
  (req as any).requestId = requestId;

  logger.info({
    message: `Incoming ${req.method} ${req.url}`,
    method: req.method,
    url: req.url,
    requestId,
    ip: req.ip,
  });

  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = req.route?.path || req.path;
    const duration = Date.now() - start;

    httpRequestCounter.labels(req.method, route, res.statusCode.toString()).inc();
    end({ method: req.method, route, status: res.statusCode.toString() });

    logger.info({
      message: `Completed ${req.method} ${req.url} with ${res.statusCode}`,
      method: req.method,
      url: req.url,
      requestId,
      status: res.statusCode,
      durationMs: duration,
    });
  });

  next();
});

// --- Routes ---
app.use(healthRoutes);
app.use('/api', apiLimiter, analyzeRoutes);
app.use('/api', apiLimiter, optimizeRoutes);
app.use('/api', apiLimiter, healRoutes);

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/', (_req, res) => {
  res.send('Hello, World!');
});

// --- Start server ---
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;

