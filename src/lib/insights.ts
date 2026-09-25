import type { ShonchoyData, Debt, Goal } from './types'

/**
 * Insight engine for $honchoy.
 * Pure functions only — no I/O — so it can run on the edge, in tests, or be
 * reused by other modules of the app.
 *
 * Assumptions (kept simple on purpose):
 *  - income amounts are per `income.type` (monthly / weekly / daily) and are
 *    normalised to a monthly figure;
 *  - expenses and debt minimum payments are monthly amounts;
 *  - "savings this month" = sum of logs dated in the last 30 days.
 */

const PERIOD_TO_MONTH: Record<string, number> = {
  monthly: 1,
  weekly: 52 / 12,
  daily: 30,
  yearly: 1 / 12
}

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))
const round = (n: number) => Math.round(n)
/** Linear score: full at `good` or better, zero at `bad` or worse. */
const scale = (value: number, good: number, bad: number) =>
  clamp((value - bad) / (good - bad))

export interface DebtPlan {
  type: string
  amount: number
  interestRate: number
  minMonthlyPayment: number
  monthsToPayOff: number | null // null = payment too small to ever finish
  totalInterest: number | null
  yearlyInterestNow: number
}

export interface GoalProgress extends Goal {
  remaining: number
  percent: number
  monthsAtCurrentPace: number | null
}

export interface ScorePart {
  key: string
  label: string
  points: number
  max: number
  hint: string
}

export interface Overview {
  monthlyIncome: number
  monthlyExpenses: number
  fixedExpenses: number
  variableExpenses: number
  monthlyDebtPayments: number
  leftOver: number // after expenses + minimum debt payments
  savedLast30Days: number
  totalSavedAllTime: number
  savingsRate: number // 0..1
  spendingRatio: number // (expenses + debt payments) / income
  totalDebt: number
  expensesByCategory: { category: string; amount: number; share: number }[]
  debts: DebtPlan[]
  goals: GoalProgress[]
  health: { score: number; label: string; mood: string; parts: ScorePart[] }
  insights: string[]
}

export function debtPlan(d: Debt): DebtPlan {
  const r = d.interestRate / 100 / 12
  const P = d.amount
  const M = d.minMonthlyPayment
  let months: number | null
  if (P <= 0) months = 0
  else if (M <= 0) months = null
  else if (r === 0) months = Math.ceil(P / M)
  else if (M <= P * r) months = null
  else months = Math.ceil(-Math.log(1 - (r * P) / M) / Math.log(1 + r))

  let totalInterest: number | null = null
  if (months !== null) {
    // simulate for an accurate final (smaller) payment
    let bal = P
    let paid = 0
    for (let i = 0; i < months && bal > 0.005; i++) {
      bal += bal * r
      const pay = Math.min(M, bal)
      bal -= pay
      paid += pay
    }
    totalInterest = round(paid - P)
  }
  return {
    ...d,
    monthsToPayOff: months,
    totalInterest,
    yearlyInterestNow: round((P * d.interestRate) / 100)
  }
}

