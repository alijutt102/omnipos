process.on('uncaughtException', (err) => {
  console.error('FATAL: Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './server/db.ts';
import { apiRouter } from './server/routes.ts';

async function startServer() {
  console.error('startServer() invoked - beginning startup sequence...');

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  console.error(`Startup config: NODE_ENV=${process.env.NODE_ENV}, PORT=${PORT}, DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'not set'}`);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Allow cross-origin requests for local frontend/backend separation
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Initialize PostgreSQL schema and seed demo data
  console.error(`About to initialize database. NODE_ENV=${process.env.NODE_ENV}, DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'not set'}`);
  try {
    await initializeDatabase();
    console.log('PostgreSQL database initialized and ready.');
  } catch (err) {
    console.error('Database initialization error:', err);
  }

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: process.env.DATABASE_URL ? 'PostgreSQL (Remote Pool)' : 'PostgreSQL (Embedded PGlite)',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Vite middleware for development / Static assets for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  console.error(`Starting HTTP listener on port ${PORT}...`);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Retail ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('FATAL: startServer() failed to start:', err);
  process.exit(1);
});
