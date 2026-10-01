# Finance Tracker

A small personal finance app: log daily expenses, see where the money goes, and get a projection of when you'll reach your savings goals.

- **Frontend:** React 18 + Vite, Recharts for the trend chart
- **Backend:** Node.js + Express REST API
- **Database:** PostgreSQL

## Run it locally

You need **Node.js 18+** and **PostgreSQL 13+** (or Docker to run Postgres for you).

### 1. Start PostgreSQL

With Docker (easiest):

```bash
docker compose up -d
```

Or with an existing Postgres install, create the database and user:

```sql
CREATE USER finance WITH PASSWORD 'finance';
CREATE DATABASE finance OWNER finance;
```

### 2. Start the API

```bash
cd server
cp .env.example .env      # edit DATABASE_URL if your Postgres differs
npm install
npm run migrate           # creates tables and default categories
npm run seed              # optional: ~4 months of sample data
npm run dev               # API on http://localhost:4000
```

### 3. Start the frontend (second terminal)

```bash
cd client
npm install
npm run dev               # app on http://localhost:5173
```

Open http://localhost:5173. Vite forwards `/api` calls to the API on port 4000.

### Production-style single server

```bash
cd client && npm run build
cd ../server && npm start  # serves the API and the built app on http://localhost:4000
```

### Settings

| Where | Variable | Default | Purpose |
|---|---|---|---|
| `server/.env` | `DATABASE_URL` | `postgres://finance:finance@localhost:5432/finance` | Postgres connection |
| `server/.env` | `PORT` | `4000` | API port |
| `client/.env` | `VITE_CURRENCY` | `NGN` | Currency code used to format amounts |
| `client/.env` | `VITE_LOCALE` | `en-NG` | Number and date formatting |

### Tests

```bash
cd server && npm test     # unit tests for the forecasting logic
```

## What the app does

**Expense logging.** Amount, category, date and an optional note. You can add a new category from the dropdown. Expenses can be deleted from the list.

**Breakdown.** Pick a period (this month, last 30 days, last 90 days, this year). The dashboard shows total spent with the change against the previous period of the same length, daily average, top category, spending per category, and a trend chart you can group by day, week or month. Days with no spending show as zero rather than being skipped.

**Goal forecasting.** Enter your monthly income once. The app works out:

```
monthly savings = monthly income − average monthly spending (last 90 days)
```

Goals are funded one at a time: goals with a target date first (earliest first), then undated goals in the order you created them. Each goal shows its projected completion date. Goals with a target date also show the monthly amount needed to hit it and whether you're on track. If spending is at or above income, the app says the goal isn't reachable at the current rate instead of showing a date. With under two weeks of history it flags the estimate as early.

## Architecture

```
client/  React SPA ──fetch /api──▶  server/  Express ──pg──▶  PostgreSQL
```

```
server/
  db/schema.sql          tables, indexes, default categories (idempotent)
  scripts/migrate.js     applies schema.sql
  scripts/seed.js        sample data (refuses to overwrite unless --force)
  src/index.js           app setup, error handling, serves client/dist in production
  src/db.js              connection pool and type parsing
  src/validate.js        input validation
  src/forecast.js        goal projection maths (pure functions, unit tested)
  src/routes/            categories, expenses, summary, goals + settings
client/src/
  App.jsx                page layout and data loading
  components/            StatTiles, ExpenseForm, TrendChart, CategoryBreakdown, ExpenseList, Goals
  lib/                   API client, money/date formatting, period presets
```

### Data model

| Table | Columns |
|---|---|
| `categories` | `id`, `name` (unique) |
| `expenses` | `id`, `amount` NUMERIC(12,2) > 0, `category_id` → categories, `description`, `spent_on` DATE |
| `goals` | `id`, `name`, `target_amount`, `saved_amount`, `target_date` (optional) |
| `settings` | single row: `monthly_income` |

### API

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/categories` | |
| GET | `/api/expenses?from&to&limit` | newest first |
| POST / PUT / DELETE | `/api/expenses/:id` | body: `amount, categoryId, spentOn, description` |
| GET | `/api/summary?from&to&granularity=day\|week\|month` | totals, by category, trend, previous-period total |
| GET | `/api/goals?today=YYYY-MM-DD` | goals with forecast |
| POST / PUT / DELETE | `/api/goals/:id` | body: `name, targetAmount, savedAmount, targetDate` |
| GET / PUT | `/api/settings` | `monthlyIncome` |
| GET | `/api/health` | checks the database connection |

## Why these choices

- **PostgreSQL** because expenses are relational and the useful questions are aggregates (sum by category, by week). SQL does that in one query, including filling empty days with `generate_series`. Money is stored as `NUMERIC`, never floating point.
- **Express** because the API is a handful of CRUD routes plus two aggregate endpoints. It needs no framework beyond routing, JSON and error handling.
- **React + Vite** for fast local development and a single static build that Express can serve.
- **Forecasting on the server** in a pure module, so the maths is tested independently of the database and UI.
- **Dates as plain `YYYY-MM-DD` strings** end to end, so an expense never moves to the wrong day because of time zones.

## Deliberate limits of this first version

- Single user, no login. Add authentication and a `user_id` column on each table before putting it on the internet.
- Income is one monthly figure, not a log of income entries.
- The forecast assumes your recent average spending continues. It does not model one-off big purchases or seasonal patterns.
- Expenses can be deleted but not edited in the UI (the API already supports `PUT`).
