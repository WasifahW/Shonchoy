// Data shape shared by the whole $honchoy app.
export interface IncomeSource { name: string; amount: number }
export interface Expense { category: string; name: string; amount: number; type: 'fixed' | 'variable' | string }
export interface Debt { type: string; amount: number; interestRate: number; minMonthlyPayment: number }
export interface Goal { id: string; name: string; cost: number; saved: number; type: string }
export interface SavingsLog { date: string; amount: number; note?: string }

export interface ShonchoyData {
  app: string
  user: { ageConfirmed: boolean; language: string }
  income: { type: 'monthly' | 'weekly' | 'daily' | string; sources: IncomeSource[] }
  expenses: Expense[]
  debts: Debt[]
  goals: Goal[]
  logs: SavingsLog[]
}
