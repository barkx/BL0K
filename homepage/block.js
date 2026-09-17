
(function () {
  var K = Math.cos(Math.PI / 6)
  var FH = 3, SILL = 0.65, WH = 1.6
  var VW = 108, VH = 94
  var iso = function (x, y, z) { return [(x - z) * K, (x + z) / 2 - y] }
  var n = function (v) { return Math.round(v * 10) / 10 }

  function plan(preset, d) {
    if (preset === 'ref') return [[0, 0, 40, 13], [40, 0, 53, 40]]
    if (preset === 'bar') return [[0, 0, 48, d]]
    if (preset === 'L') return [[0, 0, 42, d], [0, d, d, 40]]
    if (preset === 'U') return [[0, 0, d, 40], [d, 40 - d, 44, 40], [44, 0, 44 + d, 40]]
    return [[0, 0, 52, d], [0, 38 - d, 52, 38], [0, d, d, 38 - d], [52 - d, d, 52, 38 - d]]
  }

  function mass(r, floors, mod) {
    return { x0: r[0], z0: r[1], x1: r[2], z1: r[3], h: floors * FH, mod: mod || 0 }
  }
  function massesOf(preset, floors, depth, mod) {
    return plan(preset, depth).map(function (r) { return mass(r, floors, mod) })
  }

  function path(quad) {
    return 'M' + quad.map(function (p) { return n(p[0]) + ' ' + n(p[1]) }).join('L') + 'Z'
  }

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

  function storeys(len, map, floors) {
    var d = ''
    for (var f = 1; f < floors; f++) {
      var y = f * FH
      d += 'M' + n(map(0, y)[0]) + ' ' + n(map(0, y)[1]) +
           'L' + n(map(len, y)[0]) + ' ' + n(map(len, y)[1])
    }
    return d
  }

  function order(ms) {
    var behind = function (a, b) { return a.x1 <= b.x0 || a.z1 <= b.z0 }
    var out = [], left = ms.slice()
    while (left.length) {
      var i = 0
      for (var k = 0; k < left.length; k++) {
        var blocked = false
        for (var j = 0; j < left.length; j++)
          if (j !== k && behind(left[j], left[k])) { blocked = true; break }
        if (!blocked) { i = k; break }
      }
      out.push(left.splice(i, 1)[0])
    }
    return out
  }

  function bbox(ms) {
    var b = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 }
    ms.forEach(function (m) {
      b.x0 = Math.min(b.x0, m.x0); b.z0 = Math.min(b.z0, m.z0)
      b.x1 = Math.max(b.x1, m.x1); b.z1 = Math.max(b.z1, m.z1)
    })
    return b
  }

  function plotRect(ms, plot) {
    var b = bbox(ms)
    if (!plot) return [b.x0 - 6, b.z0 - 6, b.x1 + 6, b.z1 + 6]
    if (plot.length === 4) return plot.slice()
    var mx = (b.x0 + b.x1 - plot[0]) / 2, mz = (b.z0 + b.z1 - plot[1]) / 2
    return [mx, mz, mx + plot[0], mz + plot[1]]
  }

  function ground(ms, rect) {
    var c = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]]
    var q = c.map(function (v) { return iso(v[0], 0, v[1]) })
    var handles = q.map(function (v) {
      return '<circle cx="' + n(v[0]) + '" cy="' + n(v[1]) + '" r="1.45" fill="#0f5c9a"/>'
    }).join('')
    var shadow = ms.map(function (m) {
      return path([iso(m.x0 - 2, 0, m.z0 + 5), iso(m.x1 - 2, 0, m.z0 + 5),
                   iso(m.x1 - 2, 0, m.z1 + 5), iso(m.x0 - 2, 0, m.z1 + 5)])
    }).join('')
    return '<path d="' + shadow + '" fill="#bcbcbb"/>'
      + '<path d="' + path(q) + '" fill="none" stroke="#2f6ea8" stroke-width=".3"/>' + handles
  }

  function box(m) {
    var h = m.h, x0 = m.x0, z0 = m.z0, x1 = m.x1, z1 = m.z1
    var floors = Math.round(h / FH)
    var p = iso
    var solid = function (d, fill) {
      return '<path d="' + d + '" fill="' + fill + '" stroke="#84847f" stroke-width=".35"/>'
    }
    var right = function (u, v) { return p(x1, v, z0 + u) }
    var front = function (u, v) { return p(x0 + u, v, z1) }
    var out = ''
    out += solid(path([p(x0, h, z0), p(x1, h, z0), p(x1, h, z1), p(x0, h, z1)]), '#d6d5d4')
    out += solid(path([p(x1, 0, z0), p(x1, 0, z1), p(x1, h, z1), p(x1, h, z0)]), '#b0b0af')
    out += solid(path([p(x0, 0, z1), p(x1, 0, z1), p(x1, h, z1), p(x0, h, z1)]), '#9b9b9a')
    if (m.mod) {
      out += '<path d="' + bays(z1 - z0, right, m.mod, floors) + '" fill="#8b9094"/>'
      out += '<path d="' + bays(x1 - x0, front, m.mod, floors) + '" fill="#7e8388"/>'
    } else {
      out += '<path d="' + storeys(z1 - z0, right, floors) +
        storeys(x1 - x0, front, floors) +
        '" fill="none" stroke="#8b8b89" stroke-width=".22"/>'
    }
    return out
  }

  function render(ms, rect) {
    var out = ground(ms, rect)
    order(ms).forEach(function (m) { out += box(m) })
    return out
  }

  function extent(ms, rect) {
    var pts = [iso(rect[0], 0, rect[1]), iso(rect[2], 0, rect[1]),
               iso(rect[2], 0, rect[3]), iso(rect[0], 0, rect[3])]
    ms.forEach(function (m) {
      ;[[m.x0, m.z0], [m.x1, m.z0], [m.x1, m.z1], [m.x0, m.z1]].forEach(function (q) {
        pts.push(iso(q[0], 0, q[1]))
        pts.push(iso(q[0], m.h, q[1]))
      })
    })
    var xs = pts.map(function (q) { return q[0] }), ys = pts.map(function (q) { return q[1] })
    return [Math.min.apply(0, xs), Math.min.apply(0, ys),
            Math.max.apply(0, xs), Math.max.apply(0, ys)]
  }

  function centre(ms, h) {
    var b = bbox(ms), e = 6
    return [K * (b.x0 + b.x1 - b.z0 - b.z1) / 2,
            ((b.x0 + b.z0) / 2 - h + (b.x1 + b.z1 + 2 * e) / 2) / 2]
  }

  function figures(ms, rect) {
    var foot = 0, gfa = 0, tall = 0
    ms.forEach(function (m) {
      var a = (m.x1 - m.x0) * (m.z1 - m.z0)
      foot += a
      gfa += a * Math.round(m.h / FH)
      tall = Math.max(tall, m.h)
    })
    var area = rect ? (rect[2] - rect[0]) * (rect[3] - rect[1]) : 0
    return {
      foot: foot, gfa: gfa, tall: tall, plot: area,
      cover: area ? 100 * foot / area : 0,
      far: area ? gfa / area : 0
    }
  }

  function vb(e, pad) {
    return n(e[0] - pad) + ' ' + n(e[1] - pad) + ' ' +
           n(e[2] - e[0] + 2 * pad) + ' ' + n(e[3] - e[1] + 2 * pad)
  }

  window.URBGEN = {
    block: function (preset, floors, mod, depth, plot) {
      var ms = massesOf(preset, floors, depth, mod)
      var rect = plotRect(ms, plot)
      var f = figures(ms, plot ? rect : null)
      var frame = plot ? vb(extent(ms, rect), 3)
        : (function () {
            var c = centre(ms, floors * FH)
            return n(c[0] - VW / 2) + ' ' + n(c[1] - VH / 2) + ' ' + VW + ' ' + VH
          })()
      return {
        svg: render(ms, rect), viewBox: frame, extent: extent(ms, rect),
        foot: f.foot, gfa: f.gfa, tall: f.tall, plot: f.plot,
        cover: f.cover, far: f.far
      }
    },

    site: function (plot, buildings) {
      var ms = buildings.map(function (b) {
        return mass([b[0], b[1], b[0] + b[2], b[1] + b[3]], b[4], 0)
      })
      var rect = [0, 0, plot[0], plot[1]]
      var f = figures(ms, rect)
      return {
        svg: render(ms, rect), extent: extent(ms, rect), viewBox: vb(extent(ms, rect), 3),
        foot: f.foot, gfa: f.gfa, tall: f.tall, plot: f.plot,
        cover: f.cover, far: f.far, count: buildings.length
      }
    },

    frame: function (extents, pad) {
      var p = pad == null ? 3 : pad
      return vb([Math.min.apply(0, extents.map(function (e) { return e[0] })),
                 Math.min.apply(0, extents.map(function (e) { return e[1] })),
                 Math.max.apply(0, extents.map(function (e) { return e[2] })),
                 Math.max.apply(0, extents.map(function (e) { return e[3] }))], p)
    }
  }

  var svg = document.getElementById('toy')
  if (!svg || !svg.getAttribute) return

  var SCHEMES = [
    ['court', 8, 3.2, 12, 'Courtyard'],
    ['L', 6, 3.0, 13, 'L-plan'],
    ['U', 10, 3.4, 12, 'U-plan'],
    ['bar', 14, 3.2, 14, 'Bar']
  ]

  var label = document.getElementById('toy-label')
  var rows = document.getElementById('toy-figures')
  var still = window.matchMedia('(prefers-reduced-motion: reduce)')
  var at = 0

  function N(v, d) {
    return v.toFixed(d || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  }

  function show(i) {
    var s = SCHEMES[i]
    var r = window.URBGEN.block(s[0], s[1], s[2], s[3])
    svg.setAttribute('viewBox', r.viewBox)
    svg.innerHTML = r.svg
    label.textContent = s[4] + ' · ' + s[2].toFixed(1) + ' m module'
    if (!rows) return
    rows.innerHTML = [
      ['Footprint', N(r.foot) + ' m²', 'sum of wings'],
      ['Floors', String(s[1]), 'at ' + FH.toFixed(1) + ' m'],
      ['GFA', N(r.gfa) + ' m²', N(r.foot) + ' × ' + s[1]],
      ['Height', N(r.tall, 1) + ' m', s[1] + ' × ' + FH.toFixed(1)]
    ].map(function (r2) {
      return '<div><dt>' + r2[0] + '</dt><dd class="v num">' + r2[1] +
             '</dd><dd class="w">' + r2[2] + '</dd></div>'
    }).join('')
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
      if (!document.hidden) next()
    }, 4200)
    still.addEventListener('change', function (e) {
      if (e.matches) { clearInterval(timer); svg.style.opacity = '1' }
    })
  }
})()