export function buildOverview(data: ShonchoyData, today = new Date()): Overview {
  const factor = PERIOD_TO_MONTH[data.income?.type] ?? 1
  const monthlyIncome = round(
    (data.income?.sources ?? []).reduce((s, x) => s + (Number(x.amount) || 0), 0) * factor
  )

  const expenses = data.expenses ?? []
  const sumBy = (pred: (t: string) => boolean) =>
    expenses.filter((e) => pred(e.type)).reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const monthlyExpenses = sumBy(() => true)
  const fixedExpenses = sumBy((t) => t === 'fixed')
  const variableExpenses = monthlyExpenses - fixedExpenses

  const catMap = new Map<string, number>()
  for (const e of expenses) catMap.set(e.category, (catMap.get(e.category) ?? 0) + (Number(e.amount) || 0))
  const expensesByCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount, share: monthlyIncome ? amount / monthlyIncome : 0 }))
    .sort((a, b) => b.amount - a.amount)

  const debts = (data.debts ?? []).map(debtPlan)
  const monthlyDebtPayments = debts.reduce((s, d) => s + d.minMonthlyPayment, 0)
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0)
  const leftOver = monthlyIncome - monthlyExpenses - monthlyDebtPayments

  const cutoff = today.getTime() - 30 * 86400000
  const logs = data.logs ?? []
  const recentLogs = logs.filter((l) => {
    const t = new Date(l.date + 'T00:00:00').getTime()
    return !isNaN(t) && t >= cutoff && t <= today.getTime() + 86400000
  })
  const savedLast30Days = recentLogs.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const totalSavedAllTime = logs.reduce((s, l) => s + (Number(l.amount) || 0), 0)

  const savingsRate = monthlyIncome ? savedLast30Days / monthlyIncome : 0
  const spendingRatio = monthlyIncome ? (monthlyExpenses + monthlyDebtPayments) / monthlyIncome : 1

  const goals: GoalProgress[] = (data.goals ?? []).map((g) => {
    const remaining = Math.max(0, g.cost - g.saved)
    const percent = g.cost > 0 ? clamp(g.saved / g.cost) : 0
    const monthsAtCurrentPace =
      remaining === 0 ? 0 : savedLast30Days > 0 ? Math.ceil(remaining / savedLast30Days) : null
    return { ...g, remaining, percent, monthsAtCurrentPace }
  })

  // ---------- Financial health score (0-100) ----------
  const debtToIncome = monthlyIncome ? monthlyDebtPayments / monthlyIncome : debts.length ? 1 : 0
  const worstRate = debts.length ? Math.max(...debts.map((d) => d.interestRate)) : 0
  const avgGoal = goals.length ? goals.reduce((s, g) => s + g.percent, 0) / goals.length : 0
  const habit = clamp(recentLogs.length / 4) // aiming for about one saving a week

  const parts: ScorePart[] = [
    {
      key: 'spending', label: 'Spending within income', max: 30,
      points: 30 * scale(spendingRatio, 0.5, 1),
      hint: 'Full points when bills and loan payments use half your income or less.'
    },
    {
      key: 'saving', label: 'Saving this month', max: 25,
      points: 25 * scale(savingsRate, 0.2, 0),
      hint: 'Full points when you save 20% (one fifth) of your income.'
    },
    {
      key: 'debtLoad', label: 'Loan payments', max: 15,
      points: debts.length ? 15 * scale(debtToIncome, 0.1, 0.4) : 15,
      hint: 'Full points when loan payments are 10% of income or less.'
    },
    {
      key: 'debtCost', label: 'Cost of borrowing', max: 10,
      points: debts.length ? 10 * scale(worstRate, 10, 36) : 10,
      hint: 'Full points with no loans, or loans at 10% interest or lower.'
    },
    {
      key: 'goals', label: 'Goal progress', max: 10,
      points: goals.length ? 10 * avgGoal : 5,
      hint: 'Grows as you get closer to your goals.'
    },
    {
      key: 'habit', label: 'Saving habit', max: 10,
      points: 10 * habit,
      hint: 'Full points for saving about once a week (4 times in 30 days).'
    }
  ].map((p) => ({ ...p, points: Math.round(p.points * 10) / 10 }))

  const score = Math.round(clamp(parts.reduce((s, p) => s + p.points, 0), 0, 100))
  const [label, mood] =
    score >= 80 ? ['Strong', 'You are in a really good place.'] :
    score >= 60 ? ['Getting there', 'A solid base — a few small steps will lift you higher.'] :
    score >= 40 ? ['Building up', 'You have started — let’s make things steadier together.'] :
                  ['Needs care', 'Money feels tight right now. Small steps still count.']

  const overview: Overview = {
    monthlyIncome, monthlyExpenses, fixedExpenses, variableExpenses, monthlyDebtPayments,
    leftOver, savedLast30Days, totalSavedAllTime, savingsRate, spendingRatio, totalDebt,
    expensesByCategory, debts, goals,
    health: { score, label, mood, parts },
    insights: []
  }
  overview.insights = writeInsights(overview)
  return overview
}

