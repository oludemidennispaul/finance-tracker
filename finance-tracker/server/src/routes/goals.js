import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, localToday } from '../util.js';
import {
  isValidDate, optionalDate, requireId, requireMoney, requireText,
} from '../validate.js';
import {
  LOW_CONFIDENCE_DAYS, SPEND_WINDOW_DAYS, addDays, averageMonthlySpend, daysBetween, forecastGoals,
} from '../forecast.js';

const router = Router();

async function buildForecast(userId, today) {
  const windowStart = addDays(today, -(SPEND_WINDOW_DAYS - 1));

  const [settings, first, spent, goals] = await Promise.all([
    query('SELECT monthly_income FROM users WHERE id = $1', [userId]),
    query('SELECT MIN(spent_on) AS first FROM expenses WHERE user_id = $3 AND spent_on BETWEEN $1 AND $2', [windowStart, today, userId]),
    query('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = $3 AND spent_on BETWEEN $1 AND $2', [windowStart, today, userId]),
    query('SELECT id, name, target_amount, saved_amount, target_date FROM goals WHERE user_id = $1', [userId]),
  ]);

  const firstDate = first.rows[0].first;
  // Measure over the full window, or from the first expense if history is shorter.
  const windowDays = firstDate ? daysBetween(firstDate, today) + 1 : 0;
  const avgMonthlySpend = Math.round(averageMonthlySpend(spent.rows[0].total, windowDays) * 100) / 100;
  const monthlyIncome = settings.rows[0]?.monthly_income ?? 0;

  const { monthlySavings, goals: forecasted } = forecastGoals({
    monthlyIncome, avgMonthlySpend, goals: goals.rows, today,
  });

  return {
    today,
    monthlyIncome,
    avgMonthlySpend,
    monthlySavings,
    basis: {
      windowDays,
      lowConfidence: windowDays < LOW_CONFIDENCE_DAYS,
    },
    goals: forecasted,
  };
}

function resolveToday(req) {
  return isValidDate(req.query.today) ? req.query.today : localToday();
}

// GET /api/goals?today=YYYY-MM-DD  -> goals with forecast
router.get('/', asyncHandler(async (req, res) => {
  res.json(await buildForecast(req.user.id, resolveToday(req)));
}));

function parseGoal(body = {}) {
  const name = requireText(body.name, 'name', { max: 100 });
  const targetAmount = requireMoney(body.targetAmount, 'targetAmount');
  const savedAmount = requireMoney(body.savedAmount ?? 0, 'savedAmount', { allowZero: true });
  const targetDate = optionalDate(body.targetDate, 'targetDate');
  return [name, targetAmount, savedAmount, targetDate];
}

router.post('/', asyncHandler(async (req, res) => {
  const values = parseGoal(req.body);
  const { rows } = await query(
    `INSERT INTO goals (name, target_amount, saved_amount, target_date, user_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, name, target_amount, saved_amount, target_date`,
    [...values, req.user.id],
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = requireId(req.params.id);
  const values = parseGoal(req.body);
  const { rows } = await query(
    `UPDATE goals SET name = $1, target_amount = $2, saved_amount = $3, target_date = $4
     WHERE id = $5 AND user_id = $6 RETURNING id, name, target_amount, saved_amount, target_date`,
    [...values, id, req.user.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
  res.json(rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = requireId(req.params.id);
  const { rowCount } = await query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Goal not found' });
  res.status(204).end();
}));

// Settings live here because they only feed the forecast.
export const settingsRouter = Router();

settingsRouter.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT monthly_income FROM users WHERE id = $1', [req.user.id]);
  res.json({ monthlyIncome: rows[0]?.monthly_income ?? 0 });
}));

settingsRouter.put('/', asyncHandler(async (req, res) => {
  const monthlyIncome = requireMoney(req.body?.monthlyIncome, 'monthlyIncome', { allowZero: true });
  await query('UPDATE users SET monthly_income = $1 WHERE id = $2', [monthlyIncome, req.user.id]);
  res.json({ monthlyIncome });
}));

export default router;
