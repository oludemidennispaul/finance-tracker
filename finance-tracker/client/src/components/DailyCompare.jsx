import { formatMoney, formatPercent } from '../lib/format.js';

function Change({ today, yesterday }) {
  if (today === 0 && yesterday === 0) return <p className="daily-change muted">No spending yesterday or today yet.</p>;
  const diff = today - yesterday;
  if (diff === 0) return <p className="daily-change muted">Exactly the same as yesterday.</p>;

  const more = diff > 0;
  // A percentage means nothing when yesterday was zero.
  const pct = yesterday > 0 ? ` (${formatPercent(Math.abs(diff) / yesterday)})` : '';
  return (
    <p className={`daily-change ${more ? 'bad' : 'good'}`}>
      <span aria-hidden="true">{more ? '▲' : '▼'}</span>{' '}
      {formatMoney(Math.abs(diff))}{pct} {more ? 'more' : 'less'} than yesterday
    </p>
  );
}

export default function DailyCompare({ daily }) {
  if (!daily) return null;
  const { today, yesterday, byCategory, dailyAverage30 } = daily;
  const max = Math.max(1, ...byCategory.flatMap((c) => [c.today, c.yesterday]));

  return (
    <section className="card daily">
      <h2>Today vs yesterday</h2>

      <div className="daily-grid">
        <div className="daily-totals">
          <div className="daily-figures">
            <div>
              <div className="tile-label"><span className="key key-today" aria-hidden="true" /> Today so far</div>
              <div className="daily-value">{formatMoney(today.total)}</div>
              <div className="muted small">{today.count} expense{today.count === 1 ? '' : 's'}</div>
            </div>
            <div>
              <div className="tile-label"><span className="key key-yesterday" aria-hidden="true" /> Yesterday</div>
              <div className="daily-value secondary">{formatMoney(yesterday.total)}</div>
              <div className="muted small">{yesterday.count} expense{yesterday.count === 1 ? '' : 's'}</div>
            </div>
          </div>
          <Change today={today.total} yesterday={yesterday.total} />
          {dailyAverage30 > 0 && (
            <p className="muted small">Your typical day: {formatMoney(dailyAverage30)} (average of the last 30 days)</p>
          )}
        </div>

        <div className="daily-cats">
          {byCategory.length === 0 ? (
            <p className="empty">Nothing logged yesterday or today. Add an expense below.</p>
          ) : (
            <table className="compare">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">Today</th>
                  <th scope="col" className="num">Yesterday</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => {
                  const diff = c.today - c.yesterday;
                  return (
                    <tr key={c.id}>
                      <th scope="row">
                        <span>{c.name}</span>
                        <span className="pair" aria-hidden="true">
                          <span className="pair-bar today" style={{ width: `${(c.today / max) * 100}%` }} />
                          <span className="pair-bar yesterday" style={{ width: `${(c.yesterday / max) * 100}%` }} />
                        </span>
                      </th>
                      <td className="num">
                        {c.today ? formatMoney(c.today) : '–'}
                        {diff !== 0 && (
                          <span className={`cat-diff ${diff > 0 ? 'bad' : 'good'}`}>
                            {diff > 0 ? '▲' : '▼'} {formatMoney(Math.abs(diff))}
                          </span>
                        )}
                      </td>
                      <td className="num muted">{c.yesterday ? formatMoney(c.yesterday) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
