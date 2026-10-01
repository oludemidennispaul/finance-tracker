import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact, formatMoney, formatPeriod } from '../lib/format.js';

const GRANULARITIES = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

function TrendTooltip({ active, payload, granularity }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="tooltip-label">{formatPeriod(point.period, granularity, { long: true })}</div>
      <div className="tooltip-value">{formatMoney(point.total)}</div>
    </div>
  );
}

export default function TrendChart({ summary, granularity, onGranularity }) {
  const data = summary?.trend ?? [];
  const average = data.length ? data.reduce((s, d) => s + d.total, 0) / data.length : 0;
  const hasData = data.some((d) => d.total > 0);
  const unit = { day: 'day', week: 'week', month: 'month' }[granularity];

  return (
    <section className="card">
      <div className="card-head">
        <h2>Spending over time</h2>
        <div className="segmented small" role="tablist" aria-label="Group by">
          {GRANULARITIES.map((g) => (
            <button
              key={g.id} role="tab" aria-selected={g.id === granularity}
              className={g.id === granularity ? 'active' : ''} onClick={() => onGranularity(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <>
          <p className="chart-note">
            <span className="avg-swatch" aria-hidden="true" /> Average {formatMoney(average)} per {unit}
          </p>
          <div className="chart" role="img" aria-label={`Bar chart of spending per ${unit}`}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={data.length > 40 ? 1 : '20%'}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis
                  dataKey="period" tickFormatter={(v) => formatPeriod(v, granularity)}
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--axis)' }}
                  tickLine={false} minTickGap={16}
                />
                <YAxis
                  tickFormatter={formatCompact} width={64}
                  tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false}
                />
                <Tooltip content={<TrendTooltip granularity={granularity} />} cursor={{ fill: 'var(--hover-wash)' }} />
                <ReferenceLine y={average} stroke="var(--text-secondary)" strokeDasharray="4 4" />
                <Bar dataKey="total" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="empty">No spending in this period yet. Add an expense to see the trend.</p>
      )}
    </section>
  );
}
