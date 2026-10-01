-- Finance Tracker schema (PostgreSQL 13+)
-- Safe to run more than once: every statement is idempotent, and it upgrades
-- databases created by the earlier single-user version.

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  email           TEXT          NOT NULL,
  name            TEXT,
  password_hash   TEXT          NOT NULL,
  monthly_income  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_income >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));

-- Only a hash of each session token is stored, so a leaked database
-- cannot be used to sign in as someone.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT        PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER       REFERENCES users(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id  INTEGER       NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description  TEXT,
  spent_on     DATE          NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER       REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT          NOT NULL,
  target_amount  NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  saved_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  target_date    DATE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Upgrade path from the single-user version: add owners to existing tables.
-- Rows without an owner are claimed by the first account that signs up.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE expenses   ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE goals      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Category names are unique per user (NULLS NOT DISTINCT needs PG15, so
-- unowned legacy rows are covered by a separate index).
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name ON categories (user_id, name) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS categories_unowned_name ON categories (name) WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);

DROP INDEX IF EXISTS idx_expenses_spent_on;
