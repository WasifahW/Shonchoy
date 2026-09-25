import type { ShonchoyData } from './types'

export const sampleData: ShonchoyData = {
  app: '$honchoy',
  user: { ageConfirmed: true, language: 'en' },
  income: { type: 'monthly', sources: [{ name: 'salary', amount: 20000 }] },
  expenses: [
    { category: 'rent', name: 'House rent', amount: 6000, type: 'fixed' },
    { category: 'food', name: 'Groceries', amount: 3000, type: 'variable' }
  ],
  debts: [{ type: 'microloan', amount: 5000, interestRate: 20, minMonthlyPayment: 500 }],
  goals: [{ id: 'g1', name: 'Sewing machine', cost: 15000, saved: 3000, type: 'custom' }],
  logs: [{ date: '2026-09-25', amount: 1000, note: '' }]
}
