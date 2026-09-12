/*
  The block in the hero, rebuilt as you drag. Same isometric projection the
  static drawings use, and the same defaults the app ships with — 3 m floors,
  a 0.65 m sill, openings 1.6 m tall.

  It is a miniature, not the app: no junction detection, no metrics, no
  balconies. It exists so the page demonstrates "change a slider and it
  rebuilds" instead of asserting it.

  With JavaScript off this file never runs, the controls stay hidden by
  default, and the static drawing already in the markup is what you get.
*/
(function () {
  var svg = document.getElementById('toy')
  if (!svg || !svg.getAttribute) return

  var K = Math.cos(Math.PI / 6)
  var FH = 3, SILL = 0.65, WH = 1.6
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

  // Openings along one face, as one path. `map` turns (along, height) into a point.
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

  function build(preset, floors, mod, depth) {
    var h = floors * FH
    // Back to front, so nearer masses paint over further ones. The paths are
    // emitted per mass rather than grouped by face: grouping is smaller, but
    // it lets a far mass's roof paint over a near mass's wall.
    var ms = plan(preset, depth).sort(function (a, b) {
      return (a[0] + a[1] + a[2] + a[3]) - (b[0] + b[1] + b[2] + b[3])
    })
    var out = ''
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

  var form = document.getElementById('toy-controls')
  var get = function (id) { return document.getElementById(id) }
  var floors = get('t-floors'), mod = get('t-mod'), depth = get('t-depth')

  function draw() {
    var preset = (form.querySelector('input[name=preset]:checked') || {}).value || 'court'
    var f = +floors.value, m = +mod.value, d = +depth.value
    svg.innerHTML = build(preset, f, m, d)
    get('v-floors').textContent = f
    get('v-mod').textContent = m.toFixed(1) + ' m'
    get('v-depth').textContent = d + ' m'
    get('v-height').textContent = (f * FH).toFixed(0) + ' m'
  }

  // Straight through, no frame throttle. A rAF latch drops every later input
  // if the frame never arrives — which is what a backgrounded page does — and
  // rebuilding this is cheap enough not to need one.
  form.addEventListener('input', draw)
  document.documentElement.classList.add('js')
  draw()
})()
