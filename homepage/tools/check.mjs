/*
  The homepage's standing checks, in one script.

  CLAUDE.md §5 says "Verify, then write down how", and this file is the how.
  Everything in it was written while chasing a real bug, and two of the checks
  have already caught one:

    - the drawing fingerprint caught a refactor that deleted `iso` and `n`
      along with the palettes it was meant to remove (log §18)
    - the width sweep is what proved the h1 was spilling into the hero panel
      rather than merely looking tight (log §15)

  No dependency, like everything else here. It drives headless Chrome over the
  DevTools Protocol using the global WebSocket in Node 22+, the same way
  capture-screenshots.mjs does.

  Usage:
    npx serve homepage            # or: python -m http.server 8777
    node tools/check.mjs [port]
    node tools/check.mjs 8777 --save    # rewrite the drawing baseline

  The baseline lives in tools/drawings.sha256 and is one line: the hash of
  every drawing block.js can produce over a grid of inputs. Change a drawing on
  purpose and the hash changes, so --save is how you say "yes, I meant that".
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT_PAGE = process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : '8777'
const SAVE = process.argv.includes('--save')
const PAGE = `http://127.0.0.1:${PORT_PAGE}/`
const HERE = fileURLToPath(new URL('.', import.meta.url))
const BASELINE = join(HERE, 'drawings.sha256')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const CDP = 9350

const sleep = ms => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (name, pass, detail = '') => {
  if (!pass) fails++
  console.log((pass ? '  ok   ' : '  FAIL ') + name.padEnd(46) + detail)
}

/* ---------------------------------------------------------------- budget */

// project.md §7. Uncompressed, which is how the table is written.
function budget() {
  console.log('\nBudget')
  const kb = n => (n / 1024).toFixed(1)
  const size = f => Buffer.byteLength(readFileSync(join(HERE, '..', f), 'utf8'))
  const hc = size('index.html') + size('styles.css')
  const js = size('block.js') + size('scenes.js')
  ok('HTML + CSS under 40 KB', hc <= 40 * 1024, kb(hc) + ' KB')
  ok('JavaScript under 24 KB', js <= 24 * 1024, kb(js) + ' KB')
}

/* ------------------------------------------------------------------ CDP */

