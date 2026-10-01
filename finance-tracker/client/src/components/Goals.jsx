import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { today } from '../lib/dates.js';
import { currencySymbol, formatDate, formatMoney, formatPercent } from '../lib/format.js';

function StatusBadge({ goal }) {
  if (goal.status === 'reached') return <span className="badge good">✓ Reached</span>;
  if (goal.status === 'unreachable') return <span className="badge critical">✕ Not reachable at current rate</span>;
  if (goal.target_date && !goal.onTrack) return <span className="badge warning">! Behind target date</span>;
  if (goal.target_date) return <span className="badge good">✓ On track</span>;
  return null;
}

function monthsLabel(m) {
  if (m < 1) return 'within a month';
  return `in about ${m} month${m === 1 ? '' : 's'}`;
}

function GoalCard({ goal, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const payload = (overrides) => ({
    name: goal.name,
    targetAmount: goal.target_amount,
    savedAmount: goal.saved_amount,
    targetDate: goal.target_date,
    ...overrides,
  });

  async function addSavings(e) {
    e.preventDefault();
    try {
      await api.updateGoal(goal.id, payload({ savedAmount: goal.saved_amount + Number(amount) }));
      setAmount('');
      setAdding(false);
      setError('');
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the goal "${goal.name}"?`)) return;
    try {
      await api.deleteGoal(goal.id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <article className="goal">
      <div className="goal-head">
        <h3>{goal.name}</h3>
        <button className="icon-btn" onClick={remove} aria-label={`Delete goal ${goal.name}`}>×</button>
      </div>

      <div className="goal-amounts">
        <strong>{formatMoney(goal.saved_amount)}</strong>
        <span className="muted"> of {formatMoney(goal.target_amount)} · {formatPercent(goal.progress)}</span>
      </div>
      <div
        className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(goal.progress * 100)} aria-label={`${goal.name} progress`}
      >
        <div className="progress-fill" style={{ width: `${goal.progress * 100}%` }} />
      </div>

      <div className="goal-forecast">
        {goal.status === 'projected' && (
          <p>
            Projected <strong>{formatDate(goal.projectedDate, { month: 'long', year: 'numeric' })}</strong>{' '}
            <span className="muted">({monthsLabel(goal.monthsToGo)})</span>
          </p>
        )}
        {goal.status === 'unreachable' && (
          <p className="muted">You&rsquo;re spending as much as you earn, so nothing is left over for this goal.</p>
        )}
        {goal.target_date && goal.status !== 'reached' && (
          <p className="muted small">
            Target {formatDate(goal.target_date)}
            {goal.requiredMonthly ? ` · needs ${formatMoney(goal.requiredMonthly)}/month` : ' · target date has passed'}
          </p>
        )}
        <StatusBadge goal={goal} />
      </div>

      {goal.status !== 'reached' && (adding ? (
        <form className="inline-form" onSubmit={addSavings}>
          <input
            type="number" min="0.01" step="0.01" required autoFocus inputMode="decimal"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder={`Amount (${currencySymbol})`} aria-label="Amount to add to savings"
          />
          <button className="primary" type="submit">Add</button>
          <button type="button" className="link" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button className="secondary" onClick={() => setAdding(true)}>Add savings</button>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

function NewGoalForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', targetAmount: '', savedAmount: '', targetDate: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    try {
      await api.addGoal({
        name: form.name,
        targetAmount: Number(form.targetAmount),
        savedAmount: Number(form.savedAmount || 0),
        targetDate: form.targetDate || null,
      });
      setForm({ name: '', targetAmount: '', savedAmount: '', targetDate: '' });
      setError('');
      await onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="goal goal-new form" onSubmit={submit}>
      <h3>New goal</h3>
      <label className="field"><span>Name</span>
        <input required maxLength={100} value={form.name} onChange={set('name')} placeholder="e.g. Emergency fund" />
      </label>
      <div className="row">
        <label className="field"><span>Target ({currencySymbol})</span>
          <input type="number" min="0.01" step="0.01" required inputMode="decimal" value={form.targetAmount} onChange={set('targetAmount')} />
        </label>
        <label className="field"><span>Already saved</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={form.savedAmount} onChange={set('savedAmount')} placeholder="0" />
        </label>
      </div>
      <label className="field"><span>Target date <em>(optional)</em></span>
        <input type="date" min={today()} value={form.targetDate} onChange={set('targetDate')} />
      </label>
      <button className="primary" type="submit">Create goal</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function IncomeEditor({ forecast, onSaved }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (forecast) setValue(String(forecast.monthlyIncome || ''));
  }, [forecast?.monthlyIncome]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    try {
      await api.saveIncome(Number(value || 0));
      setStatus('✓ Saved');
      await onSaved();
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <form className="income" onSubmit={save}>
      <label className="field">
        <span>Monthly income (after tax)</span>
        <div className="input-prefix">
          <span aria-hidden="true">{currencySymbol}</span>
          <input
            type="number" min="0" step="0.01" inputMode="decimal" value={value}
            onChange={(e) => { setValue(e.target.value); setStatus(''); }}
          />
        </div>
      </label>
      <button className="secondary" type="submit">Save</button>
      {status && <span className={status.startsWith('✓') ? 'ok' : 'error'} role="status">{status}</span>}
    </form>
  );
}

export default function Goals({ forecast, onChanged }) {
  if (!forecast) return null;
  const { basis } = forecast;

  return (
    <section className="card goals">
      <div className="card-head">
        <h2>Goals</h2>
      </div>

      <div className="goals-basis">
        <IncomeEditor forecast={forecast} onSaved={onChanged} />
        <p className="muted small">
          {basis.windowDays === 0
            ? 'Log some expenses to estimate your monthly spending.'
            : <>Forecast uses your average spending of <strong>{formatMoney(forecast.avgMonthlySpend)}/month</strong> over the last {basis.windowDays} day{basis.windowDays === 1 ? '' : 's'}, leaving <strong>{formatMoney(forecast.monthlySavings)}/month</strong> to save. Goals are funded one at a time: dated goals first, earliest first.</>}
          {basis.lowConfidence && basis.windowDays > 0 && (
            <span className="badge warning inline">! Less than 2 weeks of history; estimate will settle as you log more</span>
          )}
        </p>
      </div>

      <div className="goal-grid">
        {forecast.goals.map((g) => <GoalCard key={g.id} goal={g} onChanged={onChanged} />)}
        <NewGoalForm onCreated={onChanged} />
      </div>
    </section>
  );
}
