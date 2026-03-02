import express from 'express';
import { register, httpRequestCounter, httpRequestDuration } from './services/metrics';
import healthRoutes from './routes/health';
import analyzeRoutes from './routes/analyze';
import optimizeRoutes from './routes/optimize';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
app.use('/api', analyzeRoutes);
app.use('/api', optimizeRoutes);

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
