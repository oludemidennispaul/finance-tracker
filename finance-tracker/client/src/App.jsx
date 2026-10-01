import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api.js';
import { PERIODS, today } from './lib/dates.js';
import StatTiles from './components/StatTiles.jsx';
import ExpenseForm from './components/ExpenseForm.jsx';
import TrendChart from './components/TrendChart.jsx';
import CategoryBreakdown from './components/CategoryBreakdown.jsx';
import ExpenseList from './components/ExpenseList.jsx';
import Goals from './components/Goals.jsx';

export default function App() {
  const [periodId, setPeriodId] = useState('30d');
  const [granularity, setGranularity] = useState('day');
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');

  const period = PERIODS.find((p) => p.id === periodId);
  const [from, to] = useMemo(() => period.range(), [period]);

  const loadPeriod = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        api.summary({ from, to, granularity }),
        api.expenses({ from, to, limit: 100 }),
      ]);
      setSummary(s);
      setExpenses(e);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [from, to, granularity]);

  const loadForecast = useCallback(async () => {
    try {
      setForecast(await api.forecast(today()));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadPeriod(); }, [loadPeriod]);
  useEffect(() => {
    loadForecast();
    api.categories().then(setCategories).catch((err) => setError(err.message));
  }, [loadForecast]);

  // Spending changes both the period view and the forecast.
  const refreshAll = () => Promise.all([loadPeriod(), loadForecast()]);

  const choosePeriod = (id) => {
    setPeriodId(id);
    setGranularity(PERIODS.find((p) => p.id === id).granularity);
  };

  return (
    <div className="page">
      <header className="topbar">
        <h1>Finance Tracker</h1>
        <div className="segmented" role="tablist" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === periodId}
              className={p.id === periodId ? 'active' : ''}
              onClick={() => choosePeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="banner" role="alert">
          <strong>Couldn&rsquo;t reach the server.</strong> {error}
          <button className="link" onClick={refreshAll}>Retry</button>
        </div>
      )}

      <StatTiles summary={summary} forecast={forecast} />

      <div className="grid two">
        <ExpenseForm
          categories={categories}
          onCategoryAdded={(c) => setCategories((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)))}
          onAdded={refreshAll}
        />
        <TrendChart summary={summary} granularity={granularity} onGranularity={setGranularity} />
      </div>

      <div className="grid two">
        <CategoryBreakdown summary={summary} />
        <ExpenseList expenses={expenses} onDeleted={refreshAll} />
      </div>

      <Goals forecast={forecast} onChanged={loadForecast} />
    </div>
  );
}
