/*
  Interface snapshots for the homepage handover.

  The same technique as homepage/tools/capture-screenshots.mjs — headless
  Chrome over the DevTools Protocol, no dependency — but pointed at
  homepage/from-app/assets/ui/ and set up to show the parts of the app the
  site has never seen. That tool is the homepage's and is left alone.

  Headless is not a workaround: R3F will not size or render its canvas while
  the document is hidden, so a backgrounded window would come out blank.

  Usage: node capture-ui.mjs <outDir> [port]
*/
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = process.argv[2]
const APP = `http://localhost:${process.argv[3] || 5173}/`
const W = 1600, H = 1000
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9341
const PROFILE = join(tmpdir(), 'urbgen-ui-capture-profile')

mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  `--remote-debugging-port=${PORT}`, '--no-first-run', '--user-data-dir=' + PROFILE,
  APP,
], { stdio: 'ignore' })

let ws, id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression)
  return r.result.value
}

/** The crop the homepage's own capture script uses: rail, panel, model, metrics. */
const READABLE = { x: 0, y: 40, width: 1200, height: 856 }

async function both(name) {
  await shot(name, null)
  await shot(name + '-crop', READABLE)
}

async function shot(name, clip) {
  const p = { format: 'png', captureBeyondViewport: false }
  if (clip) p.clip = { ...clip, scale: 1 }
  const { data } = await send('Page.captureScreenshot', p)
  const png = Buffer.from(data, 'base64')
  writeFileSync(join(OUT, name + '.png'), png)
  console.log(name.padEnd(22), String(Math.round(png.length / 1024)).padStart(4) + 'KB',
    clip ? `${clip.width}x${clip.height}` : `${W}x${H}`)
}

/** Click a button by its exact visible text. */
const clickText = (text) => evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)});
  if (!b) return false; b.click(); return true;
})()`)

/** Open a sidebar section by name. */
const tab = (name) => evaluate(`(() => {
  const b = [...document.querySelectorAll('.rail-item')].find(e => e.textContent.trim() === ${JSON.stringify(name)});
  if (!b) return false; b.click(); return true;
})()`)

/** Set a numeric field by its label, the way a person would. */
const setField = (label, value) => evaluate(`(() => {
  const l = [...document.querySelectorAll('.field label')].find(e => e.textContent.trim() === ${JSON.stringify(label)});
  if (!l) return false;
  const n = l.closest('.field').querySelector('input[type=number]');
  if (!n) return false;
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(n, String(${JSON.stringify(String(value))}));
  n.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`)

const selectBuilding = () => evaluate(`(() => {
  const row = [...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'Building A' && e.children.length === 0);
  if (!row) return false; row.click(); return true;
})()`)

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging target')
}

ws = new WebSocket(await connect())
await new Promise((r) => (ws.onopen = r))
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  const p = pending.get(m.id)
  if (!p) return
  pending.delete(m.id)
  m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
}

await send('Page.enable')
await send('Runtime.enable')
const where = await evaluate('location.href')
if (!where.startsWith(APP)) await send('Page.navigate', { url: APP })
await sleep(3500)

// Wait for the canvas to have actually sized itself.
for (let i = 0; i < 40; i++) {
  const c = await evaluate(`(() => { const c = document.querySelector('canvas'); return c ? c.width : 0 })()`)
  if (c > 100) break
  await sleep(250)
}
await sleep(800)

// Frame the site, so every shot shows the scheme rather than the opening camera.
await evaluate(`(() => { const c = document.querySelector('.viewport canvas'); const r = c.getBoundingClientRect();
  for (const type of ['pointerdown','pointerup']) for (let i=0;i<2;i++)
    c.dispatchEvent(new PointerEvent(type,{clientX:r.left+r.width*0.6,clientY:r.top+r.height*0.8,button:0,bubbles:true,pointerId:1,isPrimary:true}));
  c.dispatchEvent(new MouseEvent('dblclick',{clientX:r.left+r.width*0.6,clientY:r.top+r.height*0.8,bubbles:true}));
  return true })()`)
await sleep(1200)

// 1. The whole interface: eight-icon rail, and the option button in the top bar.
await tab('Site'); await sleep(900)
await both('ui-01-whole-app')

// 2. Programme by floor, in diagram mode so the retail band reads.
await tab('Placement'); await sleep(400)
await selectBuilding(); await sleep(400)
await tab('Program'); await sleep(600)
await clickText('Add a band'); await sleep(900)
await tab('Settings'); await sleep(400)
await clickText('Diagram'); await sleep(1200)
await tab('Program'); await sleep(900)
await both('ui-02-programme-by-floor')

// Back to the white model for everything after.
await tab('Settings'); await sleep(300)
await clickText('White'); await sleep(900)

// 3. The unit mix, with a real 30/45/25 target and its achieved table.
await tab('Units'); await sleep(600)
await setField('1 bed', 30); await sleep(250)
await setField('2 bed', 45); await sleep(250)
await setField('3 bed', 25); await sleep(1200)
await both('ui-03-unit-mix')

// 4. Drawings, showing a section of the scheme.
await tab('Drawings'); await sleep(700)
await clickText('Section'); await sleep(1400)
await both('ui-04-drawings-section')

// 5. Design options: duplicate, change the second, then open the menu so both
//    rows carry a thumbnail taken from the same camera.
await evaluate(`(() => { document.querySelector('.option-button').click(); return true })()`)
await sleep(700)
await clickText('Duplicate this one'); await sleep(1000)
await tab('Massing'); await sleep(600)
await setField('Floors', 20); await sleep(1600)
await evaluate(`(() => { document.querySelector('.option-button').click(); return true })()`)
await sleep(1200)
await both('ui-05-design-options')

// 6. Freeform: a drawn centreline becomes a building with wings at any angle.
await evaluate(`(() => { document.querySelector('.option-button').click(); return true })()`)
await sleep(400)
await tab('Massing'); await sleep(600)
await setField('Floors', 8); await sleep(900)
await clickText('Freeform'); await sleep(800)
await clickText('Draw a plan'); await sleep(600)
await evaluate(`(() => {
  const c = document.querySelector('.viewport canvas'); const r = c.getBoundingClientRect();
  const at = (fx, fy) => { for (const t of ['pointerdown','pointerup'])
    c.dispatchEvent(new PointerEvent(t,{clientX:r.left+r.width*fx,clientY:r.top+r.height*fy,button:0,bubbles:true,pointerId:1,isPrimary:true})) };
  at(0.30, 0.66); at(0.52, 0.74); at(0.70, 0.56);
  return true })()`)
await sleep(600)
await evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return true })()`)
await sleep(2000)
await both('ui-06-freeform-massing')

ws.close()
chrome.kill()
console.log('done')
process.exit(0)