const money = (n: number) => '৳' + Math.round(n).toLocaleString('en-US')
const pct = (n: number) => Math.round(n * 100) + '%'
const monthsText = (m: number) => (m <= 1 ? 'about a month' : `about ${m} months`)

/** 2–3 short, warm, plain-language sentences chosen from the numbers. */
export function writeInsights(o: Overview): string[] {
  const out: { priority: number; text: string }[] = []

  if (o.monthlyIncome <= 0) {
    return ['Add your income so we can show how your money is doing.']
  }

  // 1. Spending vs income
  if (o.leftOver < 0) {
    out.push({ priority: 100, text: `Right now your bills and loan payments are ${money(-o.leftOver)} more than you earn each month. Let’s look for one cost you can lower first — even a small cut helps.` })
  } else if (o.spendingRatio <= 0.5) {
    out.push({ priority: 60, text: `Great news: your bills and loan payments use only ${pct(o.spendingRatio)} of your income, leaving about ${money(o.leftOver)} each month.` })
  } else {
    out.push({ priority: 70, text: `Your bills and loan payments use ${pct(o.spendingRatio)} of your income, leaving about ${money(o.leftOver)} each month.` })
  }

  // 2. Goal + savings pace, with a gentle "what if"
  const goal = o.goals.find((g) => g.remaining > 0)
  if (goal) {
    const boost = Math.min(Math.max(0, o.leftOver - o.savedLast30Days), 2000)
    const boostedPace = o.savedLast30Days + boost
    const boostedMonths = boostedPace > 0 ? Math.ceil(goal.remaining / boostedPace) : null
    if (goal.monthsAtCurrentPace !== null) {
      let t = `You are ${pct(goal.percent)} of the way to your ${goal.name.toLowerCase()} — at ${money(o.savedLast30Days)} a month, you’ll reach it in ${monthsText(goal.monthsAtCurrentPace)}.`
      if (boost >= 500 && boostedMonths !== null && boostedMonths < goal.monthsAtCurrentPace) {
        t += ` Adding ${money(boost)} more each month could get you there in ${monthsText(boostedMonths)}.`
      }
      out.push({ priority: 80, text: t })
    } else if (o.leftOver > 0) {
      out.push({ priority: 80, text: `You have ${money(goal.saved)} saved for your ${goal.name.toLowerCase()}. Setting aside ${money(Math.min(o.leftOver, 1000))} each month would be a great way to keep it moving.` })
    }
  } else if (o.goals.length) {
    out.push({ priority: 50, text: 'You have reached all your goals — wonderful! Maybe it’s time to pick a new one.' })
  }

  // 3. Costly debt
  const costly = [...o.debts].sort((a, b) => b.interestRate - a.interestRate)[0]
  if (costly && costly.amount > 0) {
    if (costly.monthsToPayOff === null) {
      out.push({ priority: 95, text: `Your ${costly.type} payment is too small to cover the interest, so the loan may never shrink. Paying a little more each month is the most important step.` })
    } else if (costly.interestRate >= 15) {
      out.push({ priority: 75, text: `Your ${costly.type} costs ${costly.interestRate}% a year — about ${money(costly.yearlyInterestNow)} in interest. Paying a bit more than ${money(costly.minMonthlyPayment)} a month will clear it sooner and save you money.` })
    } else {
      out.push({ priority: 40, text: `At ${money(costly.minMonthlyPayment)} a month, your ${costly.type} will be paid off in ${monthsText(costly.monthsToPayOff)}.` })
    }
  }

  // 4. Low savings rate nudge
  if (o.savingsRate < 0.1 && o.leftOver > 0) {
    out.push({ priority: 55, text: `You saved ${pct(o.savingsRate)} of your income this month. Try saving on payday, before spending — it makes a big difference.` })
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 3).map((x) => x.text)
}
