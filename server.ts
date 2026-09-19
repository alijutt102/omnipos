import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './server/db.ts';
import { apiRouter } from './server/routes.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';

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
  try {
    await initializeDatabase();
    console.log('PostgreSQL database initialized and ready.');
  } catch (err) {
    console.error('Database initialization error:', err);
    if (isProduction) {
      process.exit(1);
    }
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
  if (!isProduction) {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Retail ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
