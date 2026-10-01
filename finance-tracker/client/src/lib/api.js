// Thin wrapper around fetch for the Express API.
async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const qs = (params) => new URLSearchParams(params).toString();

export const api = {
  categories: () => request('/categories'),
  addCategory: (name) => request('/categories', { method: 'POST', body: { name } }),

  expenses: (params) => request(`/expenses?${qs(params)}`),
  addExpense: (expense) => request('/expenses', { method: 'POST', body: expense }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),

  summary: (params) => request(`/summary?${qs(params)}`),

  forecast: (today) => request(`/goals?${qs({ today })}`),
  addGoal: (goal) => request('/goals', { method: 'POST', body: goal }),
  updateGoal: (id, goal) => request(`/goals/${id}`, { method: 'PUT', body: goal }),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),

  saveIncome: (monthlyIncome) => request('/settings', { method: 'PUT', body: { monthlyIncome } }),
};
