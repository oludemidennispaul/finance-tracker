import { formatMoney, formatPercent } from '../lib/format.js';

export default function CategoryBreakdown({ summary }) {
  const rows = summary?.byCategory ?? [];
  const max = rows[0]?.total || 1;

  return (
    <section className="card">
      <h2>By category</h2>
      {rows.length === 0 ? (
        <p className="empty">No spending in this period yet.</p>
      ) : (
        <ul className="bars">
          {rows.map((r) => (
            <li key={r.id} title={`${r.name}: ${formatMoney(r.total)} across ${r.count} expense${r.count === 1 ? '' : 's'}`}>
              <div className="bar-label">
                <span>{r.name}</span>
                <span className="bar-value">
                  {formatMoney(r.total)} <span className="muted">· {formatPercent(r.share)}</span>
                </span>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${Math.max((r.total / max) * 100, 1)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
