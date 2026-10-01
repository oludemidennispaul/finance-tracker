// Goal forecasting. Pure functions with no database access, so they are easy to test.
//
// Model:
//   monthly savings = monthly income - average monthly spending
//   Average monthly spending is measured over the most recent 90 days of
//   history (or less, if the user has only just started logging).
//   Goals are funded one at a time, in priority order: goals with a target
//   date first (earliest first), then undated goals in the order created.
//   A goal's projected date is when cumulative savings cover it and every
//   goal ahead of it.

export const AVG_DAYS_PER_MONTH = 30.44;
export const SPEND_WINDOW_DAYS = 90;
export const LOW_CONFIDENCE_DAYS = 14;

const MS_PER_DAY = 86_400_000;

function toUtcDate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((toUtcDate(toIso) - toUtcDate(fromIso)) / MS_PER_DAY);
}

export function addDays(iso, days) {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + Math.ceil(days));
  return d.toISOString().slice(0, 10);
}

/**
 * @param {number} totalSpent   total spent within the window
 * @param {number} windowDays   number of days the window covers (>= 1)
 */
export function averageMonthlySpend(totalSpent, windowDays) {
  if (!windowDays || windowDays < 1) return 0;
  return (totalSpent / windowDays) * AVG_DAYS_PER_MONTH;
}

export function sortGoalsByPriority(goals) {
  return [...goals].sort((a, b) => {
    if (a.target_date && b.target_date) {
      if (a.target_date !== b.target_date) return a.target_date < b.target_date ? -1 : 1;
    } else if (a.target_date) return -1;
    else if (b.target_date) return 1;
    return a.id - b.id;
  });
}

/**
 * @param {object}   args
 * @param {number}   args.monthlyIncome
 * @param {number}   args.avgMonthlySpend
 * @param {object[]} args.goals   rows: { id, name, target_amount, saved_amount, target_date }
 * @param {string}   args.today   'YYYY-MM-DD'
 */
export function forecastGoals({ monthlyIncome, avgMonthlySpend, goals, today }) {
  const monthlySavings = round2(monthlyIncome - avgMonthlySpend);
  let cumulativeRemaining = 0;

  const results = sortGoalsByPriority(goals).map((goal, index) => {
    const remaining = round2(Math.max(goal.target_amount - goal.saved_amount, 0));
    const progress = Math.min(goal.saved_amount / goal.target_amount, 1);
    const base = { ...goal, priority: index + 1, remaining, progress };

    if (remaining === 0) {
      return { ...base, status: 'reached', projectedDate: null, monthsToGo: 0, onTrack: true, requiredMonthly: 0 };
    }

    cumulativeRemaining += remaining;

    // How much the user would need to save per month to hit the target date,
    // given that goals ahead of this one are funded first.
    let requiredMonthly = null;
    let daysLeft = null;
    if (goal.target_date) {
      daysLeft = daysBetween(today, goal.target_date);
      requiredMonthly = daysLeft > 0 ? round2(cumulativeRemaining / (daysLeft / AVG_DAYS_PER_MONTH)) : null;
    }

    if (monthlySavings <= 0) {
      return {
        ...base,
        status: 'unreachable',
        projectedDate: null,
        monthsToGo: null,
        onTrack: false,
        requiredMonthly,
      };
    }

    const monthsToGo = cumulativeRemaining / monthlySavings;
    const projectedDate = addDays(today, monthsToGo * AVG_DAYS_PER_MONTH);
    const onTrack = goal.target_date ? daysLeft > 0 && projectedDate <= goal.target_date : true;

    return {
      ...base,
      status: 'projected',
      projectedDate,
      monthsToGo: Math.round(monthsToGo * 10) / 10,
      onTrack,
      requiredMonthly,
    };
  });

  return { monthlySavings, goals: results };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
