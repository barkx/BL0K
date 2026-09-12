/*
  Captures the homepage's screenshots from the running app.

  project.md §6 wants every shot reproducible rather than approximated. A
  script is a stronger guarantee than a saved config: this file *is* the
  record of how each image was made, and re-running it after a UI change is
  the whole of the retake.

  No dependencies. It drives Chrome over the DevTools Protocol using the
  global WebSocket in Node 22+, because the alternative was adding Puppeteer
  to a project whose entire point is not having a dependency tree.

  Headless is not a workaround here, it is the only option: R3F will not size
  or render its canvas while the document is hidden, which is what a
  backgrounded browser window is.

  Usage:
    npm run dev                 # in the app, note the port
    node tools/capture-screenshots.mjs [port]
*/
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// localhost, not 127.0.0.1: Vite binds the IPv6 loopback only, so ::1 is
// where the server actually is and 127.0.0.1 refuses the connection.
const APP = `http://localhost:${process.argv[2] || 5173}/`
const OUT = fileURLToPath(new URL('../assets/', import.meta.url))
const W = 1600, H = 1000
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9339
// Chrome's profile goes to the OS temp dir, never inside the repo: Vite's
// watcher follows anything under it, and a locked Chrome session file takes
// the dev server down with EBUSY.
const PROFILE = join(tmpdir(), 'urbgen-capture-profile')

mkdirSync(OUT, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--user-data-dir=' + PROFILE,
  APP,
], { stdio: 'ignore' })

let ws, id = 0
const pending = new Map()

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })
}

/** Run an expression in the page and return its value. */
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression)
  return r.result.value
}

/*
  Captured PNGs run ~150 KB each, which three of would break §7's 400 KB page
  budget on their own. Re-encode in the page itself: draw to a canvas at the
  width the page actually displays, then toDataURL('image/webp'). The PNG is
  kept as the <picture> fallback — no modern browser fetches it, so it costs
  the repo rather than the visitor.
*/
async function toWebp(pngB64, maxW, quality = 0.82) {
  return evaluate(`(async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,${pngB64}';
    await img.decode();
    const scale = Math.min(1, ${maxW} / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', ${quality}).split(',')[1];
  })()`)
}

async function shot(name, clip, maxW = 1200) {
  const p = { format: 'png', captureBeyondViewport: false }
  if (clip) p.clip = { ...clip, scale: 1 }
  const { data } = await send('Page.captureScreenshot', p)
  const png = Buffer.from(data, 'base64')
  writeFileSync(OUT + name + '.png', png)
  const webpB64 = await toWebp(data, maxW)
  const webp = Buffer.from(webpB64, 'base64')
  writeFileSync(OUT + name + '.webp', webp)
  console.log(
    name.padEnd(16),
    'png', String(Math.round(png.length / 1024)).padStart(4) + 'KB',
    'webp', String(Math.round(webp.length / 1024)).padStart(4) + 'KB',
    clip ? `clip ${clip.width}x${clip.height}` : `${W}x${H}`)
}

/** Click a button by its visible text. Returns false if not found. */
const clickText = text => evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)});
  if (!b) return false; b.click(); return true;
})()`)

/** Bounding box of an element, for clipping a screenshot to it. */
const boxOf = sel => evaluate(`(() => {
  const e = document.querySelector(${JSON.stringify(sel)});
  if (!e) return null; const r = e.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
})()`)

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json())
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging target')
}

const url = await connect()
ws = new WebSocket(url)
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? rej(new Error(m.error.message)) : res(m.result)
  }
})
await new Promise(r => ws.addEventListener('open', r, { once: true }))

await send('Page.enable')
await send('Runtime.enable')

// The app builds geometry on mount; give it room, then confirm rather than hope.
await sleep(4000)
const where = await evaluate('location.href + " | readyState=" + document.readyState + " | bodyLen=" + document.body.innerHTML.length')
console.log('attached to:', where)
if (!where.startsWith(APP)) {            // attached to a blank tab; drive it there
  await send('Page.navigate', { url: APP })
  await sleep(5000)
  console.log('re-navigated to:', await evaluate('location.href'))
}
let canvas = null
for (let i = 0; i < 24; i++) {           // the canvas appears once R3F mounts
  canvas = await evaluate(`(() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null })()`)
  if (canvas && canvas[0] > 400) break
  await sleep(500)
}
if (!canvas || canvas[0] < 400) throw new Error('canvas never sized: ' + JSON.stringify(canvas))
console.log('canvas', canvas.join('x'))

// 1. The whole app, as it opens. This is the hero.
await shot('shot-hero')

// 2. The metrics panel on its own.
const metrics = await boxOf('.metrics, .metrics-panel, [class*="metrics"]')
if (metrics && metrics.width > 100) {
  const footer = await evaluate(`(() => {
    const e = [...document.querySelectorAll('*')].find(n => /triangles/.test(n.textContent) && n.children.length === 0);
    return e ? Math.round(e.getBoundingClientRect().top) : null;
  })()`)
  const bottom = footer || (metrics.y + metrics.height)
  await shot('shot-metrics', {
    x: metrics.x - 8, y: metrics.y - 8, width: metrics.width + 16, height: bottom - metrics.y + 2,
  }, 700)
} else {
  console.log('! metrics panel not found by selector; skipped')
}

// 3–5. One shot per tab, since a tab is a tool and each shows different handles.
for (const [tab, file] of [['Massing', 'shot-massing'], ['Facade', 'shot-facade'], ['Site', 'shot-site']]) {
  const ok = await clickText(tab)
  if (!ok) { console.log('! tab not found:', tab); continue }
  await sleep(1400)
  await shot(file)
  // Cropped to rail, panel, model and metrics — everything the caption claims,
  // and nothing else. Shown full column width on the page this reads at about
  // 11 px; the uncropped 1600 px window rendered the same text at 3 px.
  await shot(file + '-crop', { x: 0, y: 40, width: 1200, height: 856 }, 1200)
}

ws.close()
chrome.kill()
console.log('done')
