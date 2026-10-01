import pg from 'pg';
import 'dotenv/config';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Dates,
// so a date never shifts by a day because of the server's time zone.
pg.types.setTypeParser(1082, (value) => value);
// Return NUMERIC columns as JS numbers. Amounts are NUMERIC(12,2), well within
// the range a double represents exactly to the cent.
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://finance:finance@localhost:5432/finance',
});

export const query = (text, params) => pool.query(text, params);
