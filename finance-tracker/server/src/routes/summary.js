import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../util.js';
import { ValidationError, requireDate } from '../validate.js';
import { addDays, daysBetween } from '../forecast.js';

const router = Router();
const GRANULARITIES = new Set(['day', 'week', 'month']);
const MAX_RANGE_DAYS = 3660;

// GET /api/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month
router.get('/', asyncHandler(async (req, res) => {
  const from = requireDate(req.query.from, 'from');
  const to = requireDate(req.query.to, 'to');
  const granularity = req.query.granularity || 'day';
  if (!GRANULARITIES.has(granularity)) throw new ValidationError('granularity must be day, week or month');
  if (from > to) throw new ValidationError('from must be on or before to');

  const rangeDays = daysBetween(from, to) + 1;
  if (rangeDays > MAX_RANGE_DAYS) throw new ValidationError('Date range is too long (max 10 years)');

  // The equally long window immediately before this one, for comparison.
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -rangeDays);
  const uid = req.user.id;

  const [totals, previous, byCategory, trend] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
       FROM expenses WHERE user_id = $3 AND spent_on BETWEEN $1 AND $2`,
      [from, to, uid],
    ),
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = $3 AND spent_on BETWEEN $1 AND $2`,
      [prevFrom, prevTo, uid],
    ),
    query(
      `SELECT c.id, c.name, SUM(e.amount) AS total, COUNT(*)::int AS count
       FROM expenses e JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = $3 AND e.spent_on BETWEEN $1 AND $2
       GROUP BY c.id, c.name
       ORDER BY total DESC, c.name`,
      [from, to, uid],
    ),
    // One row per period in the range, including periods with no spending.
    query(
      `WITH periods AS (
         SELECT generate_series(
           date_trunc($3, $1::date::timestamp),
           date_trunc($3, $2::date::timestamp),
           ('1 ' || $3)::interval
         )::date AS period
       )
       SELECT to_char(p.period, 'YYYY-MM-DD') AS period, COALESCE(SUM(e.amount), 0) AS total
       FROM periods p
       LEFT JOIN expenses e
         ON date_trunc($3, e.spent_on::timestamp)::date = p.period
        AND e.spent_on BETWEEN $1 AND $2
        AND e.user_id = $4
       GROUP BY p.period
       ORDER BY p.period`,
      [from, to, granularity, uid],
    ),
  ]);

  const total = totals.rows[0].total;
  res.json({
    from,
    to,
    granularity,
    total,
    count: totals.rows[0].count,
    dailyAverage: Math.round((total / rangeDays) * 100) / 100,
    previousTotal: previous.rows[0].total,
    byCategory: byCategory.rows.map((r) => ({ ...r, share: total ? r.total / total : 0 })),
    trend: trend.rows,
  });
}));

// GET /api/summary/daily?date=YYYY-MM-DD
// Compares one day (the user's "today", sent by the browser so it matches
// their time zone) with the day before, overall and per category.
router.get('/daily', asyncHandler(async (req, res) => {
  const today = requireDate(req.query.date, 'date');
  const yesterday = addDays(today, -1);
  const avgFrom = addDays(today, -30);
  const uid = req.user.id;

  const [days, byCategory, avg] = await Promise.all([
    query(
      `SELECT spent_on, SUM(amount) AS total, COUNT(*)::int AS count
       FROM expenses WHERE user_id = $1 AND spent_on IN ($2, $3)
       GROUP BY spent_on`,
      [uid, today, yesterday],
    ),
    query(
      `SELECT c.id, c.name,
              COALESCE(SUM(e.amount) FILTER (WHERE e.spent_on = $2), 0) AS today,
              COALESCE(SUM(e.amount) FILTER (WHERE e.spent_on = $3), 0) AS yesterday
       FROM expenses e JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = $1 AND e.spent_on IN ($2, $3)
       GROUP BY c.id, c.name
       ORDER BY GREATEST(SUM(e.amount) FILTER (WHERE e.spent_on = $2), SUM(e.amount) FILTER (WHERE e.spent_on = $3)) DESC NULLS LAST, c.name`,
      [uid, today, yesterday],
    ),
    // Average over the 30 days before today, counting days with no spending as zero.
    query(
      `SELECT COALESCE(SUM(amount), 0) / 30.0 AS average
       FROM expenses WHERE user_id = $1 AND spent_on BETWEEN $2 AND $3`,
      [uid, avgFrom, yesterday],
    ),
  ]);

  const day = (date) => {
    const row = days.rows.find((r) => r.spent_on === date);
    return { date, total: row ? row.total : 0, count: row ? row.count : 0 };
  };

  res.json({
    today: day(today),
    yesterday: day(yesterday),
    byCategory: byCategory.rows,
    dailyAverage30: Math.round(Number(avg.rows[0].average) * 100) / 100,
  });
}));

export default router;
