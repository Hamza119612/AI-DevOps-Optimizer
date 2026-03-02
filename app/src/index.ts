import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, httpRequestCounter, httpRequestDuration } from './services/metrics';
import healthRoutes from './routes/health';
import analyzeRoutes from './routes/analyze';
import optimizeRoutes from './routes/optimize';

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

// --- Metrics middleware ---
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    httpRequestCounter.labels(req.method, route, res.statusCode.toString()).inc();
    end({ method: req.method, route, status: res.statusCode.toString() });
  });
  next();
});

// --- Routes ---
app.use(healthRoutes);
app.use('/api', apiLimiter, analyzeRoutes);
app.use('/api', apiLimiter, optimizeRoutes);

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
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

export default app;

