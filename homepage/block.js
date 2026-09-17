/*
  The isometric block: the hero, which rotates through four schemes, and the
  drawing functions the other scenes share, so the projection exists once.

  Same defaults as the app: 3 m floors, 0.65 m sill, 1.6 m openings. A
  miniature — no junction detection, no metrics, no balconies. Fixed rotation
  order, not random: determinism is a claim this page makes. Does not rotate
  under prefers-reduced-motion, does not redraw while hidden, and never runs
  at all with JavaScript off, where the static shot stands.

  Nothing here touches the DOM except the hero's own code at the bottom. The
  drawing functions take masses and return a string. They used to set the
  hero's viewBox as a side effect of drawing anything at all, so the options
  scene reframed the hero every time it ticked.
*/
(function () {
  var K = Math.cos(Math.PI / 6)
  var FH = 3, SILL = 0.65, WH = 1.6
  var VW = 108, VH = 94   // fits the widest and tallest scheme, centred

  // The app's three render modes, sampled from its own viewport rather than
  // chosen. `white` is the default and what every drawing on the page uses.
  var PAL = {
    white: { roof: '#d6d5d4', right: '#b0b0af', front: '#9b9b9a', line: '#84847f',
             bayR: '#8b9094', bayF: '#7e8388', sto: '#8b8b89' },
    shaded: { roof: '#e6e5e2', right: '#a0a09e', front: '#7c7c7b', line: '#6d6d69',
              bayR: '#7d8288', bayF: '#6b7076', sto: '#77776f' },
    diagram: { roof: '#f2f0ec', right: '#e4e1dc', front: '#d5d2cc', line: '#2f6ea8',
               bayR: '#bcd0e2', bayF: '#aec6dc', sto: '#7fa6c8' }
  }
  var iso = function (x, y, z) { return [(x - z) * K, (x + z) / 2 - y] }
  var n = function (v) { return Math.round(v * 10) / 10 }

  // Footprints as [x0, z0, x1, z1] in metres, building-local.
  function plan(preset, d) {
    if (preset === 'ref') return [[0, 0, 40, 13], [40, 0, 53, 40]]
    if (preset === 'bar') return [[0, 0, 48, d]]
    if (preset === 'L') return [[0, 0, 42, d], [0, d, d, 40]]
    if (preset === 'U') return [[0, 0, d, 40], [d, 40 - d, 44, 40], [44, 0, 44 + d, 40]]
    return [[0, 0, 52, d], [0, 38 - d, 52, 38], [0, d, d, 38 - d], [52 - d, d, 52, 38 - d]]
  }

  // A mass carries its own height and module, so a composition can put a
  // three-storey plinth beside a twelve-storey tower. `mod` of 0 draws storey
  // lines instead of openings: at site scale a window is four pixels wide,
  // which is texture pretending to be information.
  function mass(r, floors, mod) {
    return { x0: r[0], z0: r[1], x1: r[2], z1: r[3], h: floors * FH, mod: mod || 0 }
  }
  function massesOf(preset, floors, depth, mod) {
    return plan(preset, depth).map(function (r) { return mass(r, floors, mod) })
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

  // Storey lines along one face, for when a window would be four pixels wide.
  function storeys(len, map, floors) {
    var d = ''
    for (var f = 1; f < floors; f++) {
      var y = f * FH
      d += 'M' + n(map(0, y)[0]) + ' ' + n(map(0, y)[1]) +
           'L' + n(map(len, y)[0]) + ' ' + n(map(len, y)[1])
    }
    return d
  }

  /*
    Depth order. Centre-sorting is wrong once masses differ in extent: a
    courtyard's short east wing outranks the long south wing that is nearer.
    A is behind B when A ends before B begins on either axis, so repeatedly
    take whichever mass has nothing left that must precede it.
  */
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

  // A boundary given as [width, depth] is centred on the massing; one given as
  // [x0, z0, x1, z1] is already where it belongs. No plot at all falls back to
  // a 6 m margin drawn to sit the block on — a margin, not a designed boundary.
  function plotRect(ms, plot) {
    var b = bbox(ms)
    if (!plot) return [b.x0 - 6, b.z0 - 6, b.x1 + 6, b.z1 + 6]
    if (plot.length === 4) return plot.slice()
    var mx = (b.x0 + b.x1 - plot[0]) / 2, mz = (b.z0 + b.z1 - plot[1]) / 2
    return [mx, mz, mx + plot[0], mz + plot[1]]
  }

  /*
    The plot as the app draws it: a blue line on the viewport with a round
    handle at each corner, and a soft shadow under the massing. No filled
    plate — in the app the ground simply is the background.

    `edge` is how much of the boundary is drawn, 0 to 1, which is how the
    tour's first step draws a plot. Measured along the projected edges rather
    than the real ones, so the line grows at an even speed on screen; a corner
    handle appears as the line reaches it.
  */
  function ground(ms, rect, edge) {
    var c = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]]
    var q = c.map(function (v) { return iso(v[0], 0, v[1]) })
    var e = edge == null ? 1 : Math.max(0, Math.min(1, edge))
    var seg = [], total = 0
    for (var i = 0; i < 4; i++) {
      var a = q[i], b = q[(i + 1) % 4]
      var L = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]))
      seg.push([a, b, L]); total += L
    }
    var want = total * e, run = 0, d = e > 0 ? 'M' + n(q[0][0]) + ' ' + n(q[0][1]) : '', reached = 0
    for (i = 0; i < 4 && run < want; i++) {
      var t = Math.min(1, (want - run) / seg[i][2]), A = seg[i][0], B = seg[i][1]
      d += 'L' + n(A[0] + (B[0] - A[0]) * t) + ' ' + n(A[1] + (B[1] - A[1]) * t)
      run += seg[i][2]
      if (t === 1) reached = i + 1
    }
    if (e >= 1) d += 'Z'   // a finished boundary closes, as it did before
    var handles = q.map(function (v, k) {
      if (e <= 0 || (k > 0 && k > reached)) return ''
      return '<circle cx="' + n(v[0]) + '" cy="' + n(v[1]) + '" r="1.45" fill="#0f5c9a"/>'
    }).join('')
    var shadow = ms.map(function (m) {
      return path([iso(m.x0 - 2, 0, m.z0 + 5), iso(m.x1 - 2, 0, m.z0 + 5),
                   iso(m.x1 - 2, 0, m.z1 + 5), iso(m.x0 - 2, 0, m.z1 + 5)])
    }).join('')
    return '<path d="' + shadow + '" fill="#bcbcbb"/>'
      + '<path d="' + d + '" fill="none" stroke="#2f6ea8" stroke-width=".3"/>' + handles
  }

  function box(m) {
    var h = m.h, x0 = m.x0, z0 = m.z0, x1 = m.x1, z1 = m.z1
    var floors = Math.round(h / FH)
    var c = PAL[m.pal] || PAL.white
    var p = iso
    var solid = function (d, fill) {
      return '<path d="' + d + '" fill="' + fill + '" stroke="' + c.line + '" stroke-width=".35"/>'
    }
    var right = function (u, v) { return p(x1, v, z0 + u) }
    var front = function (u, v) { return p(x0 + u, v, z1) }
    var out = ''
    out += solid(path([p(x0, h, z0), p(x1, h, z0), p(x1, h, z1), p(x0, h, z1)]), c.roof)
    out += solid(path([p(x1, 0, z0), p(x1, 0, z1), p(x1, h, z1), p(x1, h, z0)]), c.right)
    out += solid(path([p(x0, 0, z1), p(x1, 0, z1), p(x1, h, z1), p(x0, h, z1)]), c.front)
    // A programme band is a run of floors given another use, so it is painted
    // over the two visible faces rather than modelled: the app changes the
    // glazing of those floors, not the shape of the building.
    if (m.bands) m.bands.forEach(function (b) {
      var y0 = b[0] * FH, y1 = Math.min(b[1] * FH, h)
      if (y1 <= y0) return
      out += '<path d="' + path([p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0)])
           + path([p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)])
           + '" fill="' + b[2] + '"/>'
    })
    if (m.mod) {
      out += '<path d="' + bays(z1 - z0, right, m.mod, floors) + '" fill="' + c.bayR + '"/>'
      out += '<path d="' + bays(x1 - x0, front, m.mod, floors) + '" fill="' + c.bayF + '"/>'
    } else {
      out += '<path d="' + storeys(z1 - z0, right, floors) +
        storeys(x1 - x0, front, floors) +
        '" fill="none" stroke="' + c.sto + '" stroke-width=".22"/>'
    }
    return out
  }

  // Back to front. Emitted per mass, not grouped by face: grouping is smaller
  // but lets a far roof paint over a near wall.
  function render(ms, rect, edge) {
    var out = ground(ms, rect, edge)
    order(ms).forEach(function (m) { out += box(m) })
    return out
  }

  // Screen extents of everything drawn, so a caller can fit a box to it — or,
  // for a set of schemes, fit one box to all of them and keep the scale equal.
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

  // Centre, solved not sampled: in this projection the extremes are always the
  // same corners — (x0,z1) left, (x1,z0) right, top of the nearest mass high,
  // far ground corner low.
  function centre(ms, h) {
    var b = bbox(ms), e = 6
    return [K * (b.x0 + b.x1 - b.z0 - b.z1) / 2,
            ((b.x0 + b.z0) / 2 - h + (b.x1 + b.z1 + 2 * e) / 2) / 2]
  }

  // Figures computed from the masses, not typed beside them. Every preset and
  // every composition here is rectangles that abut rather than overlap, so a
  // footprint is an exact sum — the app needs a polygon union for the general
  // case and this does not, which is why the working can be shown in full.
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

  // What this file publishes. Duplicating the projection would have meant two
  // places to get the depth sort wrong, which has happened once already across
  // this file and the drawings generator.
  window.URBGEN = {
    // One building from a preset. `plot` is [w, d] centred on it, or omitted
    // for the drawn margin. Returns the drawing and a box fitted to it.
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

    // A whole site: a plot as [w, d] from 0,0, and buildings on it as
    // [x, z, width, depth, floors]. Several buildings on one boundary is what
    // a design option actually is in the app. No rotation, on purpose: the
    // depth sort above is the axis-aligned test, and a turned box needs a
    // different one.
    site: function (plot, buildings, opts) {
      var o = opts || {}
      var ms = buildings.map(function (b) {
        var m = mass([b[0], b[1], b[0] + b[2], b[1] + b[3]], b[4], 0)
        m.pal = b[5] || o.pal
        m.bands = b[6] || null
        return m
      })
      var rect = [0, 0, plot[0], plot[1]]
      var f = figures(ms, rect)
      return {
        svg: render(ms, rect, o.edge), extent: extent(ms, rect), viewBox: vb(extent(ms, rect), 3),
        foot: f.foot, gfa: f.gfa, tall: f.tall, plot: f.plot,
        cover: f.cover, far: f.far, count: buildings.length
      }
    },

    // One box around several drawings, so schemes compared side by side are
    // drawn at the same scale. A scheme drawn to fit its own frame would be
    // bigger for being smaller, which is the opposite of a comparison.
    frame: function (extents, pad) {
      var p = pad == null ? 3 : pad
      return vb([Math.min.apply(0, extents.map(function (e) { return e[0] })),
                 Math.min.apply(0, extents.map(function (e) { return e[1] })),
                 Math.max.apply(0, extents.map(function (e) { return e[2] })),
                 Math.max.apply(0, extents.map(function (e) { return e[3] }))], p)
    }
  }

  /* ------------------------------------------------------------------ hero */

  var svg = document.getElementById('toy')
  if (!svg || !svg.getAttribute) return

  // Four schemes, in order. Each is [preset, floors, module, depth, label].
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

  // The figures beside the block. Deliberately nothing that needs a plot: the
  // ground here is a margin drawn to sit the block on, not a designed
  // boundary, and dividing by it would report a plot ratio of 3.96 — true of
  // this drawing, misleading about the tool. The options scene has a real
  // boundary and so may divide by it.
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
      if (!document.hidden) next()   // a backgrounded tab need not redraw
    }, 4200)
    still.addEventListener('change', function (e) {
      if (e.matches) { clearInterval(timer); svg.style.opacity = '1' }
    })
  }
})()
