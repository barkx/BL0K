/*
  Placeholder illustrations for the homepage (M1).

  These are drawings, not screenshots. M2 replaces every one of them with a
  real capture from the app, at which point this file can go — see
  project.md §9. Kept in the repo meanwhile for the same reason §6 asks for a
  config beside every screenshot: an image nobody can reproduce is an image
  nobody dares change.

  No dependencies. Redraw with:  node tools/build-illustrations.mjs

  Palette is copied from the app's src/ui/styles.css. Geometry is metres,
  projected isometrically; the fit transform at the end scales the drawing
  into its viewBox, so the numbers above stay readable as dimensions.
*/

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../assets/', import.meta.url))
mkdirSync(OUT, { recursive: true })

const C = {
  paper: '#f0eeea', panel: '#fbfaf8', ink: '#1a1f26', soft: '#565c65',
  rule: '#dbd6ce', ruleSoft: '#e8e4dd', blue: '#2c5d8f', blueSoft: '#e4ecf4',
  top: '#ffffff', right: '#e9e6e1', left: '#dcd8d1', edge: '#b4aea4',
  glass: '#dbe5ef', glassEdge: '#a8bccf',
}

const COS30 = Math.cos(Math.PI / 6)
const iso = (x, y, z) => [(x - z) * COS30, (x + z) * 0.5 - y]

const poly = (pts, fill, stroke, sw = 0.6, extra = '') => ({ pts, fill, stroke, sw, extra })

/** A box in building-local metres. Draws top, +x face, +z face, with a window grid. */
function box(s, { x0, z0, x1, z1, y0 = 0, y1 = 24, windows = true }) {
  const P = (x, y, z) => iso(x, y, z)
  s.push(poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], C.top, C.edge, 1.4))
  s.push(poly([P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], C.right, C.edge, 1.4))
  s.push(poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], C.left, C.edge, 1.4))
  const FH = 3, MOD = 3.2, WW = 1.8, SILL = 0.65, WH = 1.6
  const floors = Math.round((y1 - y0) / FH)
  // Floor lines instead of openings: massing reads as shape, not facade.
  const lines = (len, map, col) => {
    const q = []
    for (let f = 1; f < floors; f++) {
      const b = y0 + f * FH
      q.push([map(0, b), map(len, b)])
    }
    s.push({ quads: q, fill: 'none', stroke: col, sw: 1, open: true })
  }
  const grid = (len, map, fill) => {
    const n = Math.floor(len / MOD)
    if (n < 1) return
    const pad = (len - n * MOD) / 2
    const q = []
    for (let f = 0; f < floors; f++) {
      const b = y0 + f * FH + SILL
      for (let i = 0; i < n; i++) {
        const u = pad + i * MOD + (MOD - WW) / 2
        q.push([map(u, b), map(u + WW, b), map(u + WW, b + WH), map(u, b + WH)])
      }
    }
    s.push({ quads: q, fill, stroke: C.glassEdge, sw: 0.5 })
  }
  const rightFace = (u, v) => P(x1, v, z0 + u)
  const leftFace = (u, v) => P(x0 + u, v, z1)
  if (windows) {
    grid(z1 - z0, rightFace, C.glass)
    grid(x1 - x0, leftFace, '#cfdae6')
  } else {
    lines(z1 - z0, rightFace, C.rule)
    lines(x1 - x0, leftFace, C.rule)
  }
}

/** Sort masses back-to-front, then emit. */
function masses(list) {
  const s = []
  const sorted = [...list].sort((a, b) => (a.x0 + a.x1 + a.z0 + a.z1) - (b.x0 + b.x1 + b.z0 + b.z1))
  sorted.forEach(m => box(s, m))
  return s
}

const courtyard = (ox = 0, oz = 0, L = 60, D = 40, w = 12, fl = 8) => [
  { x0: ox, z0: oz, x1: ox + L, z1: oz + w, y1: fl * 3 },
  { x0: ox, z0: oz + D - w, x1: ox + L, z1: oz + D, y1: fl * 3 },
  { x0: ox, z0: oz + w, x1: ox + w, z1: oz + D - w, y1: fl * 3 },
  { x0: ox + L - w, z0: oz + w, x1: ox + L, z1: oz + D - w, y1: fl * 3 },
]

