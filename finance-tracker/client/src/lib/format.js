const CURRENCY = import.meta.env.VITE_CURRENCY || 'NGN';
const LOCALE = import.meta.env.VITE_LOCALE || 'en-NG';

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });
const moneyExact = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
const compact = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY, notation: 'compact', maximumFractionDigits: 1 });

export const formatMoney = (n) => money.format(n ?? 0);
export const formatMoneyExact = (n) => moneyExact.format(n ?? 0);
export const formatCompact = (n) => compact.format(n ?? 0);
export const formatPercent = (n) => `${Math.round((n ?? 0) * 100)}%`;
export const currencySymbol = money.formatToParts(0).find((p) => p.type === 'currency')?.value ?? CURRENCY;

const parse = (iso) => new Date(`${iso}T00:00:00`);

export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return iso ? parse(iso).toLocaleDateString(LOCALE, opts) : '';
}

// Label for a trend bucket, depending on granularity.
export function formatPeriod(iso, granularity, { long = false } = {}) {
  const d = parse(iso);
  if (granularity === 'month') return d.toLocaleDateString(LOCALE, { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' });
  if (granularity === 'week') {
    const label = d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
    return long ? `Week of ${label}` : label;
  }
  return d.toLocaleDateString(LOCALE, long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
}
