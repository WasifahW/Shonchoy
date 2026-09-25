/**
 * $honchoy — Financial engine module (expenses, debts, budget planner).
 *
 * Mounted from src/index.tsx with `app.route('/', finance)`. Kept in its own
 * file so it doesn't touch the Insights & Education routes.
 *
 *   GET  /finance            → the finance screens (Plan, Income, Expenses, Debts, Goals)
 *   GET  /finance/engine.js  → src/engine.js served to the browser as an ES module
 *   POST /api/plan           → run calculateFinancialPlan() on the $honchoy data shape
 *
 * All the money math lives in ONE function: calculateFinancialPlan() in src/engine.js.
 */
import { Hono } from 'hono'
import { calculateFinancialPlan } from './engine.js'
// @ts-ignore - Vite raw import: the same engine file is shipped to the browser.
import engineSource from './engine.js?raw'

const finance = new Hono()

finance.get('/finance/engine.js', (c) =>
  c.body(engineSource, 200, { 'Content-Type': 'application/javascript; charset=utf-8' })
)

// Body: the $honchoy data object. Optional query ?today=YYYY-MM-DD
finance.post('/api/plan', async (c) => {
  let data: unknown
  try { data = await c.req.json() } catch { return c.json({ error: 'Please send valid JSON.' }, 400) }
  if (!data || typeof data !== 'object') return c.json({ error: 'Please send the $honchoy data object.' }, 400)
  return c.json(calculateFinancialPlan(data, { today: c.req.query('today') || undefined }))
})

// Uses c.html (not the shared jsxRenderer) so the insights app.js isn't loaded here.
finance.get('/finance', (c) => c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#ec4899" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <title>$honchoy · My Money Plan</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { theme: { extend: { colors: {
      brand: { 50:'#fff1f6',100:'#ffe4ee',200:'#fecadd',300:'#fda4c4',400:'#fb6fa2',500:'#f43f84',600:'#e11d6b',700:'#be1257',800:'#9d1249',900:'#831440' }
    }, fontFamily: { sans: ['Poppins','ui-sans-serif','system-ui'] } } } }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <link href="/static/finance/style.css" rel="stylesheet" />
</head>
<body class="bg-brand-50 text-gray-800 font-sans min-h-screen">
  <header id="app-header" class="bg-gradient-to-r from-brand-500 to-brand-400 text-white shadow">
    <div class="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">$honchoy</h1>
        <p class="text-brand-100 text-sm">Your money plan, made simple</p>
      </div>
      <div class="flex gap-2">
        <a href="/" class="btn-ghost"><i class="fas fa-book-open mr-1"></i>Insights</a>
        <button id="load-sample-btn" class="btn-ghost"><i class="fas fa-wand-magic-sparkles mr-1"></i>Sample</button>
        <button id="reset-btn" class="btn-ghost"><i class="fas fa-rotate-left mr-1"></i>Reset</button>
      </div>
    </div>
    <nav id="tab-nav" class="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
      <button class="tab active" data-tab="plan"><i class="fas fa-chart-pie mr-1"></i>Plan</button>
      <button class="tab" data-tab="income"><i class="fas fa-wallet mr-1"></i>Income</button>
      <button class="tab" data-tab="expenses"><i class="fas fa-receipt mr-1"></i>Expenses</button>
      <button class="tab" data-tab="debts"><i class="fas fa-hand-holding-dollar mr-1"></i>Debts</button>
      <button class="tab" data-tab="goals"><i class="fas fa-bullseye mr-1"></i>Goals</button>
    </nav>
  </header>

  <main id="app-main" class="max-w-5xl mx-auto px-4 py-6 space-y-6">
    <section id="flags-section"></section>
    <section id="tab-plan" class="tab-panel"></section>
    <section id="tab-income" class="tab-panel hidden"></section>
    <section id="tab-expenses" class="tab-panel hidden"></section>
    <section id="tab-debts" class="tab-panel hidden"></section>
    <section id="tab-goals" class="tab-panel hidden"></section>
  </main>

  <footer class="text-center text-xs text-brand-400 pb-8">Data is saved on this device only.</footer>
  <script type="module" src="/static/finance/app.js"></script>
</body>
</html>`))

export default finance
