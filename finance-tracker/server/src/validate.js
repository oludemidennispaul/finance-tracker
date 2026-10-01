// Small, dependency-free validation helpers. Each throws a ValidationError
// that the error handler turns into a 400 response.

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function requireDate(value, field) {
  if (!isValidDate(value)) throw new ValidationError(`${field} must be a date in YYYY-MM-DD format`);
  return value;
}

export function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requireDate(value, field);
}

export function requireMoney(value, field, { allowZero = false } = {}) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ValidationError(`${field} must be a number`);
  if (allowZero ? n < 0 : n <= 0) {
    throw new ValidationError(`${field} must be ${allowZero ? 'zero or more' : 'greater than zero'}`);
  }
  if (n >= 1e10) throw new ValidationError(`${field} is too large`);
  return Math.round(n * 100) / 100;
}

export function requireText(value, field, { max = 200 } = {}) {
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationError(`${field} is required`);
  if (value.trim().length > max) throw new ValidationError(`${field} must be ${max} characters or fewer`);
  return value.trim();
}

export function optionalText(value, field, { max = 500 } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return requireText(String(value), field, { max });
}

export function requireId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`${field} must be a positive integer`);
  return n;
}
