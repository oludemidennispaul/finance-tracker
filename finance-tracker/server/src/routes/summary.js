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

export default router;
