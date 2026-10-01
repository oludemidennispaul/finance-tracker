// Creates (or resets) a demo account with ~4 months of sample expenses, a
// monthly income and two goals, so you can see the dashboard with data.
// Only the demo account is touched; other users' data is left alone.
//
//   Email:    demo@example.com
//   Password: demo12345
import { pool } from '../src/db.js';
import { localToday } from '../src/util.js';
import { addDays } from '../src/forecast.js';
import { createUser, hashPassword } from '../src/auth.js';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo12345';

// Deterministic pseudo-random numbers so every seed looks the same.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (min, max) => Math.round((min + rand() * (max - min)) / 50) * 50;

if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.log('Refusing to create a demo account with a public password in production. Pass --force to override.');
  process.exit(0);
}

let userId;
const found = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [DEMO_EMAIL]);
if (found.rows[0]) {
  userId = found.rows[0].id;
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(DEMO_PASSWORD), userId]);
} else {
  // The demo account never takes over data from before accounts existed.
  userId = (await createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, name: 'Demo' }, { claimLegacyData: false })).id;
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('DELETE FROM expenses WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM goals WHERE user_id = $1', [userId]);

  const { rows: cats } = await client.query('SELECT id, name FROM categories WHERE user_id = $1', [userId]);
  const id = Object.fromEntries(cats.map((c) => [c.name, c.id]));
  const today = localToday();
  const rows = [];

  for (let i = 120; i >= 0; i--) {
    const day = addDays(today, -i);
    const dom = Number(day.slice(8, 10));
    if (rand() < 0.85) rows.push([between(2500, 9000), id['Food & Groceries'], 'Groceries / meals', day]);
    if (rand() < 0.6) rows.push([between(1000, 4000), id.Transport, 'Ride / fuel', day]);
    if (dom === 1) rows.push([250000, id.Housing, 'Rent', day]);
    if (dom === 5) rows.push([between(25000, 40000), id.Utilities, 'Electricity, internet, water', day]);
    if (rand() < 0.08) rows.push([between(5000, 30000), id.Entertainment, 'Outing', day]);
    if (rand() < 0.07) rows.push([between(8000, 60000), id.Shopping, 'Shopping', day]);
    if (rand() < 0.03) rows.push([between(5000, 25000), id.Health, 'Pharmacy', day]);
    if (rand() < 0.05) rows.push([between(2000, 15000), id.Other, null, day]);
  }

  for (const r of rows) {
    await client.query(
      'INSERT INTO expenses (amount, category_id, description, spent_on, user_id) VALUES ($1, $2, $3, $4, $5)',
      [...r, userId],
    );
  }

  await client.query('UPDATE users SET monthly_income = 850000 WHERE id = $1', [userId]);
  await client.query(
    `INSERT INTO goals (name, target_amount, saved_amount, target_date, user_id) VALUES
       ('Emergency fund', 1500000, 400000, $1, $2),
       ('New laptop', 1200000, 150000, NULL, $2)`,
    [addDays(today, 240), userId],
  );

  await client.query('COMMIT');
  console.log(`Demo account ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (${rows.length} expenses, 2 goals).`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
