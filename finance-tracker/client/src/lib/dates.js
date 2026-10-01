const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toIso(new Date());

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toIso(d);
}

export const PERIODS = [
  { id: 'month', label: 'This month', range: () => { const d = new Date(); return [toIso(new Date(d.getFullYear(), d.getMonth(), 1)), today()]; }, granularity: 'day' },
  { id: '30d', label: 'Last 30 days', range: () => [daysAgo(29), today()], granularity: 'day' },
  { id: '90d', label: 'Last 90 days', range: () => [daysAgo(89), today()], granularity: 'week' },
  { id: 'year', label: 'This year', range: () => [`${new Date().getFullYear()}-01-01`, today()], granularity: 'month' },
];
