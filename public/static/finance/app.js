// $honchoy UI layer. NO financial math here — every number comes from
// calculateFinancialPlan() in engine.js. This file only renders and edits state.
import { calculateFinancialPlan, DEBT_TYPE_LABELS } from '/finance/engine.js';

const STORAGE_KEY = 'honchoy_data_v1';

const SAMPLE = {
  app: '$honchoy',
  user: { ageConfirmed: true, language: 'en' },
  income: { type: 'monthly', sources: [{ name: 'salary', amount: 20000 }] },
  expenses: [
    { category: 'rent', name: 'House rent', amount: 6000, type: 'fixed' },
    { category: 'food', name: 'Groceries', amount: 3000, type: 'variable' },
  ],
  debts: [{ type: 'microloan', amount: 5000, interestRate: 20, minMonthlyPayment: 500 }],
  goals: [{ id: 'g1', name: 'Sewing machine', cost: 15000, saved: 3000, type: 'custom' }],
  logs: [{ date: new Date().toISOString().slice(0, 10), amount: 1000, note: '' }],
};
const EMPTY = { app: '$honchoy', user: { ageConfirmed: true, language: 'en' },
  income: { type: 'monthly', sources: [] }, expenses: [], debts: [], goals: [], logs: [] };

const CATEGORIES = ['rent', 'food', 'transport', 'utilities', 'education', 'health', 'phone', 'family', 'business', 'other'];
const CAT_ICONS = { rent: 'house', food: 'bowl-rice', transport: 'bus', utilities: 'bolt', education: 'book',
  health: 'kit-medical', phone: 'mobile-screen', family: 'people-roof', business: 'store', other: 'ellipsis' };

let state = load();
let payoffTests = {}; // debtIndex -> "what if" monthly payment (UI only)
let activeTab = 'plan';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(SAMPLE); }
  catch { return structuredClone(SAMPLE); }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }

const $ = (s) => document.querySelector(s);
const money = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
const pct = (n) => (n == null ? '—' : `${Math.round(n * 100)}%`);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const monthName = (ym) => { if (!ym) return '—'; const [y, m] = ym.split('-'); return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: 'numeric' }); };
const duration = (m) => (m == null ? 'Never' : m === 0 ? 'Done' : m < 12 ? `${m} mo` : `${Math.floor(m / 12)} yr ${m % 12 ? (m % 12) + ' mo' : ''}`);

// ------------------------------------------------------------------ render
function render() {
  const plan = calculateFinancialPlan(state, { debtPaymentOverrides: payoffTests });
  window.__honchoyPlan = plan; // handy for debugging / other team screens
  renderFlags(plan); renderPlan(plan); renderIncome(plan); renderExpenses(plan); renderDebts(plan); renderGoals(plan);
}

function renderFlags(plan) {
  const icon = { danger: 'circle-exclamation', warning: 'triangle-exclamation', info: 'circle-info' };
  $('#flags-section').innerHTML = plan.flags.length ? `<div class="space-y-2">${plan.flags.map((f) =>
    `<div class="flag flag-${f.level}"><i class="fas fa-${icon[f.level]} mt-0.5"></i><span>${esc(f.message)}</span></div>`).join('')}</div>` : '';
}

