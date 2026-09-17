
(function () {
  'use strict'

  var still = window.matchMedia('(prefers-reduced-motion: reduce)')
  var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
  var lerp = function (a, b, t) { return a + (b - a) * t }
  var n = function (v) { return Math.round(v * 100) / 100 }

  function loop(step) {
    var t0 = null
    function frame(t) {
      if (t0 === null) t0 = t
      if (!document.hidden) step(t - t0)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  var metrics = document.getElementById('metrics-scene')
  if (metrics) (function () {
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

  var tabs = document.querySelector('.tabs')
  if (tabs && tabs.querySelector('.tab-params')) (function () {
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

      b.addEventListener('click', function () { open(at === i ? -1 : i) })
    })

    document.documentElement.classList.add('js-tabs')
    tabs.classList.add('stepped')
    open(0)
  })()

  var opts = document.getElementById('options-scene')
  if (opts && window.URBGEN) (function () {
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

})()
