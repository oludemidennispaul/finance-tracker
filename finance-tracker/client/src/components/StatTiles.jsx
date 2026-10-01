import { formatMoney, formatPercent } from '../lib/format.js';

function Delta({ current, previous }) {
  if (!previous) return <span className="muted">No earlier data to compare</span>;
  const change = (current - previous) / previous;
  const up = change > 0;
  // For spending, going down is the good direction.
  return (
    <span className={up ? 'delta bad' : 'delta good'}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {formatPercent(Math.abs(change))} {up ? 'more' : 'less'} than previous period
    </span>
  );
}

export default function StatTiles({ summary, forecast }) {
  const top = summary?.byCategory?.[0];
  const savings = forecast?.monthlySavings;

  return (
    <section className="tiles" aria-label="Key figures">
      <div className="tile">
        <div className="tile-label">Spent</div>
        <div className="tile-value">{summary ? formatMoney(summary.total) : '–'}</div>
        <div className="tile-sub">{summary && <Delta current={summary.total} previous={summary.previousTotal} />}</div>
      </div>
      <div className="tile">
        <div className="tile-label">Daily average</div>
        <div className="tile-value">{summary ? formatMoney(summary.dailyAverage) : '–'}</div>
        <div className="tile-sub muted">{summary ? `${summary.count} expenses logged` : ''}</div>
      </div>
      <div className="tile">
        <div className="tile-label">Top category</div>
        <div className="tile-value">{top ? top.name : '–'}</div>
        <div className="tile-sub muted">{top ? `${formatMoney(top.total)} · ${formatPercent(top.share)} of spending` : 'Nothing logged yet'}</div>
      </div>
      <div className="tile">
        <div className="tile-label">Monthly savings</div>
        <div className={`tile-value ${savings < 0 ? 'negative' : ''}`}>{forecast ? formatMoney(savings) : '–'}</div>
        <div className="tile-sub muted">
          {forecast && (forecast.monthlyIncome > 0 ? 'Income minus average monthly spending' : 'Set your income below to see this')}
        </div>
      </div>
    </section>
  );
}
