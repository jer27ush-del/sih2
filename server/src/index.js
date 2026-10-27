import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { prisma } from './db.js';
import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import officerRoutes from './routes/officer.js';
import monitorRoutes from './routes/monitor.js';
import analyticsRoutes from './routes/analytics.js';
import trackRoutes from './routes/track.js';

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

// Stop early in production if the signing key is missing or still the example value.
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('change-this'))) {
  console.error('Refusing to start: set a strong JWT_SECRET in server/.env');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

const WINDOW_MS = 15 * 60 * 1000;
app.use(
  '/api',
  rateLimit({
    windowMs: WINDOW_MS,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait a few minutes and try again.' },
  })
);
app.use(
  ['/api/auth/login', '/api/auth/register'],
  rateLimit({
    windowMs: WINDOW_MS,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  })
);

app.get('/api/health', async (_req, res) => {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'unavailable';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    service: 'aicte-complaint-portal',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/analytics', analyticsRoutes);

// Public tracking is open to anyone, so it has a tighter limit to slow down guessing.
app.use(
  '/api/track',
  rateLimit({
    windowMs: WINDOW_MS,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
  })
);
app.use('/api/track', trackRoutes);

// In production, the same server also serves the built React app.
const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
// Serves the built app whenever client/dist exists, so `npm start` works on a host without extra env vars.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Invalid input',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err.expose) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const server = app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
