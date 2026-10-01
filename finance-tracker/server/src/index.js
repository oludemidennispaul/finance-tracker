import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { pool } from './db.js';
import auth, { loadUser, requireAuth } from './auth.js';
import categories from './routes/categories.js';
import expenses from './routes/expenses.js';
import summary from './routes/summary.js';
import goals, { settingsRouter } from './routes/goals.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Hosting platforms put a proxy in front of the app. Trusting it lets
// Express see HTTPS (for secure cookies) and the real client IP (for rate limits).
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
});
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

app.use('/api', loadUser);
app.use('/api/auth', auth);
app.use('/api/categories', requireAuth, categories);
app.use('/api/expenses', requireAuth, expenses);
app.use('/api/summary', requireAuth, summary);
app.use('/api/goals', requireAuth, goals);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app from the same origin.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
});

app.listen(PORT, () => console.log(`App listening on http://localhost:${PORT}`));
