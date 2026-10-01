import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, averageMonthlySpend, daysBetween, forecastGoals, sortGoalsByPriority } from '../src/forecast.js';

const today = '2026-10-01';

test('date helpers', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-31'), 30);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('average monthly spend scales the window to a month', () => {
  assert.equal(averageMonthlySpend(3044, 30.44), 3044);
  assert.equal(averageMonthlySpend(100, 0), 0);
});

test('dated goals come first, earliest first; undated by creation order', () => {
  const order = sortGoalsByPriority([
    { id: 1, target_date: null },
    { id: 2, target_date: '2027-06-01' },
    { id: 3, target_date: '2027-01-01' },
    { id: 4, target_date: null },
  ]).map((g) => g.id);
  assert.deepEqual(order, [3, 2, 1, 4]);
});

test('goals are funded one after another', () => {
  const { monthlySavings, goals } = forecastGoals({
    monthlyIncome: 1000,
    avgMonthlySpend: 600,
    today,
    goals: [
      { id: 1, name: 'A', target_amount: 1000, saved_amount: 200, target_date: null },
      { id: 2, name: 'B', target_amount: 400, saved_amount: 0, target_date: null },
    ],
  });
  assert.equal(monthlySavings, 400);
  assert.equal(goals[0].monthsToGo, 2); // 800 / 400
  assert.equal(goals[1].monthsToGo, 3); // (800 + 400) / 400
  assert.ok(goals[0].projectedDate < goals[1].projectedDate);
});

test('reached, unreachable and on-track states', () => {
  const reached = forecastGoals({
    monthlyIncome: 0, avgMonthlySpend: 0, today,
    goals: [{ id: 1, name: 'Done', target_amount: 500, saved_amount: 600, target_date: null }],
  }).goals[0];
  assert.equal(reached.status, 'reached');
  assert.equal(reached.progress, 1);

  const stuck = forecastGoals({
    monthlyIncome: 500, avgMonthlySpend: 700, today,
    goals: [{ id: 1, name: 'X', target_amount: 500, saved_amount: 0, target_date: '2027-01-01' }],
  });
  assert.equal(stuck.monthlySavings, -200);
  assert.equal(stuck.goals[0].status, 'unreachable');
  assert.equal(stuck.goals[0].onTrack, false);

  const late = forecastGoals({
    monthlyIncome: 1000, avgMonthlySpend: 900, today,
    goals: [{ id: 1, name: 'Y', target_amount: 1000, saved_amount: 0, target_date: '2026-12-01' }],
  }).goals[0];
  assert.equal(late.onTrack, false); // needs 10 months, has 2
  assert.ok(late.requiredMonthly > 400);
});