function renderPlan(p) {
  const b = p.budget, a = b.allocation, ef = p.emergencyFund;
  const total = p.income.monthly || 1;
  const seg = [
    ['Expenses', p.expenses.total, '#fda4c4'], ['Debt', b.debtCarveOut, '#be1257'],
    ['Emergency', a.emergencyFund, '#f43f84'], ['Goals', a.goals, '#fb6fa2'], ['Flexible', a.flexible, '#fecadd'],
  ];
  $('#tab-plan').innerHTML = `
  <div class="grid md:grid-cols-3 gap-4">
    <div class="card"><div class="label">Monthly income</div><div class="stat">${money(p.income.monthly)}</div></div>
    <div class="card"><div class="label">Disposable (after expenses)</div><div class="stat ${b.disposableIncome < 0 ? '!text-red-600' : ''}">${money(b.disposableIncome)}</div></div>
    <div class="card"><div class="label">Left after debt</div><div class="stat">${money(b.remainder)}</div></div>
  </div>

  <div class="card mt-4">
    <div class="card-title"><i class="fas fa-chart-pie"></i>Where your money goes each month</div>
    <div class="flex h-5 rounded-full overflow-hidden bg-brand-100">
      ${seg.map(([l, v, c]) => v > 0 ? `<span title="${l}: ${money(v)}" style="width:${Math.min(100, (v / total) * 100)}%;background:${c}"></span>` : '').join('')}
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
      ${seg.map(([l, v, c]) => `<span class="flex items-center gap-1"><i class="fas fa-circle" style="color:${c}"></i>${l} <b>${money(v)}</b></span>`).join('')}
    </div>
  </div>

  <div class="grid md:grid-cols-2 gap-4 mt-4">
    <div class="card">
      <div class="card-title"><i class="fas fa-list-check"></i>Your budget plan</div>
      <div class="row"><span>Income</span><b>${money(p.income.monthly)}</b></div>
      <div class="row"><span>− Expenses <span class="text-xs text-gray-400">(fixed ${money(p.expenses.fixed)} · variable ${money(p.expenses.variable)})</span></span><b>${money(p.expenses.total)}</b></div>
      <div class="row"><span>= Disposable income</span><b>${money(b.disposableIncome)}</b></div>
      <div class="row"><span>− Debt carve-out${p.debt.extraPayment ? ` <span class="text-xs text-brand-600">(incl. ${money(p.debt.extraPayment.amount)} extra on high-interest debt)</span>` : ''}</span><b>${money(b.debtCarveOut)}</b></div>
      <div class="row"><span>= To split</span><b>${money(b.remainder)}</b></div>
      <div class="row pl-3"><span><i class="fas fa-shield-heart text-brand-500 mr-1"></i>Emergency fund <span class="text-xs text-gray-400">${pct(b.weightsUsed.emergency)}</span></span><b class="text-brand-600">${money(a.emergencyFund)}</b></div>
      <div class="row pl-3"><span><i class="fas fa-bullseye text-brand-400 mr-1"></i>Goals <span class="text-xs text-gray-400">${pct(b.weightsUsed.goals)}</span></span><b class="text-brand-600">${money(a.goals)}</b></div>
      <div class="row pl-3"><span><i class="fas fa-mug-hot text-brand-300 mr-1"></i>Flexible spending <span class="text-xs text-gray-400">${pct(b.weightsUsed.flexible)}</span></span><b class="text-brand-600">${money(a.flexible)}</b></div>
    </div>
    <div class="space-y-4">
      <div class="card">
        <div class="card-title"><i class="fas fa-shield-heart"></i>Emergency fund</div>
        <div class="flex justify-between text-sm mb-1"><span>${money(ef.saved)} of ${money(ef.target)}</span><b>${pct(ef.progress)}</b></div>
        <div class="bar"><span style="width:${ef.progress * 100}%"></span></div>
        <p class="text-xs text-gray-500 mt-2">${ef.funded ? 'Fully funded — savings now go to your goals and flexible spending.' :
          `Target: ${ef.targetMonths} months of essentials. ${ef.monthsToFunded ? `At this pace: funded in ~${duration(ef.monthsToFunded)}.` : ''}`}</p>
        ${!ef.goalId ? `<button id="create-ef-btn" class="btn-soft mt-3"><i class="fas fa-plus mr-1"></i>Start tracking my emergency fund</button>` : ''}
      </div>
      <div class="card">
        <div class="card-title"><i class="fas fa-piggy-bank"></i>Saved this month</div>
        <div class="flex justify-between text-sm mb-1"><span>${money(p.savings.savedThisMonth)} of ${money(p.savings.plannedThisMonth)} planned</span></div>
        <div class="bar"><span style="width:${p.savings.plannedThisMonth ? Math.min(100, p.savings.savedThisMonth / p.savings.plannedThisMonth * 100) : 0}%"></span></div>
        <form id="log-form" class="flex gap-2 mt-3">
          <input name="amount" type="number" min="1" step="any" required placeholder="Amount saved" class="input" />
          <input name="note" placeholder="Note" class="input" />
          <button class="btn">Log</button>
        </form>
      </div>
    </div>
  </div>`;
  $('#create-ef-btn')?.addEventListener('click', () => {
    state.goals.push({ id: 'ef-' + Date.now(), name: 'Emergency fund', cost: ef.target, saved: 0, type: 'emergency' }); save();
  });
  $('#log-form').addEventListener('submit', (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    state.logs.push({ date: new Date().toISOString().slice(0, 10), amount: Number(f.get('amount')), note: String(f.get('note') || '') }); save();
  });
}

