import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import authRouter from './routes/auth';
import analysisRouter from './routes/analysis';
import historyRouter from './routes/history';
import patientsRouter from './routes/patients';
import inventoryRouter from './routes/inventory';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// CORS configuration with credentials support
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);
    callback(null, true);
  },
  credentials: true
}));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/analyses', analysisRouter);
app.use('/api/history', historyRouter);
app.use('/api/dashboard', historyRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/inventory', inventoryRouter);

// Healthcheck endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'RxGuardian AI', timestamp: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RxGuardian AI] Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
