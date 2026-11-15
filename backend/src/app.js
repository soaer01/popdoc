import express, { Router } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import branchRoutes from './routes/branches.js';
import historyRoutes from './routes/history.js';
import pullRoutes from './routes/pulls.js';
import aiRoutes from './routes/ai.js';
import ledgerRoutes from './routes/ledger.js';

export const app = express();

// CORS setup to allow credentials from Vite frontend
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Main API router
const apiRouter = Router();

// Apply auth middleware to all API routes
apiRouter.use(authMiddleware);

// Mount resource routers
apiRouter.use('/auth', authRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/', branchRoutes);
apiRouter.use('/', historyRoutes);
apiRouter.use('/', pullRoutes);
apiRouter.use('/', aiRoutes);
apiRouter.use('/', ledgerRoutes);

// Mount router under /api (for Vite proxy / VITE_API_URL) and root / for direct calls
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal server error.' });
});
