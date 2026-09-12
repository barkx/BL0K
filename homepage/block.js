/*
  The hero block, rotating through four schemes. Isometric, same defaults as
  the app: 3 m floors, 0.65 m sill, 1.6 m openings. A miniature — no junction
  detection, no metrics, no balconies.

  Fixed rotation order, not random: determinism is a claim this page makes.
  Does not rotate under prefers-reduced-motion, does not redraw while hidden,
  and never runs at all with JavaScript off, where the static shot stands.
*/
(function () {
  var svg = document.getElementById('toy')
  if (!svg || !svg.getAttribute) return

  var K = Math.cos(Math.PI / 6)
  var FH = 3, SILL = 0.65, WH = 1.6
  var VW = 108, VH = 94   // fits the widest and tallest scheme, centred
  var iso = function (x, y, z) { return [(x - z) * K, (x + z) / 2 - y] }
  var n = function (v) { return Math.round(v * 10) / 10 }

  // Footprints as [x0, z0, x1, z1] in metres, building-local.
  function plan(preset, d) {
    if (preset === 'bar') return [[0, 0, 48, d]]
    if (preset === 'L') return [[0, 0, 42, d], [0, d, d, 40]]
    if (preset === 'U') return [[0, 0, d, 40], [d, 40 - d, 44, 40], [44, 0, 44 + d, 40]]
    return [[0, 0, 52, d], [0, 38 - d, 52, 38], [0, d, d, 38 - d], [52 - d, d, 52, 38 - d]]
  }

  function path(quad) {
    return 'M' + quad.map(function (p) { return n(p[0]) + ' ' + n(p[1]) }).join('L') + 'Z'
  }

  // Openings along one face, as one path.
  function bays(len, map, mod, floors) {
    var count = Math.floor(len / mod)
    if (count < 1) return ''
    var pad = (len - count * mod) / 2, w = mod * 0.56, d = ''
    for (var f = 0; f < floors; f++) {
      var b = f * FH + SILL
      for (var i = 0; i < count; i++) {
        var u = pad + i * mod + (mod - w) / 2
        d += path([map(u, b), map(u + w, b), map(u + w, b + WH), map(u, b + WH)])
      }
    }
    return d
  }

  // A plot under the block, so it is not floating.
  function ground(ms) {
    var x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, e = 6
    ms.forEach(function (m) {
      x0 = Math.min(x0, m[0]); z0 = Math.min(z0, m[1])
      x1 = Math.max(x1, m[2]); z1 = Math.max(z1, m[3])
    })
    return '<path d="' + path([iso(x0 - e, 0, z0 - e), iso(x1 + e, 0, z0 - e),
      iso(x1 + e, 0, z1 + e), iso(x0 - e, 0, z1 + e)])
      + '" fill="#e7e4de" stroke="#2c5d8f" stroke-width=".4" stroke-dasharray="1.8 1.4"/>'
  }

  // Centre, solved not sampled: in this projection the extremes are always the
  // same corners — (x0,z1) left, (x1,z0) right, top of the nearest mass high,
  // far ground corner low.
  function centre(ms, h) {
    var x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, e = 6
    ms.forEach(function (m) {
      x0 = Math.min(x0, m[0]); z0 = Math.min(z0, m[1])
      x1 = Math.max(x1, m[2]); z1 = Math.max(z1, m[3])
    })
    return [K * (x0 + x1 - z0 - z1) / 2,
            ((x0 + z0) / 2 - h + (x1 + z1 + 2 * e) / 2) / 2]
  }

  function build(preset, floors, mod, depth) {
    var h = floors * FH
    // Back to front. Emitted per mass, not grouped by face: grouping is
    // smaller but lets a far roof paint over a near wall.
    var ms = plan(preset, depth).sort(function (a, b) {
      return (a[0] + a[1] + a[2] + a[3]) - (b[0] + b[1] + b[2] + b[3])
    })
    var c = centre(ms, h)
    svg.setAttribute('viewBox', n(c[0] - VW / 2) + ' ' + n(c[1] - VH / 2) + ' ' + VW + ' ' + VH)
    var out = ground(ms)
    ms.forEach(function (m) {
      var x0 = m[0], z0 = m[1], x1 = m[2], z1 = m[3]
      var p = function (x, y, z) { return iso(x, y, z) }
      var solid = function (d, fill) {
        return '<path d="' + d + '" fill="' + fill + '" stroke="#b4aea4" stroke-width=".5"/>'
      }
      out += solid(path([p(x0, h, z0), p(x1, h, z0), p(x1, h, z1), p(x0, h, z1)]), '#fff')
      out += solid(path([p(x1, 0, z0), p(x1, 0, z1), p(x1, h, z1), p(x1, h, z0)]), '#e9e6e1')
      out += solid(path([p(x0, 0, z1), p(x1, 0, z1), p(x1, h, z1), p(x0, h, z1)]), '#dcd8d1')
      out += '<path d="' + bays(z1 - z0, function (u, v) { return p(x1, v, z0 + u) }, mod, floors)
           + '" fill="#b9cde0" stroke="#8fa9c2" stroke-width=".18"/>'
      out += '<path d="' + bays(x1 - x0, function (u, v) { return p(x0 + u, v, z1) }, mod, floors)
           + '" fill="#a8bfd6" stroke="#7f99b3" stroke-width=".18"/>'
    })
    return out
  }

  // Four schemes, in order. Each is [preset, floors, module, depth, label].
  var SCHEMES = [
    ['court', 8, 3.2, 12, 'Courtyard'],
    ['L', 6, 3.0, 13, 'L-plan'],
    ['U', 10, 3.4, 12, 'U-plan'],
    ['bar', 14, 3.2, 14, 'Bar']
  ]

  var label = document.getElementById('toy-label')
  var height = document.getElementById('toy-height')
  var still = window.matchMedia('(prefers-reduced-motion: reduce)')
  var at = 0

  function show(i) {
    var s = SCHEMES[i]
    svg.innerHTML = build(s[0], s[1], s[2], s[3])
    label.textContent = s[4] + ' · ' + s[1] + ' floors · ' + s[2].toFixed(1) + ' m module'
    height.textContent = (s[1] * FH) + ' m'
  }

  function next() {
    at = (at + 1) % SCHEMES.length
    svg.style.opacity = '0'
    setTimeout(function () { show(at); svg.style.opacity = '1' }, 340)
  }

  document.documentElement.classList.add('js')
  show(0)

  if (!still.matches) {
    var timer = setInterval(function () {
      if (!document.hidden) next()   // a backgrounded tab need not redraw
    }, 4200)
    still.addEventListener('change', function (e) {
      if (e.matches) { clearInterval(timer); svg.style.opacity = '1' }
    })
  }
})()
