import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../util.js';
import {
  ValidationError, optionalDate, optionalText, requireDate, requireId, requireMoney,
} from '../validate.js';

const router = Router();

const SELECT = `
  SELECT e.id, e.amount, e.description, e.spent_on, e.category_id, c.name AS category
  FROM expenses e JOIN categories c ON c.id = e.category_id`;

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50
router.get('/', asyncHandler(async (req, res) => {
  const from = optionalDate(req.query.from, 'from');
  const to = optionalDate(req.query.to, 'to');
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);

  const where = ['e.user_id = $1'];
  const params = [req.user.id];
  if (from) { params.push(from); where.push(`e.spent_on >= $${params.length}`); }
  if (to) { params.push(to); where.push(`e.spent_on <= $${params.length}`); }
  params.push(limit);

  const { rows } = await query(
    `${SELECT} WHERE ${where.join(' AND ')}
     ORDER BY e.spent_on DESC, e.id DESC LIMIT $${params.length}`,
    params,
  );
  res.json(rows);
}));

async function parseExpense(body = {}, userId) {
  const amount = requireMoney(body.amount, 'amount');
  const categoryId = requireId(body.categoryId, 'categoryId');
  const spentOn = requireDate(body.spentOn, 'spentOn');
  const description = optionalText(body.description, 'description', { max: 500 });

  const cat = await query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId]);
  if (cat.rowCount === 0) throw new ValidationError('categoryId does not match an existing category');
  return [amount, categoryId, description, spentOn];
}

router.post('/', asyncHandler(async (req, res) => {
  const values = await parseExpense(req.body, req.user.id);
  const { rows } = await query(
    `WITH ins AS (
       INSERT INTO expenses (amount, category_id, description, spent_on, user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *)
     SELECT ins.id, ins.amount, ins.description, ins.spent_on, ins.category_id, c.name AS category
     FROM ins JOIN categories c ON c.id = ins.category_id`,
    [...values, req.user.id],
  );
  res.status(201).json(rows[0]);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = requireId(req.params.id);
  const values = await parseExpense(req.body, req.user.id);
  const { rowCount } = await query(
    `UPDATE expenses SET amount = $1, category_id = $2, description = $3, spent_on = $4
     WHERE id = $5 AND user_id = $6`,
    [...values, id, req.user.id],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Expense not found' });
  const { rows } = await query(`${SELECT} WHERE e.id = $1 AND e.user_id = $2`, [id, req.user.id]);
  res.json(rows[0]);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = requireId(req.params.id);
  const { rowCount } = await query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rowCount === 0) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).end();
}));

export default router;