function renderIncome(p) {
  $('#tab-income').innerHTML = `
  <div class="card">
    <div class="card-title"><i class="fas fa-wallet"></i>Income sources</div>
    <div class="mb-3 max-w-xs"><label class="label">How often are you paid?</label>
      <select id="income-type" class="input">${['monthly', 'weekly', 'daily', 'yearly'].map((t) => `<option ${state.income.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    ${state.income.sources.map((s, i) => `<div class="row"><span>${esc(s.name)}</span><span class="flex items-center gap-3"><b>${money(s.amount)}</b><button class="btn-soft" data-del-income="${i}"><i class="fas fa-trash"></i></button></span></div>`).join('') || '<p class="text-sm text-gray-400">No income added yet.</p>'}
    <div class="row font-semibold"><span>Monthly total</span><span class="text-brand-600">${money(p.income.monthly)}</span></div>
    <form id="income-form" class="grid grid-cols-3 gap-2 mt-4">
      <input name="name" required placeholder="Source (e.g. salary)" class="input col-span-3 sm:col-span-1" />
      <input name="amount" type="number" min="0" step="any" required placeholder="Amount" class="input col-span-2 sm:col-span-1" />
      <button class="btn"><i class="fas fa-plus mr-1"></i>Add</button>
    </form>
  </div>`;
  $('#income-type').onchange = (e) => { state.income.type = e.target.value; save(); };
  $('#income-form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target);
    state.income.sources.push({ name: String(f.get('name')), amount: Number(f.get('amount')) }); save(); };
  document.querySelectorAll('[data-del-income]').forEach((b) => b.onclick = () => { state.income.sources.splice(+b.dataset.delIncome, 1); save(); });
}

function renderExpenses(p) {
  const row = (e, i) => `<div class="row"><span class="flex items-center gap-2"><i class="fas fa-${CAT_ICONS[e.category] || 'tag'} text-brand-400 w-5"></i>${esc(e.name || e.category)}
      <span class="pill pill-${e.type}">${e.type}</span><span class="text-xs text-gray-400">${esc(e.category)}</span></span>
      <span class="flex items-center gap-3"><b>${money(e.amount)}</b><button class="btn-soft" data-del-exp="${i}"><i class="fas fa-trash"></i></button></span></div>`;
  $('#tab-expenses').innerHTML = `
  <div class="grid md:grid-cols-3 gap-4 mb-4">
    <div class="card"><div class="label">Fixed</div><div class="stat">${money(p.expenses.fixed)}</div></div>
    <div class="card"><div class="label">Variable</div><div class="stat">${money(p.expenses.variable)}</div></div>
    <div class="card"><div class="label">Total · share of income</div><div class="stat">${money(p.expenses.total)} <span class="text-sm text-gray-400">${pct(p.expenses.shareOfIncome)}</span></div></div>
  </div>
  <div class="card">
    <div class="card-title"><i class="fas fa-receipt"></i>Monthly expenses</div>
    ${state.expenses.map(row).join('') || '<p class="text-sm text-gray-400">No expenses yet.</p>'}
    <form id="expense-form" class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
      <input name="name" placeholder="Name (e.g. House rent)" class="input col-span-2 sm:col-span-1" />
      <select name="category" class="input">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select>
      <select name="type" class="input"><option value="fixed">Fixed</option><option value="variable">Variable</option></select>
      <input name="amount" type="number" min="0" step="any" required placeholder="Amount" class="input" />
      <button class="btn"><i class="fas fa-plus mr-1"></i>Add</button>
    </form>
  </div>
  <div class="card mt-4"><div class="card-title"><i class="fas fa-layer-group"></i>By category</div>
    ${Object.entries(p.expenses.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => `
      <div class="mb-2"><div class="flex justify-between text-sm"><span>${c}</span><b>${money(v)}</b></div>
      <div class="bar"><span style="width:${p.expenses.total ? v / p.expenses.total * 100 : 0}%"></span></div></div>`).join('') || '<p class="text-sm text-gray-400">—</p>'}
  </div>`;
  $('#expense-form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target);
    state.expenses.push({ category: f.get('category'), name: String(f.get('name') || f.get('category')), amount: Number(f.get('amount')), type: f.get('type') }); save(); };
  document.querySelectorAll('[data-del-exp]').forEach((b) => b.onclick = () => { state.expenses.splice(+b.dataset.delExp, 1); save(); });
}

function renderDebts(p) {
  const d = p.debt;
  const dtiColor = d.dtiLevel === 'danger' ? 'text-red-600' : d.dtiLevel === 'warning' ? 'text-amber-600' : 'text-emerald-600';
  const card = (x) => {
    const pm = x.payoffAtMinimum, pt = x.payoffAtTestPayment;
    const badge = x.interestLevel === 'danger' ? '<span class="pill bg-red-100 text-red-700">Very high rate</span>'
      : x.interestLevel === 'warning' ? '<span class="pill bg-amber-100 text-amber-700">High rate</span>' : '';
    return `<div class="card">
      <div class="flex justify-between items-start">
        <div><div class="font-semibold text-brand-700">${esc(x.label)} ${badge}</div>
          <div class="text-xs text-gray-500">${x.interestRate}% / year · min ${money(x.minMonthlyPayment)}/mo · interest now ~${money(x.monthlyInterestNow)}/mo</div></div>
        <div class="text-right"><div class="stat text-xl">${money(x.amount)}</div><button class="btn-soft mt-1" data-del-debt="${x.index}"><i class="fas fa-trash"></i></button></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
        <div class="bg-brand-50 rounded-xl p-3"><div class="label">Paying the minimum</div>
          ${pm.payable ? `<b>${duration(pm.months)}</b> · done ${monthName(pm.payoffMonth)}<div class="text-xs text-gray-500">Total interest ${money(pm.totalInterest)}</div>`
                       : `<b class="text-red-600">Never paid off</b><div class="text-xs text-gray-500">Pay at least ${money(pm.minimumToMakeProgress)}/mo</div>`}</div>
        <div class="bg-brand-50 rounded-xl p-3"><label class="label">What if I pay per month…</label>
          <input type="number" min="0" step="any" class="input mb-1" data-test-pay="${x.index}" value="${payoffTests[x.index] ?? ''}" placeholder="${x.minMonthlyPayment}" />
          ${pt.payable ? `<b>${duration(pt.months)}</b> · done ${monthName(pt.payoffMonth)}<div class="text-xs text-gray-500">Total interest ${money(pt.totalInterest)}${pm.payable && pt.totalInterest < pm.totalInterest ? ` · <span class="text-emerald-600">save ${money(pm.totalInterest - pt.totalInterest)}</span>` : ''}</div>`
                       : `<b class="text-red-600">Never paid off</b>`}</div>
      </div>
      ${x.payoffWithPlan ? `<p class="text-xs text-brand-700 mt-2"><i class="fas fa-bolt mr-1"></i>Your plan pays ${money(x.planPayment)}/mo here → paid off in ${duration(x.payoffWithPlan.months)} (${monthName(x.payoffWithPlan.payoffMonth)}).</p>` : ''}
    </div>`;
  };
  $('#tab-debts').innerHTML = `
  <div class="grid md:grid-cols-3 gap-4 mb-4">
    <div class="card"><div class="label">Total owed</div><div class="stat">${money(d.total)}</div></div>
    <div class="card"><div class="label">Minimum payments / month</div><div class="stat">${money(d.totalMinPayments)}</div></div>
    <div class="card"><div class="label">Share of income (safe: under ${pct(d.dtiThresholds.warning)})</div><div class="stat ${dtiColor}">${pct(d.debtToIncome)}</div>
      <div class="bar mt-2"><span style="width:${Math.min(100, (d.debtToIncome || 0) / d.dtiThresholds.danger * 100)}%"></span></div></div>
  </div>
  <div class="space-y-4">${d.items.map(card).join('') || '<div class="card text-sm text-gray-400">No debts — great!</div>'}</div>
  <div class="card mt-4">
    <div class="card-title"><i class="fas fa-plus"></i>Add a debt</div>
    <form id="debt-form" class="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <div class="col-span-2 sm:col-span-1"><label class="label">Type</label><select name="type" class="input">${Object.entries(DEBT_TYPE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div><label class="label">Amount owed</label><input name="amount" type="number" min="0" step="any" required class="input" /></div>
      <div><label class="label">Interest % / year</label><input name="interestRate" type="number" min="0" step="any" required class="input" /></div>
      <div><label class="label">Min. monthly payment</label><input name="minMonthlyPayment" type="number" min="0" step="any" required class="input" /></div>
      <div class="flex items-end"><button class="btn w-full">Add</button></div>
    </form>
  </div>`;
  $('#debt-form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target);
    state.debts.push({ type: f.get('type'), amount: Number(f.get('amount')), interestRate: Number(f.get('interestRate')), minMonthlyPayment: Number(f.get('minMonthlyPayment')) }); payoffTests = {}; save(); };
  document.querySelectorAll('[data-del-debt]').forEach((b) => b.onclick = () => { state.debts.splice(+b.dataset.delDebt, 1); payoffTests = {}; save(); });
  document.querySelectorAll('[data-test-pay]').forEach((inp) => inp.onchange = () => {
    if (inp.value === '') delete payoffTests[inp.dataset.testPay]; else payoffTests[inp.dataset.testPay] = Number(inp.value);
    render();
  });
}

function renderGoals(p) {
  const g = (x) => `<div class="card">
    <div class="flex justify-between"><b class="text-brand-700">${esc(x.name)}</b><button class="btn-soft" data-del-goal="${esc(x.id)}"><i class="fas fa-trash"></i></button></div>
    <div class="flex justify-between text-sm mt-2 mb-1"><span>${money(x.saved)} of ${money(x.cost)}</span><b>${pct(x.progress)}</b></div>
    <div class="bar"><span style="width:${x.progress * 100}%"></span></div>
    <p class="text-xs text-gray-500 mt-2">${x.remaining === 0 ? 'Reached! 🎉' : x.monthlyAllocation > 0
      ? `Plan: ${money(x.monthlyAllocation)}/mo → ready in ~${duration(x.monthsToGoal)} (${monthName(x.targetMonth)})`
      : 'No money allocated yet — the emergency fund comes first or there is no surplus.'}</p>
    <form class="flex gap-2 mt-3" data-add-saved="${esc(x.id)}"><input name="amt" type="number" min="1" step="any" required placeholder="Add savings" class="input" /><button class="btn-soft">Add</button></form>
  </div>`;
  $('#tab-goals').innerHTML = `
  <div class="grid md:grid-cols-2 gap-4">${p.goals.map(g).join('') || '<div class="card text-sm text-gray-400">No goals yet.</div>'}</div>
  <div class="card mt-4"><div class="card-title"><i class="fas fa-plus"></i>New goal</div>
    <form id="goal-form" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <input name="name" required placeholder="e.g. Sewing machine" class="input col-span-2 sm:col-span-1" />
      <input name="cost" type="number" min="1" step="any" required placeholder="Cost" class="input" />
      <input name="saved" type="number" min="0" step="any" placeholder="Already saved" class="input" />
      <button class="btn">Add goal</button>
    </form></div>`;
  $('#goal-form').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target);
    state.goals.push({ id: 'g' + Date.now(), name: String(f.get('name')), cost: Number(f.get('cost')), saved: Number(f.get('saved') || 0), type: 'custom' }); save(); };
  document.querySelectorAll('[data-del-goal]').forEach((b) => b.onclick = () => { state.goals = state.goals.filter((x) => x.id !== b.dataset.delGoal); save(); });
  document.querySelectorAll('[data-add-saved]').forEach((f) => f.onsubmit = (e) => { e.preventDefault();
    const goal = state.goals.find((x) => x.id === f.dataset.addSaved); const amt = Number(new FormData(f).get('amt'));
    goal.saved = Number(goal.saved || 0) + amt;
    state.logs.push({ date: new Date().toISOString().slice(0, 10), amount: amt, note: goal.name }); save(); });
}

// ------------------------------------------------------------------ wiring
document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
  activeTab = t.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== 'tab-' + activeTab));
});
$('#load-sample-btn').onclick = () => { state = structuredClone(SAMPLE); payoffTests = {}; save(); };
$('#reset-btn').onclick = () => { if (confirm('Clear all your data?')) { state = structuredClone(EMPTY); payoffTests = {}; save(); } };
render();
