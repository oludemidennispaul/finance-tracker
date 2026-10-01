import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { today } from '../lib/dates.js';
import { currencySymbol } from '../lib/format.js';

const NEW_CATEGORY = '__new__';

export default function ExpenseForm({ categories, onAdded, onCategoryAdded }) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [spentOn, setSpentOn] = useState(today());
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState({ busy: false, error: '', saved: false });

  useEffect(() => {
    if (!categoryId && categories.length) setCategoryId(String(categories[0].id));
  }, [categories, categoryId]);

  async function submit(e) {
    e.preventDefault();
    setStatus({ busy: true, error: '', saved: false });
    try {
      let catId = categoryId;
      if (categoryId === NEW_CATEGORY) {
        const created = await api.addCategory(newCategory);
        onCategoryAdded(created);
        catId = String(created.id);
        setCategoryId(catId);
        setNewCategory('');
      }
      await api.addExpense({ amount: Number(amount), categoryId: Number(catId), spentOn, description });
      setAmount('');
      setDescription('');
      setStatus({ busy: false, error: '', saved: true });
      await onAdded();
    } catch (err) {
      setStatus({ busy: false, error: err.message, saved: false });
    }
  }

  return (
    <section className="card">
      <h2>Add expense</h2>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Amount</span>
          <div className="input-prefix">
            <span aria-hidden="true">{currencySymbol}</span>
            <input
              type="number" inputMode="decimal" min="0.01" step="0.01" required
              value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
            />
          </div>
        </label>

        <div className="row">
          <label className="field">
            <span>Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_CATEGORY}>+ New category…</option>
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" required max={today()} value={spentOn} onChange={(e) => setSpentOn(e.target.value)} />
          </label>
        </div>

        {categoryId === NEW_CATEGORY && (
          <label className="field">
            <span>New category name</span>
            <input required maxLength={50} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          </label>
        )}

        <label className="field">
          <span>Description <em>(optional)</em></span>
          <input maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lunch with team" />
        </label>

        <div className="form-actions">
          <button className="primary" type="submit" disabled={status.busy}>
            {status.busy ? 'Saving…' : 'Add expense'}
          </button>
          {status.saved && <span className="ok" role="status">✓ Saved</span>}
          {status.error && <span className="error" role="alert">{status.error}</span>}
        </div>
      </form>
    </section>
  );
}
