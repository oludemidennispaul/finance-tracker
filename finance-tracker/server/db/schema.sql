-- Finance Tracker schema (PostgreSQL 13+)
-- Safe to run more than once: every statement is idempotent.

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL PRIMARY KEY,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id  INTEGER       NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description  TEXT,
  spent_on     DATE          NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_spent_on ON expenses (spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);

CREATE TABLE IF NOT EXISTS goals (
  id             SERIAL PRIMARY KEY,
  name           TEXT          NOT NULL,
  target_amount  NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  saved_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  target_date    DATE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Single-row table holding the user's budget settings.
CREATE TABLE IF NOT EXISTS settings (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_income  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_income >= 0),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (name) VALUES
  ('Food & Groceries'), ('Transport'), ('Housing'), ('Utilities'),
  ('Health'), ('Entertainment'), ('Shopping'), ('Other')
ON CONFLICT (name) DO NOTHING;
