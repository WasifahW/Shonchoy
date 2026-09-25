import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'
import { buildOverview } from './lib/insights'
import { sampleData } from './lib/sample'
import { lessons } from './lib/lessons'
import { redFlags, checkAnswers, checkText } from './lib/scams'
import type { ShonchoyData } from './lib/types'

const app = new Hono()

app.use('/api/*', cors())
app.use(renderer)

// ---------- API ----------
app.get('/api/sample', (c) => c.json(sampleData))

/** POST the $honchoy data shape, get back numbers, health score and insights. */
app.post('/api/overview', async (c) => {
  let data: ShonchoyData
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Please send valid JSON.' }, 400)
  }
  if (!data || typeof data !== 'object' || !data.income) {
    return c.json({ error: 'Missing "income" in data.' }, 400)
  }
  const today = c.req.query('today') ? new Date(c.req.query('today') + 'T12:00:00') : new Date()
  return c.json(buildOverview(data, today))
})
app.get('/api/overview/sample', (c) => {
  const today = c.req.query('today') ? new Date(c.req.query('today') + 'T12:00:00') : new Date()
  return c.json(buildOverview(sampleData, today))
})

app.get('/api/lessons', (c) => c.json(lessons))

app.get('/api/scam/flags', (c) =>
  c.json(redFlags.map(({ patterns, ...f }) => f))
)
app.post('/api/scam/check', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (typeof body.text === 'string') return c.json(checkText(body.text))
  if (Array.isArray(body.yes)) return c.json(checkAnswers(body.yes))
  return c.json({ error: 'Send { text } or { yes: [ids] }.' }, 400)
})

// ---------- Page ----------
app.get('/', (c) =>
  c.render(
    <>
      <header class="topbar">
        <div class="brand">
          <span class="logo"><i class="fa-solid fa-piggy-bank"></i></span>
          <div>
            <strong>$honchoy</strong>
            <small>Insights &amp; learning</small>
          </div>
        </div>
        <button id="edit-data-btn" class="ghost-btn" type="button">
          <i class="fa-solid fa-pen"></i> <span>My numbers</span>
        </button>
      </header>

      <nav class="tabs" role="tablist" aria-label="Sections">
        <button role="tab" class="tab active" data-tab="overview" aria-selected="true">
          <i class="fa-solid fa-chart-pie"></i><span>Overview</span>
        </button>
        <button role="tab" class="tab" data-tab="learn" aria-selected="false">
          <i class="fa-solid fa-book-open"></i><span>Learn</span>
        </button>
        <button role="tab" class="tab" data-tab="scams" aria-selected="false">
          <i class="fa-solid fa-shield-heart"></i><span>Stay safe</span>
        </button>
      </nav>

      <main>
        {/* ---------- Overview ---------- */}
        <section id="overview-section" class="panel active" data-panel="overview">
          <div id="overview-root" class="loading">Loading your overview…</div>
        </section>

        {/* ---------- Learn ---------- */}
        <section id="learn-section" class="panel" data-panel="learn" hidden>
          <div class="section-head">
            <h1>Money basics, made simple</h1>
            <p>Short lessons, no jargon. Tap a card to read it — about 2 minutes each.</p>
            <div class="learn-progress">
              <div class="bar"><span id="learn-bar"></span></div>
              <small id="learn-count">0 of 0 read</small>
            </div>
          </div>
          <div id="lesson-grid" class="lesson-grid"></div>
        </section>

        {/* ---------- Scams ---------- */}
        <section id="scams-section" class="panel" data-panel="scams" hidden>
          <div class="section-head">
            <h1>Is this offer safe?</h1>
            <p>Scammers are clever, but they use the same tricks again and again. Learn the signs and check any offer before you pay.</p>
          </div>

          <article class="card checker">
            <div class="checker-switch" role="tablist">
              <button class="chip active" data-mode="questions" type="button">Answer questions</button>
              <button class="chip" data-mode="paste" type="button">Paste a message</button>
            </div>

            <form id="question-form" class="checker-mode" data-mode-panel="questions">
              <p class="muted">Think about the offer and answer honestly.</p>
              <ol id="question-list" class="question-list"></ol>
              <button class="primary-btn" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Check this offer</button>
            </form>

            <form id="paste-form" class="checker-mode" data-mode-panel="paste" hidden>
              <label for="scam-text" class="muted">Paste the SMS, WhatsApp or Facebook message here:</label>
              <textarea id="scam-text" rows={5} placeholder="e.g. Congratulations! Guaranteed 40% profit every month. Only today — pay ৳500 registration fee to join…"></textarea>
              <button class="primary-btn" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Check this message</button>
              <small class="muted">Your message stays private — it is only checked, never saved.</small>
            </form>

            <div id="scam-result" class="scam-result" hidden aria-live="polite"></div>
          </article>

          <h2 class="sub-head">Red flags to watch for</h2>
          <div id="flag-list" class="flag-list"></div>

          <aside class="card safe-tips">
            <h3><i class="fa-solid fa-heart"></i> Golden rules</h3>
            <ul>
              <li>Never share your PIN or OTP code with anyone.</li>
              <li>If it sounds too good to be true, it is.</li>
              <li>Take your time — a real offer can wait a day.</li>
              <li>Talk it over with someone you trust before paying.</li>
            </ul>
          </aside>
        </section>
      </main>

      {/* Lesson reader */}
      <dialog id="lesson-dialog" class="sheet">
        <div id="lesson-body"></div>
      </dialog>

      {/* Data editor */}
      <dialog id="data-dialog" class="sheet">
        <form method="dialog" id="data-form">
          <h2>My numbers</h2>
          <p class="muted">This is the information the overview uses. It stays on this device.</p>
          <textarea id="data-json" rows={16} spellcheck={false}></textarea>
          <p id="data-error" class="error" hidden></p>
          <div class="row-btns">
            <button type="button" id="data-reset" class="ghost-btn">Use example</button>
            <button type="button" id="data-cancel" class="ghost-btn">Cancel</button>
            <button type="submit" id="data-save" class="primary-btn">Save</button>
          </div>
        </form>
      </dialog>

      <footer class="foot">
        Made with care by $honchoy · For learning only, not financial advice.
      </footer>
    </>
  )
)

export default app
