import { useState } from 'react';
import { api } from '../lib/api.js';
import { formatDate, formatMoneyExact } from '../lib/format.js';

export default function ExpenseList({ expenses, onDeleted }) {
  const [error, setError] = useState('');

  async function remove(expense) {
    if (!window.confirm(`Delete ${formatMoneyExact(expense.amount)} (${expense.category}) on ${formatDate(expense.spent_on)}?`)) return;
    try {
      await api.deleteExpense(expense.id);
      setError('');
      await onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h2>Expenses in this period</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {expenses.length === 0 ? (
        <p className="empty">Nothing logged for this period.</p>
      ) : (
        <ul className="expense-list">
          {expenses.map((e) => (
            <li key={e.id}>
              <div className="expense-main">
                <span className="expense-cat">{e.category}</span>
                <span className="expense-desc muted">{e.description || '—'}</span>
              </div>
              <div className="expense-side">
                <span className="expense-amount">{formatMoneyExact(e.amount)}</span>
                <span className="muted small">{formatDate(e.spent_on, { day: 'numeric', month: 'short' })}</span>
              </div>
              <button className="icon-btn" onClick={() => remove(e)} aria-label={`Delete expense of ${formatMoneyExact(e.amount)}`}>×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