function render(shapes, W, H, pad = 18, bg = 'none') {
  const xs = [], ys = []
  const every = o => o.pts ? [o.pts] : o.quads
  shapes.forEach(o => every(o).forEach(q => q.forEach(([x, y]) => { xs.push(x); ys.push(y) })))
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  const y0 = Math.min(...ys), y1 = Math.max(...ys)
  const k = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0))
  const tx = (W - (x1 - x0) * k) / 2 - x0 * k
  const ty = (H - (y1 - y0) * k) / 2 - y0 * k
  const T = ([x, y]) => `${(x * k + tx).toFixed(1)},${(y * k + ty).toFixed(1)}`
  const D = q => 'M' + q.map(T).join('L')
  const body = shapes.map(o => {
    if (o.pts) {
      const d = o.pts.map(T).join(' ')
      return `<polygon points="${d}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw}"${o.extra ? ' ' + o.extra : ''}/>`
    }
    if (!o.quads.length) return ''
    const d = o.quads.map(q => D(q) + (o.open ? '' : 'Z')).join('')
    return `<path d="${d}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw}"/>`
  }).filter(Boolean).join('\n')
  return svg(W, H, `<rect width="${W}" height="${H}" fill="${bg}"/>\n${body}`)
}

const svg = (w, h, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">\n${inner}\n</svg>\n`

const write = (name, str) => { writeFileSync(`${OUT}/${name}`, str); console.log(name, str.length) }

// ---------- 1. hero ----------
{
  const s = masses(courtyard())
  const plot = [[-11, -9], [73, -15], [80, 50], [-7, 47]]
  s.unshift(poly(plot.map(([x, z]) => iso(x, 0, z)), '#e7e4de', C.blue, 2.6, 'stroke-dasharray="9 7"'))
  write('hero.svg', render(s, 1200, 720, 26))
}

// ---------- 2. massing presets ----------
{
  const s = []
  const L = [{ x0: 0, z0: 0, x1: 34, z1: 13, y1: 21 }, { x0: 0, z0: 13, x1: 13, z1: 38, y1: 21 }]
  const U = (o) => [
    { x0: o, z0: 0, x1: o + 13, z1: 36, y1: 24 },
    { x0: o + 13, z0: 23, x1: o + 40, z1: 36, y1: 24 },
    { x0: o + 40, z0: 0, x1: o + 53, z1: 36, y1: 24 },
  ]
  const place = d => m => ({ ...m, windows: false, x0: m.x0 + d, x1: m.x1 + d, z0: m.z0 - d, z1: m.z1 - d })
  masses(L.map(place(0))).forEach(o => s.push(o))
  masses(U(0).map(place(46))).forEach(o => s.push(o))
  masses(courtyard(0, 0, 46, 36, 12, 6).map(place(100))).forEach(o => s.push(o))
  write('massing.svg', render(s, 900, 460, 20))
}

// ---------- 3. the site, in plan ----------
{
  const W = 900, H = 560
  const plot = [[70, 60], [700, 40], [830, 400], [520, 520], [90, 470]]
  const inset = [[110, 96], [676, 78], [788, 388], [520, 482], [128, 440]]
  const pp = a => a.map(p => p.join(',')).join(' ')
  const blk = (cx, cy, w, h, rot) =>
    `<g transform="translate(${cx} ${cy}) rotate(${rot})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="#ffffff" stroke="${C.edge}" stroke-width="1.2"/>` +
    Array.from({ length: Math.max(0, Math.floor(h / 26) - 1) }, (_, i) =>
      `<line x1="${-w / 2}" y1="${-h / 2 + 26 * (i + 1)}" x2="${w / 2}" y2="${-h / 2 + 26 * (i + 1)}" stroke="${C.ruleSoft}" stroke-width="1"/>`).join('') +
    `</g>`
  const corner = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.panel}" stroke="${C.blue}" stroke-width="2"/>`
  write('site.svg', svg(W, H, `<polygon points="${pp(plot)}" fill="#e7e4de" stroke="${C.blue}" stroke-width="2"/>
<polygon points="${pp(inset)}" fill="none" stroke="${C.blue}" stroke-width="1.2" stroke-dasharray="6 5" opacity="0.7"/>
${blk(250, 210, 92, 210, -8)}
${blk(470, 250, 92, 230, -8)}
${blk(640, 330, 210, 84, 16)}
<g stroke="${C.blue}" stroke-width="1.2">
  <line x1="298" y1="200" x2="424" y2="182"/>
  <line x1="298" y1="192" x2="298" y2="208"/><line x1="424" y1="174" x2="424" y2="190"/>
</g>
${plot.map(p => corner(p[0], p[1])).join('\n')}`))
}

