// Loads ~4 months of sample expenses, a monthly income and two goals so the
// dashboard has something to show. Refuses to run on a database that already
// has expenses unless you pass --force (which deletes existing expenses and goals).
import { pool } from '../src/db.js';
import { localToday } from '../src/util.js';
import { addDays } from '../src/forecast.js';

const force = process.argv.includes('--force');

// Deterministic pseudo-random numbers so every seed looks the same.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (min, max) => Math.round((min + rand() * (max - min)) / 50) * 50;

const client = await pool.connect();
try {
  const { rows: [{ count }] } = await client.query('SELECT COUNT(*)::int AS count FROM expenses');
  if (count > 0 && !force) {
    console.log(`Database already has ${count} expenses. Re-run with --force to replace them with sample data.`);
    process.exit(0);
  }

  await client.query('BEGIN');
  await client.query('DELETE FROM expenses');
  await client.query('DELETE FROM goals');

  const { rows: cats } = await client.query('SELECT id, name FROM categories');
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
      'INSERT INTO expenses (amount, category_id, description, spent_on) VALUES ($1, $2, $3, $4)', r,
    );
  }

  await client.query('UPDATE settings SET monthly_income = 850000, updated_at = now() WHERE id = 1');
  await client.query(
    `INSERT INTO goals (name, target_amount, saved_amount, target_date) VALUES
       ('Emergency fund', 1500000, 400000, $1),
       ('New laptop', 1200000, 150000, NULL)`,
    [addDays(today, 240)],
  );

  await client.query('COMMIT');
  console.log(`Seeded ${rows.length} expenses, monthly income and 2 goals.`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