function browser(noJs) {
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1280,1000',
    `--remote-debugging-port=${CDP}`, '--no-first-run',
    '--user-data-dir=' + join(tmpdir(), 'urbgen-check' + (noJs ? '-nojs' : ''))]
  if (noJs) args.push('--blink-settings=scriptEnabled=false')
  args.push(PAGE + '?v=' + Date.now())
  return spawn(CHROME, args, { stdio: 'ignore' })
}

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${CDP}/json/list`).then(r => r.json())
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging target')
}

async function session(noJs, body) {
  const chrome = browser(noJs)
  const url = await connect()
  const ws = new WebSocket(url)
  const pending = new Map()
  let id = 0
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? rej(new Error(m.error.message)) : res(m.result)
    }
  })
  await new Promise(r => ws.addEventListener('open', r))
  await send('Page.enable')
  await send('Runtime.enable')
  await sleep(1600)
  const ev = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails))
    return r.result.value
  }
  try { await body(ev, send) } finally { ws.close(); chrome.kill() }
}

/* --------------------------------------------------------------- checks */

// Structure that must hold whether or not the script runs.
async function structure(ev, label) {
  console.log('\n' + label)
  const h = await ev(`(() => {
    const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map(e => +e.tagName[1]);
    let jump = null;
    for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i-1] + 1) jump = hs[i-1] + '->' + hs[i];
    return { h1s: hs.filter(n => n === 1).length, jump };
  })()`)
  ok('exactly one h1', h.h1s === 1, 'found ' + h.h1s)
  ok('no heading-level jump', h.jump === null, h.jump || '')

  const dead = await ev(`[...document.querySelectorAll('a[href^="#"]')]
    .map(a => a.getAttribute('href'))
    .filter(v => v !== '#' && !document.querySelector(v))`)
  ok('no dead in-page links', dead.length === 0, dead.join(' '))

  const img = await ev(`[...document.images].filter(i => !i.alt || !i.width || !i.height).length`)
  ok('every image has alt and dimensions', img === 0, img ? img + ' missing' : '')

  /*
    The claims project.md §5 requires, wherever on the page they live.
    textContent, not innerText: the FAQ answers sit in collapsed <details>, and
    innerText skips them — which read as a missing claim the first time this
    ran. Scoped to <main> so the JSON-LD mirror in <head> cannot answer for the
    visible page.
  */
  const claims = await ev(`(() => {
    const t = document.querySelector('main').textContent.toLowerCase();
    return { account: t.includes('no account'), upload: t.includes('uploaded'),
             offline: t.includes('offline'), estimate: t.includes('estimate'),
             ifc: t.includes('ifc') };
  })()`)
  for (const [k, v] of Object.entries(claims)) ok('claim present: ' + k, v)
}

async function widths(ev, send) {
  console.log('\nNo horizontal overflow')
  for (const w of [1280, 1100, 900, 680, 430, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: false })
    await sleep(350)
    const r = await ev(`({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })`)
    ok('at ' + w + ' px', r.s === r.c, r.s + ' vs ' + r.c)
  }
  await send('Emulation.clearDeviceMetricsOverride')
}

// The tabs are a disclosure list: one open, on a press, never on a timer.
async function tabs(ev) {
  console.log('\nTabs')
  const start = await ev(`[...document.querySelector('.tabs').children].filter(li => li.classList.contains('on')).length`)
  ok('one tab open at load', start === 1, String(start))
  const before = await ev(`[...document.querySelector('.tabs').children].map(li => li.classList.contains('on') ? 1 : 0).join('')`)
  await sleep(6000)
  const after = await ev(`[...document.querySelector('.tabs').children].map(li => li.classList.contains('on') ? 1 : 0).join('')`)
  ok('does not advance on its own', before === after, before + ' -> ' + after)
  const pressed = await ev(`(() => {
    const t = document.querySelector('.tabs');
    t.children[4].querySelector('.tab-open').click();
    const on = [...t.children].map(li => li.classList.contains('on') ? 1 : 0).join('');
    const aria = [...t.querySelectorAll('.tab-open')].map(b => b.getAttribute('aria-expanded') === 'true' ? 1 : 0).join('');
    return { on, aria };
  })()`)
  ok('a press opens exactly that tab', pressed.on === '00001000', pressed.on)
  ok('aria-expanded follows', pressed.aria === pressed.on, pressed.aria)
}

async function withoutScript(ev) {
  console.log('\nScripting off')
  const r = await ev(`(() => {
    const vis = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : 'missing' };
    const lists = [...document.querySelector('.tabs').children]
      .filter(li => { const u = li.querySelector('.tab-params'); return u && u.getBoundingClientRect().height > 4 }).length;
    return { metrics: vis('#metrics-scene'), options: vis('#options-scene'),
             fallback: vis('.toy-fallback'), hint: vis('.tabs-hint'), lists };
  })()`)
  ok('animated figures hidden', r.metrics === 'none' && r.options === 'none', r.metrics + ' / ' + r.options)
  ok('hero falls back to its drawing', r.fallback === 'block', r.fallback)
  ok('the click hint is hidden', r.hint === 'none', r.hint)
  ok('every parameter list stands open', r.lists === 8, String(r.lists))
}

/*
  Every drawing block.js can make, hashed. This is the check to run around any
  change to the geometry that is meant to change nothing — a rename, a strip, a
  refactor. It compares the whole SVG string, so it notices a moved decimal.
*/
async function drawings(ev) {
  console.log('\nDrawings')
  const dump = await ev(`(() => {
    const out = [];
    for (const p of ['court','L','U','bar','ref'])
      for (const f of [1,6,8,14,20]) for (const m of [3.0,3.2,6,7.5]) for (const d of [12,13,14]) {
        const r = window.URBGEN.block(p, f, m, d);
        out.push([p,f,m,d,r.viewBox,r.foot,r.gfa,r.tall,r.svg].join('|'));
        const q = window.URBGEN.block(p, f, m, d, [110,90]);
        out.push([p,f,m,d,'plot',q.viewBox,q.cover.toFixed(4),q.far.toFixed(4),q.svg].join('|'));
      }
    const SITES = [
      [[20,12,70,12,5],[20,39,70,12,5],[20,66,70,12,5]],
      [[12,12,86,13,5],[12,65,86,13,5],[12,25,13,40,5],[85,25,13,40,5]],
      [[14,64,82,14,3],[22,24,24,24,12],[64,24,24,24,12]],
      [[12,12,48,13,6],[12,25,13,33,6],[50,65,48,13,6],[85,32,13,33,6]],
      [[14,14,82,13,8],[40,50,30,24,10]]
    ];
    for (const s of SITES) {
      const r = window.URBGEN.site([110,90], s);
      out.push(['site',r.viewBox,r.foot,r.gfa,r.cover.toFixed(4),r.far.toFixed(4),r.svg].join('|'));
    }
    return out.join(String.fromCharCode(10));
  })()`)
  const count = dump.split('\n').length
  const hash = createHash('sha256').update(dump).digest('hex')
  if (SAVE) {
    writeFileSync(BASELINE, hash + '\n')
    console.log('  saved  baseline for ' + count + ' drawings: ' + hash.slice(0, 16) + '…')
    return
  }
  if (!existsSync(BASELINE)) {
    console.log('  note   no baseline yet; run with --save. ' + count + ' drawings, ' + hash.slice(0, 16) + '…')
    return
  }
  const want = readFileSync(BASELINE, 'utf8').trim()
  ok(count + ' drawings unchanged', hash === want, hash === want ? hash.slice(0, 16) + '…' : 'got ' + hash.slice(0, 16) + '… want ' + want.slice(0, 16) + '…')
}

/* ------------------------------------------------------------------ run */

console.log('Checking ' + PAGE)
budget()
await session(false, async (ev, send) => {
  await structure(ev, 'Structure')
  await tabs(ev)
  await drawings(ev)
  await widths(ev, send)
})
await session(true, async ev => {
  await structure(ev, 'Structure, scripting off')
  await withoutScript(ev)
})

console.log(fails ? '\n' + fails + ' FAILED' : '\nall checks passed')
process.exit(fails ? 1 : 0)
