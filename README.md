# $honchoy — Insights & Education module

Pink-and-white, mobile-first module for the $honchoy savings app. It has three tabs:

1. **Overview**: money in vs. out, a savings meter (aim: 20% of income), goal progress, loan payoff time, a **money health score (0–100)** with a breakdown you can open, and 2–3 personal insights written from the numbers.
2. **Learn**: 8 plain-language lesson cards: pay yourself first, emergency cushion, interest, debt, inflation, investing, diversification and budgeting. Each card has a big idea, a worked example in ৳, and a "Try this" step. Read progress is saved on the device.
3. **Stay safe**: a scam checker with two modes (7 yes/no questions, or paste a message to scan it for red-flag phrases) and an expandable list of red flags with simple "what to do" advice.

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/sample` | Example data in the $honchoy shape |
| POST | `/api/overview[?today=YYYY-MM-DD]` | Send the $honchoy data, get totals, score, score parts and insights |
| GET | `/api/overview/sample` | Overview for the example data |
| GET | `/api/lessons` | Lesson cards |
| GET | `/api/scam/flags` | Red flag list |
| POST | `/api/scam/check` | `{ "text": "..." }` or `{ "yes": ["pressure", ...] }` → risk level (low/medium/high) and matched flags |

## Health score (100 points)
- Spending within income: 30. Full points when bills plus minimum loan payments are 50% of income or less; zero at 100%.
- Saving in the last 30 days: 25. Full points at 20% of income.
- Loan payments compared to income: 15. Full points at 10% or less; zero at 40%.
- Cost of borrowing (highest interest rate): 10. Full points at 10% or less; zero at 36%.
- Goal progress: 10.
- Saving habit: 10. Full points for 4 or more savings logs in 30 days.

Income is converted to a monthly figure (monthly, weekly, daily or yearly). Expenses and minimum loan payments are treated as monthly.

## Code
- `src/lib/insights.ts`: pure calculations (overview, debt payoff, score, insight text)
- `src/lib/lessons.ts`, `src/lib/scams.ts`: content and the checker logic
- `src/index.tsx`: Hono routes and page layout; `public/static/app.js` and `style.css`: frontend

## Data and storage
There is no database yet. The "My numbers" editor stores the JSON in the browser (`localStorage`). To connect the real app, POST user data to `/api/overview`.

## Not yet done
- Bangla translation (`user.language`)
- Saving data per user in D1
- Deployment

## Run
`npm run build && pm2 start ecosystem.config.cjs` → http://localhost:3000

## Financial engine module (`/finance`)
Expense tracking, debt overview and the automatic budget planner. It lives in its own files, so the insights code above is unchanged.

- **`src/engine.js` → `calculateFinancialPlan(data, options)`**: one pure, commented function that does all the money math. The limits and percentages are in `RULES` at the top.
  - Expenses: fixed vs variable, grouped by category.
  - Debts (bank loan / microloan (MFI) / informal / credit purchase): warns when minimum payments reach 30% of income (danger at 40%), flags interest that is unusually high for the loan type (36%+ always danger), gives a payoff timeline at the minimum or any "what if" payment, and warns when a payment never covers interest.
  - Budget planner: disposable income → debt carve-out → emergency fund / goals / flexible, split 60/25/15 while the emergency fund is under half full, 45/35/20 after that, and 0/60/40 once it is full.
- `src/finance.tsx`: its routes, mounted in `src/index.tsx` with `app.route('/', finance)`.
  - `GET /finance`: the screens (Plan, Income, Expenses, Debts, Goals).
  - `GET /finance/engine.js`: the same engine file, loaded by the browser.
  - `POST /api/plan?today=YYYY-MM-DD`: send the $honchoy data object, get the plan back.
- `public/static/finance/app.js` and `style.css`: frontend. Data is saved in `localStorage` under `honchoy_data_v1`.
