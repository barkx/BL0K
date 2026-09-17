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
    }

    document.documentElement.classList.add('js-options')
    showB(0)
    if (still.matches) return
    loop(function (ms) {
      var i = Math.floor(ms / 3600) % B.length
      if (i !== shown) showB(i)
    })
  })()

  /* ------------------------------------------------------------------ tour */

  /*
    The eight tabs, animated. One stage, not eight: the chapter then reads the
    way the app is laid out — a rail of tools and a single viewport — and only
    ever one animation runs. The step shown is whichever tab is open, so the
    sequence is driven by the reader's presses rather than by a timer, which is
    the rule the tab list itself now follows.

    The first four steps and the last are the app's own isometric, drawn by
    block.js on one small site and cumulative: a plot, then buildings on it,
    then height, then use. The middle three leave the site view behind because
    the app does — a facade, a mix and a sheet are not looked at from above.
  */
  var tour = document.getElementById('tour')
  if (tour && window.URBGEN && tabs) (function () {
    var TP = [90, 70]                                  // the tour's plot, in metres
    var TB = [[12, 12, 38, 12], [12, 40, 38, 12], [62, 12, 16, 40]]
    var RETAIL = '#a8734a', OFFICE = '#6d8496'
    var say = document.getElementById('tour-say')
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v }
    var seg = function (t, a, b) { return ease(clamp((t - a) / (b - a))) }

    // The three buildings at a height, optionally banded, palettised, or with
    // the third still being dragged in from the right.
    function at(floors, bands, pal, third) {
      return TB.map(function (b, i) {
        return [i === 2 && third != null ? third : b[0], b[1], b[2], b[3],
                floors[i], pal, bands && bands[i]]
      })
    }

    // One frame for every isometric step, so the site does not change scale as
    // the reader steps down the list. Solved off the tallest state.
    var FRAME = window.URBGEN.frame([
      window.URBGEN.site(TP, []).extent,
      window.URBGEN.site(TP, at([5, 3, 9])).extent
    ], 3)

    function iso(bs, opts) {
      return { svg: window.URBGEN.site(TP, bs, opts).svg, viewBox: FRAME }
    }
    function flat(w, h, body) {          // a step that is not the site view
      return { svg: body, viewBox: '0 0 ' + w + ' ' + h }
    }

    var STEPS = [
      // Site — the boundary draws itself, a handle appearing at each corner.
      function (t) { return iso([], { edge: seg(t, 0, 0.75) }) },

      // Placement — buildings arrive one at a time, the last dragged into place.
      function (t) {
        var k = t < 0.22 ? 1 : t < 0.44 ? 2 : 3
        var slide = 24 * (1 - seg(t, 0.44, 0.8))
        return iso(at([3, 3, 3], null, null, 62 + slide).slice(0, k))
      },

      // Massing — floors, on the buildings the reader would have selected.
      function (t) {
        return iso(at([3 + 2 * seg(t, 0.1, 0.5), 3, 3 + 6 * seg(t, 0.25, 0.8)]))
      },

      // Program — a run of levels handed to another use. Painted on the faces,
      // because that is what changes in the app: the glazing, not the shape.
      function (t) {
        var r = seg(t, 0.1, 0.45), o = seg(t, 0.5, 0.85)
        return iso(at([5, 3, 9], [[[0, r, RETAIL]], [[0, r, RETAIL]],
                                  [[0, r, RETAIL], [1, 1 + 3 * o, OFFICE]]]))
      },

      // Facade — the app's own fit: count = round(length / module), so the bays
      // re-divide rather than leaving a remainder at the end of the wall.
      function (t) {
        var LEN = 30, FL = 3, H = 3
        var mod = 7.5 - 4.3 * seg(t, 0.12, 0.8)
        var count = Math.max(1, Math.round(LEN / mod)), act = LEN / count
        // The same pier minimum and the same clamp as the chapter below, so
        // the two drawings cannot disagree about what the app produces.
        var w = Math.max(0.4, Math.min(1.6, act - 0.6)), WH = 2.1
        var d = '<rect x="0" y="0" width="' + LEN + '" height="' + (FL * H) + '" fill="#b0b0af"/>'
        d += '<rect x="-0.3" y="-0.8" width="' + (LEN + 0.6) + '" height="0.8" fill="#d6d5d4"/>'
        for (var i = 0; i < count; i++) {
          var x = i * act
          for (var f = 0; f < FL; f++)
            d += '<rect x="' + n(x + (act - w) / 2) + '" y="' + n(f * H + H - 0.65 - WH) +
                 '" width="' + n(w) + '" height="' + WH + '" fill="#7e8388"/>'
          if (i) d += '<rect x="' + n(x - 0.04) + '" y="0" width="0.08" height="' +
                      (FL * H) + '" fill="#a2a2a1"/>'
        }
        d += '<rect x="-1" y="' + (FL * H) + '" width="' + (LEN + 2) + '" height="0.18" fill="#8b8b8a"/>'
        return flat(LEN + 2, FL * H + 2, '<g transform="translate(1,0.6)">' + d + '</g>')
      },

      // Units — a target share per type, each filling to its mark. Labelled,
      // because an unlabelled striped bar is a gradient. The dashed line is
      // the target and the block is what the building fits, which is the whole
      // point of the tab: the app reports the share achieved against the share
      // asked for, and calls the count an estimate.
      function (t) {
        var TYPE = ['Studio', '1 bed', '2 bed', '3 bed']
        var TGT = [0.15, 0.35, 0.34, 0.16]      // asked for
        var ACH = [0.13, 0.37, 0.33, 0.17]      // what the building fits
        var TONE = ['#9aaebd', '#8298a9', '#6d8496', '#5a7183']
        var W = 62, x = 0, d = '', i
        ACH.forEach(function (sh, k) {
          var full = W * sh, w = full * seg(t, 0.08 + k * 0.11, 0.52 + k * 0.11)
          d += '<rect x="' + n(x) + '" y="0" width="' + n(w) + '" height="8" fill="' + TONE[k] + '"/>'
          d += '<text x="' + n(x + full / 2) + '" y="12.6" text-anchor="middle" font-size="2.3" ' +
               'fill="#5c5c58" font-family="system-ui,sans-serif">' + TYPE[k] + '</text>'
          d += '<text x="' + n(x + full / 2) + '" y="15.9" text-anchor="middle" font-size="2.3" ' +
               'fill="#2f6ea8" font-family="system-ui,sans-serif">' + Math.round(sh * 100) + '%</text>'
          x += full
        })
        d += '<rect x="0" y="0" width="' + W + '" height="8" fill="none" stroke="#84847f" stroke-width=".2"/>'
        var run = 0
        for (i = 0; i < 3; i++) {
          run += W * TGT[i]
          d += '<line x1="' + n(run) + '" y1="-1.8" x2="' + n(run) +
               '" y2="9.8" stroke="#2f6ea8" stroke-width=".2" stroke-dasharray=".8 .8"/>'
        }
        return flat(W + 6, 26, '<g transform="translate(3,5)">' + d + '</g>')
      },

      // Drawings — a sheet with its plan drawn on, a title block and a scale
      // bar. Sized in millimetres in the app; here it only has to read as paper.
      function (t) {
        var P = [[6, 5], [30, 5], [30, 13], [18, 13], [18, 24], [6, 24]]
        var run = clamp(seg(t, 0.1, 0.8)) * P.length
        var d = 'M' + P[0][0] + ' ' + P[0][1], i
        for (i = 1; i <= P.length; i++) {
          var a = P[i - 1], b = P[i % P.length], f = clamp(run - (i - 1))
          if (f <= 0) break
          d += 'L' + n(a[0] + (b[0] - a[0]) * f) + ' ' + n(a[1] + (b[1] - a[1]) * f)
        }
        var s = '<rect x="0" y="0" width="46" height="32" fill="#faf9f7" stroke="#84847f" stroke-width=".25"/>'
        s += '<path d="' + d + '" fill="none" stroke="#3c3c3a" stroke-width=".55" stroke-linejoin="round"/>'
        s += '<rect x="32.5" y="21" width="11.5" height="9" fill="none" stroke="#84847f" stroke-width=".2"/>'
        s += '<line x1="32.5" y1="24" x2="44" y2="24" stroke="#84847f" stroke-width=".15"/>'
        s += '<line x1="32.5" y1="27" x2="44" y2="27" stroke="#84847f" stroke-width=".15"/>'
        var bar = '<g transform="translate(6,28.4)">'
        for (i = 0; i < 4; i++)
          bar += '<rect x="' + (i * 2.4) + '" y="0" width="2.4" height="0.85" fill="' +
                 (i % 2 ? '#faf9f7' : '#3c3c3a') + '" stroke="#3c3c3a" stroke-width=".12"/>'
        bar += '</g>'
        return flat(48, 34, '<g transform="translate(1,1)">' + s + bar + '</g>')
      },

      // Settings — the three render modes, each held long enough to be read.
      function (t) {
        return iso(at([5, 3, 9]), { pal: t < 0.34 ? 'white' : t < 0.67 ? 'shaded' : 'diagram' })
      }
    ]

    var SAY = [
      'Draw the boundary, or trace it over a scaled map.',
      'Place buildings on it, and drag them where they go.',
      'Give one its footprint and its floors.',
      'Hand a run of levels to retail or office.',
      'Set the module width, and the bays divide to fit.',
      'Set a target mix; the blocks are the share the building fits.',
      'Plans, elevations and sections, drawn to scale.',
      'White, shaded or diagram.'
    ]
    var SPAN = 4600

    function open() {
      var li = tabs.querySelector('li.on')
      return li ? [].indexOf.call(tabs.children, li) : -1
    }

    var was = -1, t0 = 0
    function paint(i, t) {
      var r = STEPS[i](t)
      tour.setAttribute('viewBox', r.viewBox)
      tour.innerHTML = r.svg
      if (say && say.textContent !== SAY[i]) {
        say.textContent = SAY[i]
        tour.setAttribute('aria-label', SAY[i])
      }
    }

    document.documentElement.classList.add('js-tour')
    // Draw once before the loop, for the reason the facade scene does: `loop`
    // skips frames while the document is hidden, and a scene that only ever
    // draws inside it comes up empty in a background tab.
    paint(0, 1)
    if (still.matches) {
      // Asked not to animate, but the stage must still answer the press, or it
      // sits on the first step captioning a tab nobody has open.
      tabs.addEventListener('click', function () {
        var i = open()
        if (i >= 0) paint(i, 1)
      })
      return
    }
    loop(function (ms) {
      var i = open()
      if (i < 0) return                 // every tab closed: hold the last frame
      if (i !== was) { was = i; t0 = ms }
      paint(i, ((ms - t0) % SPAN) / SPAN)
    })
  })()

})()
