/* $honchoy — Insights & Education module (frontend) */
(() => {
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]
  const DATA_KEY = 'shonchoy.data'
  const READ_KEY = 'shonchoy.lessonsRead'
  const money = (n) => '৳' + Math.round(n).toLocaleString('en-US')
  const pct = (n) => Math.round(n * 100) + '%'
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)

  const api = async (url, body) => {
    const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Something went wrong')
    return j
  }

  // ---------------- Tabs ----------------
  function showTab(name) {
    $$('.tab').forEach((t) => {
      const on = t.dataset.tab === name
      t.classList.toggle('active', on)
      t.setAttribute('aria-selected', on)
    })
    $$('.panel').forEach((p) => {
      const on = p.dataset.panel === name
      p.hidden = !on
      p.classList.toggle('active', on)
    })
    history.replaceState(null, '', '#' + name)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)))
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]')
    if (go) { e.preventDefault(); showTab(go.dataset.go); if (go.dataset.lesson) openLesson(go.dataset.lesson) }
  })

  // ---------------- Data ----------------
  let sample = null
  async function getData() {
    const saved = localStorage.getItem(DATA_KEY)
    if (saved) { try { return JSON.parse(saved) } catch {} }
    sample = sample || (await api('/api/sample'))
    return sample
  }

  // ---------------- Overview ----------------
  function ring(score) {
    const r = 52, c = 2 * Math.PI * r
    const off = c * (1 - score / 100)
    return `
      <svg viewBox="0 0 120 120" class="ring" role="img" aria-label="Health score ${score} out of 100">
        <circle cx="60" cy="60" r="${r}" class="ring-bg"/>
        <circle cx="60" cy="60" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${off}"/>
        <text x="60" y="58" text-anchor="middle" class="ring-num">${score}</text>
        <text x="60" y="78" text-anchor="middle" class="ring-sub">out of 100</text>
      </svg>`
  }

  function lessonForInsight(o) {
    if (o.debts.some((d) => d.interestRate >= 15)) return ['debt', 'How to clear debt faster']
    if (o.savingsRate < 0.1) return ['saving', 'Learn: pay yourself first']
    return ['emergency', 'Learn: build a safety cushion']
  }

  function renderOverview(o) {
    const root = $('#overview-root')
    root.classList.remove('loading')
    const spend = o.monthlyExpenses + o.monthlyDebtPayments
    const maxBar = Math.max(o.monthlyIncome, spend, 1)
    const [lessonId, lessonLabel] = lessonForInsight(o)
    const scoreClass = o.health.score >= 80 ? 'great' : o.health.score >= 60 ? 'good' : o.health.score >= 40 ? 'ok' : 'low'

    const leftClass = o.leftOver >= 0 ? 'pos' : 'neg'
    const catRows = o.expensesByCategory.map((e) => `
      <li><span>${esc(cap(e.category))}</span><b>${money(e.amount)}</b><small>${pct(e.share)} of income</small></li>`).join('')

    const goalCards = o.goals.length ? o.goals.map((g) => `
      <div class="goal">
        <div class="goal-top">
          <span class="goal-icon"><i class="fa-solid fa-star"></i></span>
          <div><b>${esc(g.name)}</b><small>${money(g.saved)} of ${money(g.cost)}</small></div>
          <span class="goal-pct">${pct(g.percent)}</span>
        </div>
        <div class="bar big"><span style="--w:${g.percent * 100}%"></span></div>
        <small class="muted">${g.remaining === 0 ? 'Goal reached — well done! 🎉'
          : g.monthsAtCurrentPace ? `${money(g.remaining)} to go · about ${g.monthsAtCurrentPace} month${g.monthsAtCurrentPace > 1 ? 's' : ''} at your current pace`
          : `${money(g.remaining)} to go · start saving to see your timeline`}</small>
      </div>`).join('') : '<p class="muted">No goals yet. What would you love to save for?</p>'

    const debtRows = o.debts.map((d) => `
      <div class="debt">
        <div><b>${esc(cap(d.type))}</b><small>${d.interestRate}% a year · ${money(d.minMonthlyPayment)}/month</small></div>
        <div class="debt-right"><b>${money(d.amount)}</b>
          <small>${d.monthsToPayOff === null ? 'Payment too small to finish' : `Paid off in ~${d.monthsToPayOff} months`}</small></div>
      </div>`).join('')

    root.innerHTML = `
      <div class="hello">
        <h1>Hi there 👋</h1>
        <p>Here’s how your money is doing this month.</p>
      </div>

      <div class="grid-top">
        <article class="card score-card ${scoreClass}">
          <h2>Money health</h2>
          ${ring(o.health.score)}
          <p class="score-label">${esc(o.health.label)}</p>
          <p class="muted center">${esc(o.health.mood)}</p>
          <button class="link-btn" id="score-why" type="button" aria-expanded="false">How is this worked out? <i class="fa-solid fa-chevron-down"></i></button>
          <ul id="score-parts" class="score-parts" hidden>
            ${o.health.parts.map((p) => `
              <li title="${esc(p.hint)}">
                <div class="sp-top"><span>${esc(p.label)}</span><b>${Math.round(p.points)}/${p.max}</b></div>
                <div class="bar"><span style="--w:${(p.points / p.max) * 100}%"></span></div>
                <small class="muted">${esc(p.hint)}</small>
              </li>`).join('')}
          </ul>
        </article>

        <article class="card insight-card">
          <h2><i class="fa-solid fa-lightbulb"></i> What we notice</h2>
          <ul class="insights">
            ${o.insights.map((t) => `<li>${esc(t)}</li>`).join('')}
          </ul>
          <a href="#learn" class="soft-btn" data-go="learn" data-lesson="${lessonId}"><i class="fa-solid fa-book-open"></i> ${lessonLabel}</a>
        </article>
      </div>

      <div class="stats">
        <div class="stat"><i class="fa-solid fa-arrow-down"></i><small>Money in</small><b>${money(o.monthlyIncome)}</b></div>
        <div class="stat"><i class="fa-solid fa-arrow-up"></i><small>Money out</small><b>${money(spend)}</b></div>
        <div class="stat ${leftClass}"><i class="fa-solid fa-wallet"></i><small>Left over</small><b>${money(o.leftOver)}</b></div>
        <div class="stat"><i class="fa-solid fa-piggy-bank"></i><small>Saved (30 days)</small><b>${money(o.savedLast30Days)}</b></div>
      </div>

      <div class="grid-two">
        <article class="card">
          <h2>Money in vs. money out</h2>
          <div class="compare">
            <div class="cmp-row"><span>Income</span><div class="cmp-bar in"><span style="--w:${(o.monthlyIncome / maxBar) * 100}%"></span></div><b>${money(o.monthlyIncome)}</b></div>
            <div class="cmp-row"><span>Bills</span><div class="cmp-bar out"><span style="--w:${(o.monthlyExpenses / maxBar) * 100}%"></span></div><b>${money(o.monthlyExpenses)}</b></div>
            <div class="cmp-row"><span>Loans</span><div class="cmp-bar debt"><span style="--w:${(o.monthlyDebtPayments / maxBar) * 100}%"></span></div><b>${money(o.monthlyDebtPayments)}</b></div>
            <div class="cmp-row"><span>Saved</span><div class="cmp-bar save"><span style="--w:${(o.savedLast30Days / maxBar) * 100}%"></span></div><b>${money(o.savedLast30Days)}</b></div>
          </div>
          <ul class="cats">${catRows}</ul>
          <p class="muted small">Fixed costs ${money(o.fixedExpenses)} · Changeable costs ${money(o.variableExpenses)}</p>
        </article>

        <article class="card">
          <h2>Savings</h2>
          <div class="save-meter">
            <div class="sm-top"><span>You saved <b>${pct(o.savingsRate)}</b> of your income</span><small>Aim: 20%</small></div>
            <div class="bar big target"><span style="--w:${Math.min(100, (o.savingsRate / 0.2) * 100)}%"></span></div>
            <small class="muted">${o.savingsRate >= 0.2 ? 'You hit the target — amazing!' : `Saving ${money(Math.max(0, o.monthlyIncome * 0.2 - o.savedLast30Days))} more a month would reach 20%.`}</small>
          </div>
          <h3 class="mini-head">Goals</h3>
          ${goalCards}
          ${o.debts.length ? `<h3 class="mini-head">Loans</h3>${debtRows}` : ''}
        </article>
      </div>`

    requestAnimationFrame(() => {
      const fg = $('.ring-fg', root)
      if (fg) fg.style.strokeDashoffset = fg.dataset.off
      $$('.bar span, .cmp-bar span', root).forEach((s) => s.classList.add('grow'))
    })
    $('#score-why', root).addEventListener('click', (e) => {
      const list = $('#score-parts', root)
      list.hidden = !list.hidden
      e.currentTarget.setAttribute('aria-expanded', String(!list.hidden))
      e.currentTarget.classList.toggle('open', !list.hidden)
    })
  }

  async function loadOverview() {
    const root = $('#overview-root')
    try {
      const data = await getData()
      renderOverview(await api('/api/overview', data))
    } catch (err) {
      root.innerHTML = `<div class="card"><p>Sorry, we couldn’t read your numbers. ${esc(err.message)}</p></div>`
    }
  }

  // ---------------- Lessons ----------------
  let lessons = []
  const readSet = () => new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'))
  function markRead(id) {
    const s = readSet(); s.add(id)
    localStorage.setItem(READ_KEY, JSON.stringify([...s]))
    renderLessons()
  }
  function renderLessons() {
    const read = readSet()
    $('#lesson-grid').innerHTML = lessons.map((l, i) => `
      <button class="lesson-card ${read.has(l.id) ? 'done' : ''}" data-id="${l.id}" type="button" style="--i:${i}">
        <span class="lc-icon"><i class="fa-solid ${l.icon}"></i></span>
        <span class="lc-topic">${esc(l.topic)} · ${l.minutes} min</span>
        <strong>${esc(l.title)}</strong>
        <span class="lc-idea">${esc(l.bigIdea)}</span>
        <span class="lc-status">${read.has(l.id) ? '<i class="fa-solid fa-circle-check"></i> Read' : 'Read lesson <i class="fa-solid fa-arrow-right"></i>'}</span>
      </button>`).join('')
    const n = lessons.filter((l) => read.has(l.id)).length
    $('#learn-count').textContent = `${n} of ${lessons.length} read${n === lessons.length && n ? ' — you did it! 🌸' : ''}`
    $('#learn-bar').style.width = lessons.length ? (n / lessons.length) * 100 + '%' : '0'
  }
  function openLesson(id) {
    const idx = lessons.findIndex((l) => l.id === id)
    const l = lessons[idx]
    if (!l) return
    const next = lessons[(idx + 1) % lessons.length]
    $('#lesson-body').innerHTML = `
      <button class="close-btn" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      <span class="lc-icon big"><i class="fa-solid ${l.icon}"></i></span>
      <small class="lc-topic">${esc(l.topic)} · ${l.minutes} min read</small>
      <h2>${esc(l.title)}</h2>
      <p class="big-idea">${esc(l.bigIdea)}</p>
      ${l.body.map((p) => `<p>${esc(p)}</p>`).join('')}
      <div class="example"><b><i class="fa-solid fa-calculator"></i> For example</b><p>${esc(l.example)}</p></div>
      <div class="try"><b><i class="fa-solid fa-hand-sparkles"></i> Try this</b><p>${esc(l.tryThis)}</p></div>
      <div class="row-btns">
        <button class="ghost-btn" type="button" data-next="${next.id}">Next: ${esc(next.title)}</button>
        <button class="primary-btn" type="button" data-done="${l.id}"><i class="fa-solid fa-check"></i> Got it</button>
      </div>`
    const dlg = $('#lesson-dialog')
    if (!dlg.open) dlg.showModal()
    dlg.scrollTop = 0
  }
  $('#lesson-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.lesson-card')
    if (card) openLesson(card.dataset.id)
  })
  $('#lesson-dialog').addEventListener('click', (e) => {
    const dlg = e.currentTarget
    if (e.target === dlg || e.target.closest('.close-btn')) return dlg.close()
    const done = e.target.closest('[data-done]')
    if (done) { markRead(done.dataset.done); dlg.close() }
    const nx = e.target.closest('[data-next]')
    if (nx) { markRead($('[data-done]', dlg).dataset.done); openLesson(nx.dataset.next) }
  })

  // ---------------- Scams ----------------
  let flags = []
  function renderFlags() {
    $('#flag-list').innerHTML = flags.map((f) => `
      <details class="flag">
        <summary><span class="flag-icon"><i class="fa-solid ${f.icon}"></i></span><b>${esc(f.title)}</b><i class="fa-solid fa-chevron-down chev"></i></summary>
        <div class="flag-body">
          <p class="quote">${esc(f.whatItSounds)}</p>
          <p><b>Why it’s risky:</b> ${esc(f.whyRisky)}</p>
          <p class="todo"><i class="fa-solid fa-heart"></i> ${esc(f.whatToDo)}</p>
        </div>
      </details>`).join('')
    $('#question-list').innerHTML = flags.map((f) => `
      <li>
        <span>${esc(f.question)}</span>
        <div class="yn" role="radiogroup" aria-label="${esc(f.question)}">
          <label><input type="radio" name="${f.id}" value="yes"><span>Yes</span></label>
          <label><input type="radio" name="${f.id}" value="no"><span>No</span></label>
          <label><input type="radio" name="${f.id}" value="unsure"><span>Not sure</span></label>
        </div>
      </li>`).join('')
  }
  function renderResult(r, unsure = 0) {
    const icons = { high: 'fa-triangle-exclamation', medium: 'fa-circle-exclamation', low: 'fa-circle-check' }
    const box = $('#scam-result')
    box.className = 'scam-result ' + r.level
    box.hidden = false
    box.innerHTML = `
      <div class="res-head"><i class="fa-solid ${icons[r.level]}"></i><div><b>${esc(r.headline)}</b><p>${esc(r.advice)}</p></div></div>
      ${unsure ? `<p class="muted small">You weren’t sure about ${unsure} question${unsure > 1 ? 's' : ''}. When in doubt, ask the person to explain — a real business won’t mind.</p>` : ''}
      ${r.matched.length ? `<ul class="res-list">${r.matched.map((m) => `
        <li><b>${esc(m.title)}</b>${m.evidence.length ? ` <span class="ev">found: ${m.evidence.map((x) => '“' + esc(x) + '”').join(', ')}</span>` : ''}<small>${esc(m.whatToDo)}</small></li>`).join('')}</ul>` : ''}`
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  $$('.checker-switch .chip').forEach((b) => b.addEventListener('click', () => {
    $$('.checker-switch .chip').forEach((x) => x.classList.toggle('active', x === b))
    $$('.checker-mode').forEach((p) => (p.hidden = p.dataset.modePanel !== b.dataset.mode))
    $('#scam-result').hidden = true
  }))
  $('#question-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const yes = flags.filter((f) => fd.get(f.id) === 'yes').map((f) => f.id)
    const unsure = flags.filter((f) => fd.get(f.id) === 'unsure').length
    const answered = flags.filter((f) => fd.get(f.id)).length
    if (!answered) {
      $('#scam-result').hidden = false
      $('#scam-result').className = 'scam-result medium'
      $('#scam-result').innerHTML = '<p>Please answer at least one question first.</p>'
      return
    }
    renderResult(await api('/api/scam/check', { yes }), unsure)
  })
  $('#paste-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const text = $('#scam-text').value.trim()
    if (!text) { $('#scam-text').focus(); return }
    renderResult(await api('/api/scam/check', { text }))
  })

  // ---------------- Data editor ----------------
  const dataDlg = $('#data-dialog')
  $('#edit-data-btn').addEventListener('click', async () => {
    $('#data-json').value = JSON.stringify(await getData(), null, 2)
    $('#data-error').hidden = true
    dataDlg.showModal()
  })
  $('#data-cancel').addEventListener('click', () => dataDlg.close())
  $('#data-reset').addEventListener('click', async () => {
    sample = sample || (await api('/api/sample'))
    $('#data-json').value = JSON.stringify(sample, null, 2)
  })
  $('#data-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      const data = JSON.parse($('#data-json').value)
      const o = await api('/api/overview', data)
      localStorage.setItem(DATA_KEY, JSON.stringify(data))
      renderOverview(o)
      dataDlg.close()
      showTab('overview')
    } catch (err) {
      $('#data-error').textContent = 'That doesn’t look quite right: ' + err.message
      $('#data-error').hidden = false
    }
  })

  // ---------------- Boot ----------------
  ;(async () => {
    const start = (location.hash || '#overview').slice(1)
    if (['overview', 'learn', 'scams'].includes(start)) showTab(start)
    const [l, f] = await Promise.all([api('/api/lessons'), api('/api/scam/flags')])
    lessons = l; flags = f
    renderLessons(); renderFlags()
    loadOverview()
  })()
})()