// ---------- 4. facade elevation, dimensioned ----------
// The drawing that shows what the parameters in the facade section produce:
// module rhythm, the reveal that casts the shadow, and recessed loggias.
{
  const W = 900, H = 600
  const x0 = 96, y1 = 516, MOD = 58, N = 12, FH = 50, FLOORS = 8
  const wallW = MOD * N, wallH = FH * FLOORS
  const yTop = y1 - wallH
  const t = (x, y, str, size = 15, col = C.soft, anchor = 'middle') =>
    `<text x="${x}" y="${y}" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif" ` +
    `font-size="${size}" fill="${col}" text-anchor="${anchor}">${str}</text>`
  let g = ''
  for (let f = 0; f < FLOORS; f++) {
    for (let i = 0; i < N; i++) {
      const cx = x0 + i * MOD, by = y1 - f * FH
      const loggia = f >= 2 && f <= 5 && (i === 3 || i === 8)
      if (loggia) {
        g += `<rect x="${cx + 4}" y="${by - FH + 4}" width="${MOD - 8}" height="${FH - 8}" fill="#cfcbc4" stroke="${C.edge}" stroke-width="0.7"/>`
        g += `<rect x="${cx + 9}" y="${by - FH + 9}" width="${MOD - 18}" height="${FH - 16}" fill="#bcb8b0"/>`
        g += `<line x1="${cx + 4}" y1="${by - 14}" x2="${cx + MOD - 4}" y2="${by - 14}" stroke="${C.soft}" stroke-width="1.6"/>`
      } else {
        const wx = cx + 12, wy = by - FH + 13, ww = MOD - 24, wh = FH - 25
        // The reveal, drawn: a soft return on the head and one jamb.
        g += `<rect x="${wx - 2}" y="${wy - 2}" width="${ww + 4}" height="${wh + 4}" fill="#d6d2cb"/>`
        g += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="#b9cde0" stroke="#8fa9c2" stroke-width="0.6"/>`
        g += `<line x1="${wx}" y1="${wy}" x2="${wx + ww}" y2="${wy}" stroke="#7f99b3" stroke-width="1.6"/>`
      }
    }
  }
  let ticks = ''
  for (let i = 0; i <= N; i++)
    ticks += `<line x1="${x0 + i * MOD}" y1="${yTop - 34}" x2="${x0 + i * MOD}" y2="${yTop - 26}" stroke="${C.blue}" stroke-width="1"/>`
  const dim = (x1d, x2d, y, label) =>
    `<line x1="${x1d}" y1="${y}" x2="${x2d}" y2="${y}" stroke="${C.blue}" stroke-width="1"/>` +
    `<line x1="${x1d}" y1="${y - 5}" x2="${x1d}" y2="${y + 5}" stroke="${C.blue}" stroke-width="1"/>` +
    `<line x1="${x2d}" y1="${y - 5}" x2="${x2d}" y2="${y + 5}" stroke="${C.blue}" stroke-width="1"/>` +
    t((x1d + x2d) / 2, y - 9, label, 14, C.blue)
  write('facade.svg', svg(W, H, `<rect x="${x0}" y="${yTop - 10}" width="${wallW}" height="${wallH + 10}" fill="#f6f4f1" stroke="${C.edge}" stroke-width="1.2"/>
<rect x="${x0 - 7}" y="${yTop - 19}" width="${wallW + 14}" height="9" fill="#ffffff" stroke="${C.edge}" stroke-width="1.2"/>
${g}
<line x1="${x0}" y1="${yTop - 30}" x2="${x0 + wallW}" y2="${yTop - 30}" stroke="${C.blue}" stroke-width="1"/>
${ticks}
${dim(x0, x0 + MOD, yTop - 46, 'one module')}
<g stroke="${C.blue}" stroke-width="1">
  <line x1="${x0 - 34}" y1="${y1}" x2="${x0 - 34}" y2="${y1 - FH}"/>
  <line x1="${x0 - 39}" y1="${y1}" x2="${x0 - 29}" y2="${y1}"/>
  <line x1="${x0 - 39}" y1="${y1 - FH}" x2="${x0 - 29}" y2="${y1 - FH}"/>
</g>
${t(x0 - 44, y1 - FH / 2 + 5, 'floor', 14, C.blue, 'end')}
<line x1="${x0 - 52}" y1="${y1 + 6}" x2="${x0 + wallW + 30}" y2="${y1 + 6}" stroke="${C.soft}" stroke-width="1.6"/>
${t(x0 + wallW + 30, yTop + 26, 'parapet', 14, C.soft, 'start')}
<line x1="${x0 + 8 * MOD + MOD}" y1="${y1 - 4.5 * FH}" x2="${x0 + wallW + 24}" y2="${y1 - 4.5 * FH}" stroke="${C.soft}" stroke-width="0.8"/>
${t(x0 + wallW + 30, y1 - 4.5 * FH + 5, 'loggia', 14, C.soft, 'start')}
${t(x0, y1 + 30, 'Twelve bays, eight floors, loggias recessed on two of them.', 15, C.soft, 'start')}`))
}

// ---------- 5. facade detail: plan section through a reveal and a loggia ----------
{
  const W = 900, H = 520
  const wall = (x, w) => `<rect x="${x}" y="150" width="${w}" height="46" fill="#d8d4cd" stroke="${C.ink}" stroke-width="1.6"/>`
  const t = (x, y, s, anchor = 'middle', col = C.soft) =>
    `<text x="${x}" y="${y}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="17" fill="${col}" text-anchor="${anchor}">${s}</text>`
  write('facade-detail.svg', svg(W, H, `${wall(60, 120)}${wall(300, 120)}
<rect x="180" y="150" width="120" height="14" fill="#d8d4cd" stroke="${C.ink}" stroke-width="1.6"/>
<rect x="180" y="182" width="120" height="14" fill="#d8d4cd" stroke="${C.ink}" stroke-width="1.6"/>
<rect x="182" y="176" width="116" height="7" fill="${C.glass}" stroke="${C.glassEdge}" stroke-width="1.2"/>
<g stroke="${C.blue}" stroke-width="1.2">
  <line x1="180" y1="126" x2="300" y2="126"/><line x1="180" y1="120" x2="180" y2="132"/><line x1="300" y1="120" x2="300" y2="132"/>
  <line x1="312" y1="150" x2="312" y2="176"/><line x1="306" y1="150" x2="318" y2="150"/><line x1="306" y1="176" x2="318" y2="176"/>
</g>
${t(240, 116, 'opening')}${t(330, 170, 'reveal', 'start', C.blue)}${t(120, 232, 'jamb')}
<rect x="500" y="150" width="46" height="190" fill="#d8d4cd" stroke="${C.ink}" stroke-width="1.6"/>
<rect x="714" y="150" width="46" height="190" fill="#d8d4cd" stroke="${C.ink}" stroke-width="1.6"/>
<rect x="546" y="294" width="168" height="46" fill="#d8d4cd" stroke="${C.ink}" stroke-width="1.6"/>
<rect x="546" y="150" width="168" height="144" fill="#eceae6" stroke="${C.rule}" stroke-width="1"/>
<rect x="548" y="296" width="164" height="8" fill="${C.glass}" stroke="${C.glassEdge}" stroke-width="1.2"/>
<g stroke="${C.blue}" stroke-width="1.2">
  <line x1="500" y1="126" x2="760" y2="126"/><line x1="500" y1="120" x2="500" y2="132"/><line x1="760" y1="120" x2="760" y2="132"/>
</g>
${t(630, 116, 'loggia')}${t(523, 372, 'cheek')}${t(737, 372, 'cheek')}${t(630, 232, 'soffit over')}
<line x1="60" y1="430" x2="840" y2="430" stroke="${C.rule}" stroke-width="1"/>
${t(60, 464, 'Plan section. The facade is built as panels around the void.', 'start')}`))
}

// ---------- 6. metrics: union-corrected GFA ----------
{
  const W = 900, H = 520
  const t = (x, y, s, size = 17, col = C.soft, anchor = 'start', weight = 400) =>
    `<text x="${x}" y="${y}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="${size}" font-weight="${weight}" fill="${col}" text-anchor="${anchor}">${s}</text>`
  write('metrics.svg', svg(W, H, `<defs><pattern id="h" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<line x1="0" y1="0" x2="0" y2="9" stroke="${C.blue}" stroke-width="2.4"/></pattern></defs>
<rect x="70" y="90" width="330" height="112" fill="#ffffff" stroke="${C.ink}" stroke-width="1.6"/>
<rect x="288" y="90" width="112" height="300" fill="#ffffff" stroke="${C.ink}" stroke-width="1.6"/>
<rect x="288" y="90" width="112" height="112" fill="url(#h)" opacity="0.45"/>
<rect x="288" y="90" width="112" height="112" fill="none" stroke="${C.blue}" stroke-width="1.6"/>
<g stroke="${C.blue}" stroke-width="1.2">
  <line x1="288" y1="66" x2="400" y2="66"/><line x1="288" y1="60" x2="288" y2="72"/><line x1="400" y1="60" x2="400" y2="72"/>
</g>
${t(344, 50, 'counted once', 15, C.blue, 'middle')}
<line x1="500" y1="96" x2="840" y2="96" stroke="${C.rule}" stroke-width="1"/>
${t(500, 134, 'Wing A', 17)}${t(840, 134, '2 640 m\u00b2', 17, C.ink, 'end')}
${t(500, 170, 'Wing B', 17)}${t(840, 170, '1 680 m\u00b2', 17, C.ink, 'end')}
${t(500, 206, 'Overlap at the junction', 17, C.blue)}${t(840, 206, '\u2212 448 m\u00b2', 17, C.blue, 'end')}
<line x1="500" y1="228" x2="840" y2="228" stroke="${C.rule}" stroke-width="1"/>
${t(500, 266, 'GFA', 18, C.ink, 'start', 600)}${t(840, 266, '3 872 m\u00b2', 18, C.ink, 'end', 600)}
${t(500, 306, 'less core area', 17)}${t(840, 306, '\u2212 296 m\u00b2', 17, C.ink, 'end')}
${t(500, 342, 'efficiency factor', 17)}${t(840, 342, '\u00d7 0.88', 17, C.ink, 'end')}
<line x1="500" y1="364" x2="840" y2="364" stroke="${C.rule}" stroke-width="1"/>
${t(500, 402, 'NIA', 18, C.ink, 'start', 600)}${t(840, 402, '3 147 m\u00b2', 18, C.ink, 'end', 600)}
${t(70, 446, 'Where two wings meet, the shared volume is counted once.', 16)}`))
}

// ---------- 7. the Open Graph card, 1200x630 ----------
// Rasterised to og.png separately (see README ch.1) because no sharing
// platform accepts an SVG for og:image.
{
  const W = 1200, H = 630
  const s = masses(courtyard(0, 0, 58, 38, 12, 8))
  // Reuse the fit machinery, then drop the block into the right-hand half.
  const inner = render(s, 620, 470, 10, 'none')
  const body = inner.slice(inner.indexOf('>') + 1, inner.lastIndexOf('</svg>'))
    .replace(/<rect width="620" height="470" fill="none"\/>/, '')
  const t = (x, y, str, size, weight, col, spacing) =>
    `<text x="${x}" y="${y}" font-family="Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif" ` +
    `font-size="${size}" font-weight="${weight}" fill="${col}" letter-spacing="${spacing || 0}">${str}</text>`
  write('og.svg', svg(W, H, `<rect width="${W}" height="${H}" fill="${C.paper}"/>
<g transform="translate(548 92)">${body}</g>
<g transform="translate(84 210) scale(2.3)" fill="${C.blue}">
  <path d="M12 3 21 8 12 13 3 8Z"/>
  <path d="M3 8 12 13v8L3 16Z" opacity="0.55"/>
  <path d="M21 8v8l-9 5v-8Z" opacity="0.78"/>
</g>
${t(148, 262, 'URBGEN', 62, 650, C.ink, '3')}
${t(86, 330, 'Parametric building design', 30, 400, C.soft)}
<line x1="86" y1="372" x2="330" y2="372" stroke="${C.blue}" stroke-width="2"/>
${t(86, 424, 'Massing, a facade with real openings,', 23, 400, C.soft)}
${t(86, 458, 'and metrics that show their working.', 23, 400, C.soft)}
${t(86, 536, 'urbgen.com', 22, 600, C.blue, '1')}`))
}
