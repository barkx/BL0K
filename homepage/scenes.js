/*
  The page's animated scenes. One file, no dependency, no build step.

  Every scene is progressive enhancement over markup that already says the
  thing: with scripting off the page is complete and simply does not move.
  Each scene attaches only if its element is present, and all of them stop
  under prefers-reduced-motion — a page that animates at someone who asked it
  not to is worse than a static one.

  Geometry here follows the app rather than approximating it. The module fit is
  the app's own rule from src/geometry/facade.ts:

      count  = max(1, round(length / requested))
      actual = length / count

  and a window is clamped by the same pier minimum, PIER_MIN = 0.3 m. That is
  why the bays visibly re-divide as the module stretches instead of leaving a
  ragged remainder: the app never leaves one, so neither does this.
*/
(function () {
  'use strict'

  var still = window.matchMedia('(prefers-reduced-motion: reduce)')
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
  var lerp = function (a, b, t) { return a + (b - a) * t }
  var n = function (v) { return Math.round(v * 100) / 100 }

  /* Run `step(elapsed)` each frame while the tab is visible. */
  function loop(step) {
    var t0 = null
    function frame(t) {
      if (t0 === null) t0 = t
      if (!document.hidden) step(t - t0)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  /* ---------------------------------------------------------------- facade */

  var facade = document.getElementById('facade-scene')
  if (facade) (function () {
    var LEN = 48, FLOORS = 4, FH = 3, PIER = 0.3, WH = 2.1
    var BASE = { mod: 6, per: 2, sill: 0.65, balc: 'none' }

    // Each step is a configuration the app can actually produce, and the
    // caption names it. Module width and sill tween; the discrete choices
    // switch at the midpoint of a step, where the change reads clearly.
    var STEPS = [
      { mod: 6.0, per: 2, sill: 0.65, balc: 'none', say: 'Module 6.0 m · two windows' },
      { mod: 3.2, per: 1, sill: 0.65, balc: 'none', say: 'Module 3.2 m · the bays re-divide' },
      { mod: 6.0, per: 2, sill: 0.65, balc: 'projecting', say: 'Projecting balconies' },
      { mod: 7.5, per: 3, sill: 0.65, balc: 'loggia', say: 'Loggias, cut into the wall' },
      { mod: 6.0, per: 2, sill: 0.00, balc: 'none', say: 'Sill 0 · floor to ceiling' }
    ]
    var HOLD = 1500, MOVE = 1100, SPAN = HOLD + MOVE
    var say = document.getElementById('facade-say')

    function fit(mod) {
      var count = Math.max(1, Math.round(LEN / mod))
      return { count: count, actual: LEN / count }
    }
    function winWidth(actual, per) {
      return Math.max(0.4, Math.min(1.6, (actual - (per + 1) * PIER) / per))
    }

    function draw(mod, sill, per, balc) {
      var f = fit(mod), w = winWidth(f.actual, per), out = ''
      var wallTop = FLOORS * FH
      out += '<rect x="0" y="' + n(-wallTop) + '" width="' + LEN + '" height="' + wallTop + '" fill="#b0b0af"/>'
      out += '<rect x="-0.3" y="' + n(-wallTop - 0.9) + '" width="' + (LEN + 0.6) + '" height="0.9" fill="#d6d5d4"/>'

      for (var i = 0; i < f.count; i++) {
        var x0 = i * f.actual
        for (var fl = 0; fl < FLOORS; fl++) {
          var base = -(fl + 1) * FH
          if (balc === 'loggia' && fl > 0) {
            out += '<rect x="' + n(x0 + PIER) + '" y="' + n(base + 0.22) + '" width="' +
              n(f.actual - 2 * PIER) + '" height="' + n(FH - 0.5) + '" fill="#7b8084"/>'
            out += '<rect x="' + n(x0 + PIER) + '" y="' + n(base + FH - 0.28) + '" width="' +
              n(f.actual - 2 * PIER) + '" height="0.28" fill="#c9c9c8"/>'
            continue
          }
          for (var k = 0; k < per; k++) {
            var gap = (f.actual - per * w) / (per + 1)
            var wx = x0 + gap + k * (w + gap)
            out += '<rect x="' + n(wx) + '" y="' + n(base + sill) + '" width="' + n(w) +
              '" height="' + n(Math.min(WH, FH - sill - 0.25)) + '" fill="#7e8388"/>'
          }
          if (balc === 'projecting' && fl > 0) {
            out += '<rect x="' + n(x0 + 0.2) + '" y="' + n(base + 0.9) + '" width="' +
              n(f.actual - 0.4) + '" height="0.16" fill="#d6d5d4"/>'
            out += '<rect x="' + n(x0 + 0.2) + '" y="' + n(base + 0.9 - 1.1) + '" width="' +
              n(f.actual - 0.4) + '" height="1.1" fill="#c4c4c3" opacity=".85"/>'
          }
        }
        if (i) out += '<rect x="' + n(x0 - 0.04) + '" y="' + n(-wallTop) + '" width="0.08" height="' +
          wallTop + '" fill="#a2a2a1"/>'
      }
      out += '<rect x="-1" y="0" width="' + (LEN + 2) + '" height="0.16" fill="#8b8b8a"/>'
      return out
    }

    facade.setAttribute('viewBox', '-1.5 ' + (-FLOORS * FH - 2) + ' ' + (LEN + 3) + ' ' + (FLOORS * FH + 3.2))

    function at(ms) {
      var i = Math.floor(ms / SPAN) % STEPS.length
      var j = (i + 1) % STEPS.length
      var into = ms % SPAN
      var t = into < HOLD ? 0 : ease((into - HOLD) / MOVE)
      var a = STEPS[i], b = STEPS[j]
      return {
        mod: lerp(a.mod, b.mod, t), sill: lerp(a.sill, b.sill, t),
        per: t < 0.5 ? a.per : b.per, balc: t < 0.5 ? a.balc : b.balc,
        say: t < 0.5 ? a.say : b.say
      }
    }

    function render(s) {
      facade.innerHTML = draw(s.mod, s.sill, s.per, s.balc)
      if (say && say.textContent !== s.say) say.textContent = s.say
    }

    document.documentElement.classList.add('js-facade')
    // Draw once before the loop. `loop` skips frames while the document is
    // hidden, so a scene that only ever draws inside it comes up empty in a
    // background tab — and stays empty until it is looked at.
    render(STEPS[0])
    if (still.matches) return
    loop(function (ms) { render(at(ms)) })
  })()

  /* --------------------------------------------------------------- metrics */

  var metrics = document.getElementById('metrics-scene')
  if (metrics) (function () {
    // One real scheme, the app's default, and the same figures the table below
    // carries. Shown one at a time and large, because a number with its rule
    // under it is the whole claim of that chapter.
    var M = [
      ['GFA', '8 320', 'm²', 'footprint × floors — 1 040 × 8, the junction overlap counted once'],
      ['Plot ratio', '0.84', 'FAR', '8 320 ÷ 9 900'],
      ['Coverage', '10.5', '%', '1 040 ÷ 9 900'],
      ['Core', '338', 'm²', 'measured off the shaft in the model, not assumed as a percentage'],
      ['NIA', '7 184', 'm²', '(8 320 − 338) × 0.90 — GFA less the core, times an efficiency you set'],
      ['Units', '224', 'est.', 'from the module width and the residential floors — an estimate, and labelled one'],
      ['Facade', '4 464', 'm²', '33.7% of it glazed'],
      ['Tallest', '24.9', 'm', 'the tallest mass — what a height cap is checked against']
    ]
    var name = document.getElementById('m-name')
    var val = document.getElementById('m-val')
    var unit = document.getElementById('m-unit')
    var rule = document.getElementById('m-rule')
    var HOLD = 2600, FADE = 420, SPAN = HOLD + FADE
    var shown = -1

    function put(i) {
      shown = i
      name.textContent = M[i][0]
      val.textContent = M[i][1]
      unit.textContent = M[i][2]
      rule.textContent = M[i][3]
    }

    document.documentElement.classList.add('js-metrics')
    put(0)
    if (still.matches) return
    loop(function (ms) {
      var i = Math.floor(ms / SPAN) % M.length
      var into = ms % SPAN
      var out = into > HOLD ? 1 - (into - HOLD) / FADE : 1
      metrics.style.opacity = String(Math.max(0, out))
      if (i !== shown && into < HOLD) put(i)
    })
  })()

  /* ------------------------------------------------------------------ tabs */

  var tabs = document.querySelector('.tabs')
  if (tabs && tabs.querySelector('.tab-params')) (function () {
    // The parameter lists are in the markup, so with scripting off every tab is
    // simply open and the chapter reads as a list. The script collapses them
    // and opens one at a time; clicking or focusing a tab takes it over.
    // Direct children only: querySelectorAll('li') also returns the parameter
    // items nested inside each tab, so the open class landed inside a tab
    // rather than on one.
    var items = [].slice.call(tabs.children)
    var at = 0, held = false

    function open(i) {
      at = i
      items.forEach(function (li, k) { li.classList.toggle('on', k === i) })
    }

    items.forEach(function (li, i) {
      var h = li.querySelector('h3')
      if (!h) return
      var b = document.createElement('button')
      b.type = 'button'
      b.className = 'tab-open'
      b.setAttribute('aria-expanded', 'false')
      b.textContent = h.textContent
      h.textContent = ''
      h.appendChild(b)
      b.addEventListener('click', function () { held = true; open(i) })
      b.addEventListener('focus', function () { held = true; open(i) })
    })

    tabs.classList.add('stepped')
    open(0)
    if (still.matches) return
    var last = 0
    loop(function (ms) {
      if (held) return
      var i = Math.floor(ms / 2600) % items.length
      if (i !== last) { last = i; open(i) }
    })
  })()

  /* --------------------------------------------------------------- options */

  var opts = document.getElementById('options-scene')
  if (opts && window.URBGEN) (function () {
    // A is fixed; B walks a set of variants. Both blocks come from block.js so
    // there is one projection in the page, not two.
    var A = { preset: 'L', floors: 8, mod: 6, depth: 13, name: 'Option A' }
    var B = [
      { preset: 'L', floors: 14, mod: 6, depth: 13, note: 'six more floors' },
      { preset: 'U', floors: 10, mod: 6, depth: 12, note: 'a U, ten floors' },
      { preset: 'court', floors: 9, mod: 6, depth: 12, note: 'a courtyard' },
      { preset: 'bar', floors: 20, mod: 6, depth: 14, note: 'a single bar, twenty floors' }
    ]
    var svgA = document.getElementById('opt-a'), svgB = document.getElementById('opt-b')
    var ga = document.getElementById('opt-a-gfa'), gb = document.getElementById('opt-b-gfa')
    var diff = document.getElementById('opt-diff'), note = document.getElementById('opt-note')
    var chips = document.getElementById('opt-chips')

    var N2 = function (v) {
      return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    }
    function put(el, r) { el.setAttribute('viewBox', r.viewBox); el.innerHTML = r.svg }

    var ra = window.URBGEN.block(A.preset, A.floors, A.mod, A.depth)
    put(svgA, ra)
    ga.textContent = N2(ra.gfa) + ' m²'

    var shown = -1
    function showB(i) {
      shown = i
      var b = B[i], r = window.URBGEN.block(b.preset, b.floors, b.mod, b.depth)
      put(svgB, r)
      gb.textContent = N2(r.gfa) + ' m²'
      var d = r.gfa - ra.gfa
      var pct = Math.round(100 * d / ra.gfa)
      diff.textContent = (d >= 0 ? '+' : '−') + N2(Math.abs(d)) + ' m² · ' +
        (d >= 0 ? '+' : '−') + Math.abs(pct) + '%'
      diff.className = 'opt-diff ' + (d >= 0 ? 'up' : 'down')
      note.textContent = b.note
      if (chips) [].forEach.call(chips.children, function (c, k) {
        c.classList.toggle('on', k === i + 1)
      })
    }

    document.documentElement.classList.add('js-options')
    showB(0)
    if (still.matches) return
    loop(function (ms) {
      var i = Math.floor(ms / 3200) % B.length
      if (i !== shown) showB(i)
    })
  })()
})()
