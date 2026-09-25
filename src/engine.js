/**
 * ============================================================================
 *  $honchoy — CORE FINANCIAL ENGINE
 * ============================================================================
 *
 *  ALL money calculations for the app live in ONE function:
 *
 *      calculateFinancialPlan(data, options) -> plan
 *
 *  It is a pure function (no DOM, no storage, no network), so the exact same
 *  code runs in the browser (instant recalculation) and in the Hono worker
 *  (POST /api/plan). Change the rules here and both sides stay in sync.
 *
 *  Input  : the $honchoy data shape
 *           { app, user, income, expenses, debts, goals, logs }
 *  Options: {
 *             today?: "YYYY-MM-DD"            // for payoff dates & month logs
 *             debtPaymentOverrides?: { [debtIndex]: number }
 *                                             // "what if I paid X per month?"
 *           }
 *  Output : see the `return` statement at the bottom (STEP 7).
 *
 *  Conventions
 *   - All amounts are in the user's currency, per MONTH.
 *   - interestRate is an ANNUAL percentage (20 => 20% per year),
 *     applied as monthly compounding on the declining balance.
 *   - An emergency fund is a goal with type "emergency". If none exists the
 *     engine assumes 0 saved and still recommends a target.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
//  TUNABLE RULES — product/finance team can adjust these safely.
// ---------------------------------------------------------------------------
export const RULES = {
  // Debt-to-income: share of monthly income going to minimum debt payments.
  DTI_WARNING: 0.30, // 30%+ => caution
  DTI_DANGER: 0.40,  // 40%+ => danger

  // Annual interest rate above which a debt is flagged "unusually high",
  // per debt type. (Microcredit regulators commonly cap around 24%.)
  HIGH_INTEREST_BY_TYPE: {
    bank_loan: 18,
    microloan: 27,
    informal: 24,
    credit_purchase: 24,
  },
  HIGH_INTEREST_DEFAULT: 24,
  VERY_HIGH_INTEREST: 36, // flagged as danger regardless of type

  // Emergency fund target = N months of essential outflow
  // (all expenses + minimum debt payments).
  EMERGENCY_FUND_MONTHS: 3,

  // How the money left after expenses + debt is split.
  // Weighted toward the emergency fund until it is fully funded.
  SPLIT_EF_BELOW_HALF: { emergency: 0.60, goals: 0.25, flexible: 0.15 },
  SPLIT_EF_ABOVE_HALF: { emergency: 0.45, goals: 0.35, flexible: 0.20 },
  SPLIT_EF_FUNDED:     { emergency: 0.00, goals: 0.60, flexible: 0.40 },

  // When a debt is flagged high-interest, this share of the surplus is added
  // to the debt carve-out and aimed at the highest-rate debt (avalanche).
  EXTRA_DEBT_SHARE_IF_HIGH_INTEREST: 0.10,

  // Income frequency -> monthly multiplier.
  INCOME_TO_MONTHLY: { monthly: 1, weekly: 52 / 12, daily: 30, yearly: 1 / 12 },

  MAX_PAYOFF_MONTHS: 600, // stop simulating after 50 years
};

export const DEBT_TYPE_LABELS = {
  bank_loan: 'Bank loan',
  microloan: 'Microloan / MFI',
  informal: 'Informal / family loan',
  credit_purchase: 'Credit purchase',
};

/**
 * THE calculation function. Everything numeric the UI shows comes from here.
 */
