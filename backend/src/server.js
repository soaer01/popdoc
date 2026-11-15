import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';
import { connectDB } from './config/db.js';
import { seedDatabaseIfEmpty } from './utils/store.js';

const PORT = process.env.PORT || 4000;

async function startServer() {
  // Connect Mongoose to MongoDB
  await connectDB();
  await seedDatabaseIfEmpty();

  const server = app.listen(PORT, () => {
    console.log(`[Server] PopDoc backend server running on http://localhost:${PORT}`);
    console.log(`[Server] API endpoints available at http://localhost:${PORT}/api and http://localhost:${PORT}/`);
  });

  const shutdown = () => {
    console.log('[Server] Gracefully shutting down...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('[Server] Failed to start server:', err);
});
