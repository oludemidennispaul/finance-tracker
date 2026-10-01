// Accounts and sessions.
//
// Passwords are hashed with scrypt (built into Node, no extra dependency).
// Signing in creates a random session token, sent to the browser in an
// HttpOnly cookie; only its SHA-256 hash is stored in the database.

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { pool, query } from './db.js';
import { asyncHandler } from './util.js';
import { ValidationError, optionalText, requireText } from './validate.js';

const scrypt = promisify(crypto.scrypt);

export const SESSION_COOKIE = 'ft_session';
const SESSION_DAYS = 30;
const MIN_PASSWORD = 8;

export const DEFAULT_CATEGORIES = [
  'Food & Groceries', 'Transport', 'Housing', 'Utilities',
  'Health', 'Entertainment', 'Shopping', 'Other',
];

// ---------- passwords ----------

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// A fixed hash to compare against when the email doesn't exist, so a wrong
// email takes as long as a wrong password and doesn't reveal who has an account.
const dummyHashPromise = hashPassword(crypto.randomBytes(16).toString('hex'));

// ---------- sessions ----------

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), userId, expires]);
  // Opportunistic cleanup of expired sessions.
  query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
  return { token, expires };
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSessionCookie(req, res, token, expires) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    expires,
    path: '/',
  });
}

/** Attaches req.user if the request carries a valid session cookie. */
export const loadUser = asyncHandler(async (req, _res, next) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const { rows } = await query(
      `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)],
    );
    if (rows[0]) req.user = rows[0];
  }
  next();
});

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  next();
}

// ---------- brute-force protection ----------

// In-memory limiter: plenty for a single small server. Resets on restart.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function tooManyAttempts(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(key, { first: now, count: 1 });
  else entry.count += 1;
  if (attempts.size > 10_000) attempts.clear();
}

// ---------- validation ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmail(value) {
  const email = requireText(value, 'Email', { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError('Enter a valid email address');
  return email;
}

function parsePassword(value) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD} characters`);
  }
  if (value.length > 200) throw new ValidationError('Password is too long');
  return value;
}

const signupCode = () => (process.env.SIGNUP_CODE || '').trim();

// ---------- account setup ----------

/** Creates a user with the default categories. */
export async function createUser({ email, password, name }, { claimLegacyData = true } = {}) {
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialise sign-ups so two can't claim the same legacy data or email.
    await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');

    const existing = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (existing.rowCount) throw new ValidationError('An account with this email already exists');

    const { rows: [user] } = await client.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, name, passwordHash],
    );

    // Data from before accounts existed has no owner. The first person to
    // sign up afterwards takes it over (with the income they had set).
    if (claimLegacyData) {
      let claimed = 0;
      for (const table of ['categories', 'expenses', 'goals']) {
        const r = await client.query(`UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`, [user.id]);
        claimed += r.rowCount;
      }
      const legacy = await client.query("SELECT to_regclass('public.settings') IS NOT NULL AS present");
      if (claimed > 0 && legacy.rows[0].present) {
        await client.query(
          'UPDATE users SET monthly_income = COALESCE((SELECT monthly_income FROM settings WHERE id = 1), 0) WHERE id = $1',
          [user.id],
        );
      }
    }

    await client.query(
      `INSERT INTO categories (user_id, name) SELECT $1, unnest($2::text[])
       ON CONFLICT (user_id, name) WHERE user_id IS NOT NULL DO NOTHING`,
      [user.id, DEFAULT_CATEGORIES],
    );

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- routes ----------

const router = Router();

router.get('/config', (_req, res) => {
  res.json({ signupCodeRequired: Boolean(signupCode()) });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  res.json(req.user);
});

router.post('/signup', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const ipKey = `signup:${req.ip}`;
  if (tooManyAttempts(ipKey)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });

  const code = signupCode();
  if (code && String(body.inviteCode || '').trim() !== code) {
    recordFailure(ipKey);
    throw new ValidationError('That invite code is not correct');
  }

  const user = await createUser({
    email: parseEmail(body.email),
    password: parsePassword(body.password),
    name: optionalText(body.name, 'Name', { max: 80 }),
  });

  const { token, expires } = await createSession(user.id);
  setSessionCookie(req, res, token, expires);
  res.status(201).json(user);
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const key = `login:${req.ip}:${email}`;
  if (tooManyAttempts(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });

  const { rows } = await query('SELECT id, email, name, password_hash FROM users WHERE lower(email) = $1', [email]);
  const user = rows[0];
  const ok = await verifyPassword(String(body.password || ''), user ? user.password_hash : await dummyHashPromise);
  if (!user || !ok) {
    recordFailure(key);
    return res.status(401).json({ error: 'Email or password is incorrect' });
  }

  attempts.delete(key);
  const { token, expires } = await createSession(user.id);
  setSessionCookie(req, res, token, expires);
  res.json({ id: user.id, email: user.email, name: user.name });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(204).end();
}));

router.post('/password', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await verifyPassword(String(body.currentPassword || ''), rows[0].password_hash))) {
    throw new ValidationError('Current password is incorrect');
  }
  const newHash = await hashPassword(parsePassword(body.newPassword));
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
  // Sign out every other device.
  await query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [req.user.id, hashToken(readCookie(req, SESSION_COOKIE))]);
  res.status(204).end();
}));

export default router;
