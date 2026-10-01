import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../util.js';
import { requireText, ValidationError } from '../validate.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, name FROM categories WHERE user_id = $1 ORDER BY name', [req.user.id]);
  res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const name = requireText(req.body?.name, 'name', { max: 50 });
  const { rows } = await query(
    `INSERT INTO categories (user_id, name) VALUES ($1, $2)
     ON CONFLICT (user_id, name) WHERE user_id IS NOT NULL DO NOTHING RETURNING id, name`,
    [req.user.id, name],
  );
  if (rows.length === 0) throw new ValidationError(`Category "${name}" already exists`);
  res.status(201).json(rows[0]);
}));

export default router;
