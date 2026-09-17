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
    var big = metrics.querySelector('.metric-big')

    function put(i) {
      shown = i
      name.textContent = M[i][0]
      val.textContent = M[i][1]
      unit.textContent = M[i][2]
      rule.textContent = M[i][3]
    }

    // The block beside the figures is the very scheme they describe: the app's
    // default, two wings of 40 x 13 on its real 110 x 90 plot. Static, because
    // the numbers are what move here.
    var stage = document.getElementById('metrics-block')
    if (stage && window.URBGEN) {
      var r = window.URBGEN.block('ref', 8, 6, 13, [110, 90])
      stage.setAttribute('viewBox', r.viewBox)
      stage.innerHTML = r.svg
    }

    document.documentElement.classList.add('js-metrics')
    put(0)
    if (still.matches) return
    loop(function (ms) {
      var i = Math.floor(ms / SPAN) % M.length
      var into = ms % SPAN
      var out = into > HOLD ? 1 - (into - HOLD) / FADE : 1
      big.style.opacity = String(Math.max(0, out))
      if (i !== shown && into < HOLD) put(i)
    })
  })()

  /* ------------------------------------------------------------------ tabs */

  var tabs = document.querySelector('.tabs')
  if (tabs && tabs.querySelector('.tab-params')) (function () {
    // The parameter lists are in the markup, so with scripting off every tab is
    // simply open and the chapter reads as a list. The script collapses them
    // and opens one on a press, and only on a press: it used to step through
    // them on a timer, which closed the list you were reading.
    //
    // Direct children only: querySelectorAll('li') also returns the parameter
    // items nested inside each tab, so the open class landed inside a tab
    // rather than on one.
    var items = [].slice.call(tabs.children)
    var at = 0

    function open(i) {
      at = i
      items.forEach(function (li, k) {
        var on = k === i
        li.classList.toggle('on', on)
        var b = li.querySelector('.tab-open')
        if (b) b.setAttribute('aria-expanded', on ? 'true' : 'false')
      })
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
      // A press toggles: pressing the open one closes it. No focus handler —
      // that would reopen the whole list for anyone tabbing through, which is
      // the timer again by another name. Enter and Space fire click anyway.
      b.addEventListener('click', function () { open(at === i ? -1 : i) })
    })

    document.documentElement.classList.add('js-tabs')
    tabs.classList.add('stepped')
    open(0)
  })()

  /* --------------------------------------------------------------- options */

  var opts = document.getElementById('options-scene')
  if (opts && window.URBGEN) (function () {
    /*
      An option in the app is a whole site — a boundary with buildings on it —
      so that is what this compares. A is fixed; B walks a set of layouts, all
      on the same 110 x 90 m plot: the app's default, and the same 9 900 m² the
      metrics chapter divides by, which is what makes coverage and plot ratio
      worth printing beside the drawings.

      Buildings are [x, z, width, depth, floors] in metres from the plot's
      corner, orthogonal to it and set back from it — the depth sort in
      block.js is the axis-aligned test, and a turned box needs a different one.
    */
    var PLOT = [110, 90]

    var A = {
      say: 'three bars, five floors',
      alt: 'Three parallel five-storey bars across the plot, evenly spaced.',
      b: [[20, 12, 70, 12, 5], [20, 39, 70, 12, 5], [20, 66, 70, 12, 5]]
    }
    var B = [
      {
        say: 'a perimeter block around a court',
        alt: 'Four five-storey bars around the edge of the plot, enclosing a courtyard sixty by forty metres.',
        b: [[12, 12, 86, 13, 5], [12, 65, 86, 13, 5], [12, 25, 13, 40, 5], [85, 25, 13, 40, 5]]
      },
      {
        say: 'two towers behind a low bar',
        alt: 'A three-storey bar along the front of the plot with two twelve-storey towers standing behind it.',
        b: [[14, 64, 82, 14, 3], [22, 24, 24, 24, 12], [64, 24, 24, 24, 12]]
      },
      {
        say: 'two L-blocks, pinwheeled',
        alt: 'Two six-storey L-shaped blocks set diagonally opposite each other, each opening onto the middle of the plot.',
        b: [[12, 12, 48, 13, 6], [12, 25, 13, 33, 6], [50, 65, 48, 13, 6], [85, 32, 13, 33, 6]]
      },
      {
        say: 'one long slab, one point block',
        alt: 'An eight-storey slab across the back of the plot with a ten-storey point block standing in front of it.',
        b: [[14, 14, 82, 13, 8], [40, 50, 30, 24, 10]]
      }
    ]

    var svgA = document.getElementById('opt-a'), svgB = document.getElementById('opt-b')
    var nameA = document.getElementById('opt-a-say'), nameB = document.getElementById('opt-b-say')
    var chips = document.getElementById('opt-chips')
    var diff = document.getElementById('opt-diff')

    var N2 = function (v) {
      return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    }
    function fig(id, v) {
      var el = document.getElementById(id)
      if (el) el.textContent = v
    }

    // Draw every layout up front and fit ONE box to all of them. A scheme
    // fitted to its own frame would be drawn larger for being smaller, which
    // is the opposite of a comparison.
    var ra = window.URBGEN.site(PLOT, A.b)
    var rb = B.map(function (o) { return window.URBGEN.site(PLOT, o.b) })
    var frame = window.URBGEN.frame(
      [ra.extent].concat(rb.map(function (r) { return r.extent })), 3)

    function put(el, r, alt) {
      el.setAttribute('viewBox', frame)
      el.innerHTML = r.svg
      el.setAttribute('aria-label', alt)
    }

    put(svgA, ra, A.alt)
    if (nameA) nameA.textContent = A.say
    fig('opt-a-gfa', N2(ra.gfa) + ' m²')
    fig('opt-a-cov', ra.cover.toFixed(1) + '%')
    fig('opt-a-far', ra.far.toFixed(2))

    var shown = -1

    function showB(i) {
      shown = i
      var o = B[i], r = rb[i]
      put(svgB, r, o.alt)
      if (nameB) nameB.textContent = o.say
      fig('opt-b-gfa', N2(r.gfa) + ' m²')
      fig('opt-b-cov', r.cover.toFixed(1) + '%')
      fig('opt-b-far', r.far.toFixed(2))
      // Two of these layouts land within a few dozen square metres of each
      // other, which is the chapter's point rather than a rounding accident —
      // so a difference under one per cent gets a decimal instead of a 0%.
      var d = r.gfa - ra.gfa
      var pc = 100 * d / ra.gfa
      var pct = Math.abs(pc) < 1 ? Math.abs(pc).toFixed(1) : String(Math.round(Math.abs(pc)))
      if (diff) {
        diff.textContent = (d >= 0 ? '+' : '−') + N2(Math.abs(d)) + ' m² GFA · ' +
          (d >= 0 ? '+' : '−') + pct + '%'
        diff.className = 'opt-diff ' + (d >= 0 ? 'up' : 'down')
      }
      if (chips) [].forEach.call(chips.children, function (c, k) {
        c.classList.toggle('on', k === i + 1)
      })
    }

    document.documentElement.classList.add('js-options')
    showB(0)
    if (still.matches) return
    loop(function (ms) {
      var i = Math.floor(ms / 3600) % B.length
      if (i !== shown) showB(i)
    })
  })()
})()
