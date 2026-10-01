import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../util.js';
import { requireText, ValidationError } from '../validate.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT id, name FROM categories ORDER BY name');
  res.json(rows);
}));

router.post('/', asyncHandler(async (req, res) => {
  const name = requireText(req.body?.name, 'name', { max: 50 });
  const { rows } = await query(
    'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id, name',
    [name],
  );
  if (rows.length === 0) throw new ValidationError(`Category "${name}" already exists`);
  res.status(201).json(rows[0]);
}));

export default router;