export function calculateFinancialPlan(data, options = {}) {
  // ---- small local helpers (kept inside so the logic stays in one place) ---
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  const round = (v) => Math.round(v * 100) / 100;
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const today = options.today ? new Date(options.today + 'T00:00:00') : new Date();
  const addMonths = (d, m) => {
    const x = new Date(d.getFullYear(), d.getMonth() + m, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  };
  const flags = []; // { level: 'info'|'warning'|'danger', code, message }

  /**
   * Month-by-month amortization of one debt.
   * Returns months to payoff, total interest, and payoff month (YYYY-MM),
   * or payable:false if the payment never covers the monthly interest.
   */
  const simulatePayoff = (balance, annualRate, payment) => {
    const r = annualRate / 100 / 12;
    if (balance <= 0) return { payable: true, months: 0, totalInterest: 0, totalPaid: 0, payoffMonth: addMonths(today, 0) };
    if (payment <= 0 || payment <= balance * r) {
      return { payable: false, months: null, totalInterest: null, totalPaid: null, payoffMonth: null,
               minimumToMakeProgress: round(balance * r + 1) };
    }
    let b = balance, months = 0, interest = 0, paid = 0;
    while (b > 0.005 && months < RULES.MAX_PAYOFF_MONTHS) {
      const i = b * r;
      const pay = Math.min(payment, b + i); // last payment may be smaller
      interest += i; paid += pay; b = b + i - pay; months++;
    }
    return { payable: b <= 0.005, months, totalInterest: round(interest), totalPaid: round(paid),
             payoffMonth: addMonths(today, months) };
  };

  // ==========================================================================
  //  STEP 1 — INCOME (normalized to monthly)
  // ==========================================================================
  const incomeType = data?.income?.type || 'monthly';
  const multiplier = RULES.INCOME_TO_MONTHLY[incomeType] ?? 1;
  const sources = Array.isArray(data?.income?.sources) ? data.income.sources : [];
  const monthlyIncome = round(sum(sources, (s) => num(s.amount)) * multiplier);
  if (monthlyIncome === 0) {
    flags.push({ level: 'warning', code: 'NO_INCOME', message: 'Add your income to get a budget plan.' });
  }

  // ==========================================================================
  //  STEP 2 — EXPENSES (fixed vs variable, grouped by category)
  // ==========================================================================
  const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
  const fixedExpenses = round(sum(expenses.filter((e) => e.type === 'fixed'), (e) => num(e.amount)));
  const variableExpenses = round(sum(expenses.filter((e) => e.type !== 'fixed'), (e) => num(e.amount)));
  const totalExpenses = round(fixedExpenses + variableExpenses);
  const byCategory = {};
  for (const e of expenses) {
    const c = e.category || 'other';
    byCategory[c] = round((byCategory[c] || 0) + num(e.amount));
  }

  // ==========================================================================
  //  STEP 3 — DEBT OVERVIEW (DTI, interest flags, payoff timelines)
  // ==========================================================================
  const rawDebts = Array.isArray(data?.debts) ? data.debts : [];
  const overrides = options.debtPaymentOverrides || {};
  const debts = rawDebts.map((d, index) => {
    const amount = num(d.amount);
    const rate = num(d.interestRate);
    const minPay = num(d.minMonthlyPayment);
    const threshold = RULES.HIGH_INTEREST_BY_TYPE[d.type] ?? RULES.HIGH_INTEREST_DEFAULT;
    const interestLevel = rate >= RULES.VERY_HIGH_INTEREST ? 'danger' : rate > threshold ? 'warning' : 'ok';
    if (interestLevel !== 'ok') {
      flags.push({
        level: interestLevel, code: 'HIGH_INTEREST', debtIndex: index,
        message: `${DEBT_TYPE_LABELS[d.type] || 'Debt'} at ${rate}% per year is unusually high` +
                 ` (typical ceiling ~${threshold}%). Prioritise paying it off or refinancing.`,
      });
    }
    const hasOverride = overrides[index] !== undefined && overrides[index] !== '';
    const testPayment = hasOverride ? num(overrides[index]) : minPay;
    return {
      index, type: d.type, label: DEBT_TYPE_LABELS[d.type] || d.type, name: d.name || '',
      amount, interestRate: rate, minMonthlyPayment: minPay,
      monthlyInterestNow: round(amount * rate / 100 / 12),
      highInterestThreshold: threshold, interestLevel,
      payoffAtMinimum: simulatePayoff(amount, rate, minPay),
      testPayment, payoffAtTestPayment: simulatePayoff(amount, rate, testPayment),
    };
  });
  for (const d of debts) {
    if (d.amount > 0 && !d.payoffAtMinimum.payable) {
      flags.push({ level: 'danger', code: 'NEVER_PAID_OFF', debtIndex: d.index,
        message: `The minimum payment on your ${d.label.toLowerCase()} does not cover its interest — the balance will never go down.` });
    }
  }
  const totalDebt = round(sum(debts, (d) => d.amount));
  const totalMinPayments = round(sum(debts, (d) => d.minMonthlyPayment));
  const debtToIncome = monthlyIncome > 0 ? totalMinPayments / monthlyIncome : (totalMinPayments > 0 ? Infinity : 0);
  const dtiLevel = debtToIncome >= RULES.DTI_DANGER ? 'danger' : debtToIncome >= RULES.DTI_WARNING ? 'warning' : 'ok';
  if (dtiLevel !== 'ok' && Number.isFinite(debtToIncome)) {
    flags.push({ level: dtiLevel, code: 'HIGH_DTI',
      message: `Debt payments take ${Math.round(debtToIncome * 100)}% of your income. ` +
               `Try to keep this below ${Math.round(RULES.DTI_WARNING * 100)}–${Math.round(RULES.DTI_DANGER * 100)}%.` });
  }

  // ==========================================================================
  //  STEP 4 — DISPOSABLE INCOME & DEBT CARVE-OUT
  // ==========================================================================
  //  disposable = income − all expenses
  //  carve-out  = minimum debt payments (+ an avalanche extra if any debt is
  //               high-interest), never more than what is available.
  const disposableIncome = round(monthlyIncome - totalExpenses);
  if (disposableIncome < 0) {
    flags.push({ level: 'danger', code: 'OVERSPENDING',
      message: `Your expenses are ${Math.abs(disposableIncome).toLocaleString()} more than your income each month.` });
  }
  const available = Math.max(0, disposableIncome);
  const requiredDebt = Math.min(available, totalMinPayments);
  if (totalMinPayments > available) {
    flags.push({ level: 'danger', code: 'DEBT_SHORTFALL',
      message: `After expenses you are ${round(totalMinPayments - available).toLocaleString()} short of your minimum debt payments.` });
  }
  const afterMinimums = available - requiredDebt;
  const highRateDebts = debts.filter((d) => d.interestLevel !== 'ok' && d.amount > 0)
                             .sort((a, b) => b.interestRate - a.interestRate);
  const extraDebtPayment = highRateDebts.length ? round(afterMinimums * RULES.EXTRA_DEBT_SHARE_IF_HIGH_INTEREST) : 0;
  const extraDebtTarget = highRateDebts[0] || null;
  if (extraDebtTarget) {
    extraDebtTarget.planPayment = round(extraDebtTarget.minMonthlyPayment + extraDebtPayment);
    extraDebtTarget.payoffWithPlan = simulatePayoff(extraDebtTarget.amount, extraDebtTarget.interestRate, extraDebtTarget.planPayment);
  }
  const debtCarveOut = round(requiredDebt + extraDebtPayment);
  const remainder = round(Math.max(0, available - debtCarveOut));

  // ==========================================================================
  //  STEP 5 — EMERGENCY FUND status
  // ==========================================================================
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  const efGoal = goals.find((g) => g.type === 'emergency');
  const monthlyEssentials = totalExpenses + totalMinPayments;
  const efTarget = round(efGoal && num(efGoal.cost) > 0 ? num(efGoal.cost) : monthlyEssentials * RULES.EMERGENCY_FUND_MONTHS);
  const efSaved = round(efGoal ? num(efGoal.saved) : 0);
  const efGap = round(Math.max(0, efTarget - efSaved));
  const efProgress = efTarget > 0 ? Math.min(1, efSaved / efTarget) : 1;
  const efFunded = efGap <= 0;

  // ==========================================================================
  //  STEP 6 — SPLIT THE REMAINDER: emergency fund / goals / flexible
  // ==========================================================================
  //  Weights shift away from the emergency fund as it fills up. The EF share
  //  is capped at the remaining gap; any overflow is re-shared between goals
  //  and flexible spending in their own ratio.
  const weights = efFunded ? RULES.SPLIT_EF_FUNDED
                : efProgress >= 0.5 ? RULES.SPLIT_EF_ABOVE_HALF
                : RULES.SPLIT_EF_BELOW_HALF;
  let toEmergency = remainder * weights.emergency;
  let toGoals = remainder * weights.goals;
  let toFlexible = remainder * weights.flexible;
  if (toEmergency > efGap) {
    const overflow = toEmergency - efGap;
    toEmergency = efGap;
    const gw = weights.goals + weights.flexible || 1;
    toGoals += overflow * (weights.goals / gw);
    toFlexible += overflow * (weights.flexible / gw);
  }
  // No active goals? Send the goals share to flexible spending.
  const activeGoals = goals.filter((g) => g.type !== 'emergency' && num(g.cost) - num(g.saved) > 0);
  if (!activeGoals.length) { toFlexible += toGoals; toGoals = 0; }
  toEmergency = round(toEmergency); toGoals = round(toGoals); toFlexible = round(toFlexible);

  // Share the goals money across goals in proportion to what each still needs.
  const totalGoalGap = sum(activeGoals, (g) => num(g.cost) - num(g.saved));
  const goalPlans = goals.filter((g) => g.type !== 'emergency').map((g) => {
    const gap = Math.max(0, num(g.cost) - num(g.saved));
    const monthly = totalGoalGap > 0 ? round(toGoals * (gap / totalGoalGap)) : 0;
    const months = gap === 0 ? 0 : monthly > 0 ? Math.ceil(gap / monthly) : null;
    return { id: g.id, name: g.name, cost: num(g.cost), saved: num(g.saved), remaining: round(gap),
             progress: num(g.cost) > 0 ? Math.min(1, num(g.saved) / num(g.cost)) : 0,
             monthlyAllocation: monthly, monthsToGoal: months,
             targetMonth: months === null ? null : addMonths(today, months) };
  });
  const efMonthsToFunded = efFunded ? 0 : toEmergency > 0 ? Math.ceil(efGap / toEmergency) : null;

  // Savings logs for the current month vs. what the plan suggests saving.
  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const ym = addMonths(today, 0);
  const savedThisMonth = round(sum(logs.filter((l) => String(l.date || '').startsWith(ym)), (l) => num(l.amount)));
  const plannedSavings = round(toEmergency + toGoals);

  if (monthlyIncome > 0 && remainder === 0 && disposableIncome >= 0 && flags.every((f) => f.code !== 'DEBT_SHORTFALL')) {
    flags.push({ level: 'warning', code: 'NO_SURPLUS', message: 'Nothing is left after expenses and debt. Look for a cost you can reduce.' });
  }

  // ==========================================================================
  //  STEP 7 — RESULT
  // ==========================================================================
  return {
    currencyPeriod: 'monthly',
    income: { type: incomeType, monthly: monthlyIncome },
    expenses: { fixed: fixedExpenses, variable: variableExpenses, total: totalExpenses, byCategory,
                shareOfIncome: monthlyIncome > 0 ? totalExpenses / monthlyIncome : null },
    debt: {
      total: totalDebt, totalMinPayments,
      debtToIncome: Number.isFinite(debtToIncome) ? debtToIncome : null, dtiLevel,
      dtiThresholds: { warning: RULES.DTI_WARNING, danger: RULES.DTI_DANGER },
      items: debts,
      extraPayment: extraDebtPayment ? { amount: extraDebtPayment, debtIndex: extraDebtTarget.index } : null,
    },
    budget: {
      disposableIncome,
      debtCarveOut,
      remainder,
      weightsUsed: weights,
      allocation: { emergencyFund: toEmergency, goals: toGoals, flexible: toFlexible },
    },
    emergencyFund: { target: efTarget, saved: efSaved, remaining: efGap, progress: efProgress,
                     funded: efFunded, monthsToFunded: efMonthsToFunded, goalId: efGoal?.id ?? null,
                     targetMonths: RULES.EMERGENCY_FUND_MONTHS },
    goals: goalPlans,
    savings: { savedThisMonth, plannedThisMonth: plannedSavings },
    flags,
  };
}
