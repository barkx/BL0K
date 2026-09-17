import { footprint, footprintsAt, levels, shapesAt, topLevel } from '../geometry/masses'
import type { PlacedBuilding, SiteBuild } from '../site/build'
import type { Site } from '../site/types'
import { place, type Vec2 } from '../lib/poly'
import type { Rect } from '../lib/rect'
import { bandAt } from '../store/program'
import { unionArea } from '../lib/convex'

/**
 * Plans and elevations as SVG, written by hand.
 *
 * Third format after the metrics CSV and the IFC, and written the same way and
 * for the same reason: SVG is text, so keeping it in-house adds no dependency
 * and works with the connection unplugged. It also means the drawing is a
 * function of the model rather than of the screen — a screenshot is whatever
 * the camera was doing, while this is measurable and comes out the same twice.
 *
 * ## Scale is real
 *
 * The sheet is sized in millimetres and drawn in millimetres, so printing at
 * 100% gives a drawing you can put a scale rule on. One metre becomes
 * `1000 / scale` mm: at 1:200, 5 mm.
 *
 * ## What is deliberately not in here
 *
 * **Imported OpenStreetMap context.** It is drawn in the viewport to trace
 * over and it is excluded from every metric, every clash test and every export
 * — and a drawing is an export. That is the ODbL licence as much as the design:
 * OSM geometry inside a drawing handed to a client carries obligations with it.
 *
 * **Anything inside the envelope.** A plan here is a plan of the massing: the
 * outline, the core shaft, the module rhythm and the openings. Rooms, corridors
 * and unit layouts are `project.md` §1 non-goals and are not quietly implied by
 * drawing a line where one might go.
 */

export interface DrawingOptions {
  /** Denominator: 200 means 1:200. */
  scale: number
  title: string
}

/** Fixed in millimetres, so weight reads the same at any scale. */
const W_OUTLINE = 0.35
const W_DETAIL = 0.18
const W_FINE = 0.09
const MARGIN = 12
/** Room under the drawing for the title, scale bar and north point. */
const FOOTER = 16

const INK = '#22303d'
const FAINT = '#8a97a4'

const n = (v: number) => {
  const r = Math.round(v * 100) / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Accumulates SVG elements in paper millimetres. */
class Sheet {
  private parts: string[] = []

  line(x0: number, y0: number, x1: number, y1: number, w = W_DETAIL, dash?: string) {
    this.parts.push(
      `<line x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y1)}" stroke="${INK}"` +
        ` stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`,
    )
  }

  rect(x: number, y: number, w: number, h: number, stroke = W_DETAIL, fill = 'none', dash?: string) {
    if (w <= 0 || h <= 0) return
    this.parts.push(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"` +
        ` stroke="${INK}" stroke-width="${stroke}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`,
    )
  }

  poly(points: { x: number; y: number }[], w = W_OUTLINE, close = true, dash?: string) {
    if (points.length < 2) return
    const d = points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')
    const tag = close ? 'polygon' : 'polyline'
    this.parts.push(
      `<${tag} points="${d}" fill="none" stroke="${INK}" stroke-width="${w}"` +
        `${dash ? ` stroke-dasharray="${dash}"` : ''}/>`,
    )
  }

  text(x: number, y: number, s: string, size = 2.5, colour = INK, anchor = 'start') {
    this.parts.push(
      `<text x="${n(x)}" y="${n(y)}" font-family="Helvetica, Arial, sans-serif"` +
        ` font-size="${n(size)}" fill="${colour}" text-anchor="${anchor}">${esc(s)}</text>`,
    )
  }

  body() {
    return this.parts.join('\n  ')
  }
}

/**
 * A scale bar and the numbers that make the drawing checkable.
 *
 * Both are here because a drawing with neither is a picture: the bar survives
 * being resized in somebody else's document, and the printed ratio only holds
 * if nobody scaled the page.
 */
function footer(s: Sheet, width: number, y: number, o: DrawingOptions, note: string) {
  s.line(MARGIN, y, width - MARGIN, y, W_FINE)
  s.text(MARGIN, y + 5, o.title, 3.2)
  s.text(MARGIN, y + 9.5, note, 2.2, FAINT)

  // Ten metres, divided in two, drawn at the sheet's own scale.
  const ten = (10 * 1000) / o.scale
  const x0 = width - MARGIN - ten
  s.rect(x0, y + 4, ten / 2, 1.4, W_FINE, INK)
  s.rect(x0 + ten / 2, y + 4, ten / 2, 1.4, W_FINE, 'none')
  s.text(x0, y + 9, '0', 2.2, FAINT)
  s.text(width - MARGIN, y + 9, '10 m', 2.2, FAINT, 'end')
  s.text(width - MARGIN, y + 13, `1:${o.scale}`, 2.6, INK, 'end')
}

/** North is −z in the model, so it is up the page once z runs downward. */
function northPoint(s: Sheet, x: number, y: number, trueNorthDeg: number) {
  const r = (trueNorthDeg * Math.PI) / 180
  const len = 6
  const dx = Math.sin(r) * len
  const dy = -Math.cos(r) * len
  s.line(x, y, x + dx, y + dy, W_DETAIL)
  s.text(x + dx, y + dy - 1.5, 'N', 2.4, INK, 'middle')
}

function document_(width: number, height: number, body: string) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}mm" height="${n(height)}mm"` +
    ` viewBox="0 0 ${n(width)} ${n(height)}">\n  ` +
    `<rect width="${n(width)}" height="${n(height)}" fill="#ffffff"/>\n  ` +
    body +
    `\n</svg>\n`
  )
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/** World metres to paper millimetres, with north up. */
function planFrame(b: { x0: number; x1: number; z0: number; z1: number }, scale: number) {
  const k = 1000 / scale
  const w = (b.x1 - b.x0) * k + MARGIN * 2
  const h = (b.z1 - b.z0) * k + MARGIN * 2 + FOOTER
  return {
    width: Math.max(w, 90),
    height: h,
    // +z runs down the page, which puts model north at the top.
    X: (x: number) => (x - b.x0) * k + MARGIN,
    Y: (z: number) => (z - b.z0) * k + MARGIN,
    k,
  }
}

const cornersOf = (r: Rect): Vec2[] => [
  { x: r.x0, z: r.z0 },
  { x: r.x1, z: r.z0 },
  { x: r.x1, z: r.z1 },
  { x: r.x0, z: r.z1 },
]

/**
 * The site: the plot boundary, every building's footprint where it meets the
 * ground, and the cores inside them.
 *
 * Footprints are transformed through `place()` rather than drawn axis-aligned,
 * because a building is generated in its own frame and rotated by the site
 * layer — the same split the whole app keeps.
 */
export function sitePlanSvg(site: Site, build: SiteBuild, o: DrawingOptions): string {
  const pts: Vec2[] = [...site.plot]
  for (const { placement, building } of build.placed) {
    for (const m of building.masses) {
      for (const c of cornersOf(footprint(m))) pts.push(place(c, placement.rotation, placement.position))
    }
  }
  const b = pts.length
    ? {
        x0: Math.min(...pts.map((p) => p.x)),
        x1: Math.max(...pts.map((p) => p.x)),
        z0: Math.min(...pts.map((p) => p.z)),
        z1: Math.max(...pts.map((p) => p.z)),
      }
    : { x0: 0, x1: 50, z0: 0, z1: 50 }

  const f = planFrame(b, o.scale)
  const s = new Sheet()

  if (site.plot.length >= 3) {
    s.poly(site.plot.map((p) => ({ x: f.X(p.x), y: f.Y(p.z) })), W_DETAIL, true, '3 1.5')
  }

  for (const { placement, building } of build.placed) {
    for (const r of footprintsAt(building.masses, 0)) {
      s.poly(
        cornersOf(r)
          .map((c) => place(c, placement.rotation, placement.position))
          .map((p) => ({ x: f.X(p.x), y: f.Y(p.z) })),
        W_OUTLINE,
      )
    }
    for (const core of building.cores.cores) {
      s.poly(
        cornersOf(core.rect)
          .map((c) => place(c, placement.rotation, placement.position))
          .map((p) => ({ x: f.X(p.x), y: f.Y(p.z) })),
        W_FINE,
      )
    }
    const c = place(
      { x: 0, z: 0 },
      placement.rotation,
      placement.position,
    )
    s.text(f.X(c.x), f.Y(c.z), placement.name, 2.6, INK, 'middle')
  }

  northPoint(s, f.width - MARGIN - 6, MARGIN + 10, site.geo?.trueNorth ?? 0)
  footer(
    s,
    f.width,
    f.height - FOOTER,
    o,
    `${build.placed.length} building${build.placed.length === 1 ? '' : 's'} · ` +
      `${Math.round(build.metrics.gfa)} m² GFA · plot ${Math.round(build.metrics.plotArea)} m²`,
  )
  return document_(f.width, f.height, s.body())
}

/**
 * One level of one building: the outline it occupies, the cores that pass
 * through it, and the module rhythm ticked along every exterior face.
 *
 * Drawn in the building's own frame rather than rotated onto the site, because
 * a floor plan is read square to the building. The site plan is the drawing
 * that knows about rotation.
 */
export function floorPlanSvg(placed: PlacedBuilding, level: number, o: DrawingOptions): string {
  const { building, placement } = placed
  const outlines = shapesAt(building.masses, level)
  const pts = outlines.flat()
  const b = pts.length
    ? {
        x0: Math.min(...pts.map((q) => q.x)),
        x1: Math.max(...pts.map((q) => q.x)),
        z0: Math.min(...pts.map((q) => q.z)),
        z1: Math.max(...pts.map((q) => q.z)),
      }
    : { x0: 0, x1: 20, z0: 0, z1: 20 }

  const f = planFrame(b, o.scale)
  const s = new Sheet()

  // The outline itself, so a mitred wing draws as the shape it is.
  for (const outline of outlines) {
    s.poly(outline.map((q) => ({ x: f.X(q.x), y: f.Y(q.z) })), W_OUTLINE)
  }

  // A core is drawn where it actually passes through this level, and not where
  // it has already stopped.
  for (const core of building.cores.cores) {
    if (level >= core.topFloor) continue
    s.rect(
      f.X(core.rect.x0),
      f.Y(core.rect.z0),
      (core.rect.x1 - core.rect.x0) * f.k,
      (core.rect.z1 - core.rect.z0) * f.k,
      W_DETAIL,
      'none',
      '1.5 1',
    )
  }

  // The module rhythm, ticked on the faces that have one at this level. This is
  // the facade grid a plan is actually read against — not a room division.
  for (const e of building.elevations) {
    if (e.abutting) continue
    if (level < e.baseFloor || level >= e.baseFloor + e.floors) continue
    const fit = building.facade.fit[e.key]
    if (!fit) continue
    const spans = e.openByFloor[level - e.baseFloor] ?? []
    for (let i = 0; i <= fit.count; i++) {
      const u = i * fit.actual
      if (!spans.some((sp) => u >= sp.a - 1e-6 && u <= sp.b + 1e-6)) continue
      const x = e.origin.x + e.uDir.x * u
      const z = e.origin.z + e.uDir.z * u
      const tickLength = 1.2 / f.k
      s.line(
        f.X(x),
        f.Y(z),
        f.X(x + e.normal.x * tickLength),
        f.Y(z + e.normal.z * tickLength),
        W_FINE,
      )
    }
  }

  const p = placement.params
  const use = bandAt(p.program, level)?.use ?? 'residential'
  footer(
    s,
    f.width,
    f.height - FOOTER,
    o,
    `${placement.name} · level ${level} · ${use} · ${Math.round(unionArea(outlines))} m² gross`,
  )
  return document_(f.width, f.height, s.body())
}

// ---------------------------------------------------------------------------
// Elevations
// ---------------------------------------------------------------------------

/**
 * One elevation, drawn in its own (u, v) frame.
 *
 * The facade model is already authored in exactly these coordinates — `u`
 * along the face, `y` up — so the drawing is close to a direct transcription,
 * which is the whole reason the frame was kept explicit in the first place.
 */
export function elevationSvg(placed: PlacedBuilding, elevKey: string, o: DrawingOptions): string {
  const { building, placement } = placed
  const e = building.elevations.find((x) => x.key === elevKey)
  const p = placement.params
  const k = 1000 / o.scale

  if (!e) return document_(120, 60, '')

  const top = topLevel(building.masses) * p.floorHeight + p.roofParapet
  const width = e.length * k + MARGIN * 2
  const height = top * k + MARGIN * 2 + FOOTER
  const X = (u: number) => u * k + MARGIN
  // Ground sits at the bottom of the drawing, so the world's +y runs up it.
  const Y = (y: number) => MARGIN + (top - y) * k

  const s = new Sheet()

  // The silhouette, one run per floor: an elevation with a junction in it is
  // not a single rectangle, and drawing it as one would claim wall where the
  // building has none.
  for (let i = 0; i < e.floors; i++) {
    const level = e.baseFloor + i
    const y0 = level * p.floorHeight
    for (const span of e.openByFloor[i]) {
      s.rect(X(span.a), Y(y0 + p.floorHeight), (span.b - span.a) * k, p.floorHeight * k, W_FINE)
    }
  }

  // Floor lines, then the openings over them.
  for (let i = 0; i <= e.floors; i++) {
    const y = (e.baseFloor + i) * p.floorHeight
    const spans = e.openByFloor[Math.min(i, e.floors - 1)]
    for (const span of spans) s.line(X(span.a), Y(y), X(span.b), Y(y), W_FINE)
  }

  for (const o2 of building.facade.openings) {
    if (o2.elevKey !== elevKey) continue
    s.rect(X(o2.u0), Y(o2.y1), (o2.u1 - o2.u0) * k, (o2.y1 - o2.y0) * k, W_DETAIL)
  }

  // Balconies read as what they are: a projecting slab is an outline in front
  // of the wall, a loggia a dashed recess behind it.
  for (const m of building.facade.modules) {
    if (m.elevKey !== elevKey || m.balcony === 'none') continue
    const guard = 1.1
    s.rect(
      X(m.bu0),
      Y(m.yBase + guard),
      (m.bu1 - m.bu0) * k,
      guard * k,
      W_FINE,
      'none',
      m.balcony === 'loggia' ? '1.5 1' : undefined,
    )
  }

  // Parapet and ground.
  s.line(MARGIN, Y(0), width - MARGIN, Y(0), W_OUTLINE)
  footer(
    s,
    width,
    height - FOOTER,
    o,
    `${placement.name} · elevation ${e.dir} (${e.key}) · ${n(e.length)} m long · ${n(top)} m tall`,
  )
  return document_(width, height, s.body())
}

/** Every non-abutting elevation of a building, in a stable order. */
export const elevationKeys = (placed: PlacedBuilding): string[] =>
  placed.building.elevations.filter((e) => !e.abutting).map((e) => e.key)

/** Levels a building actually occupies, for the floor-plan picker. */
export const planLevels = (placed: PlacedBuilding): number[] => levels(placed.building.masses)

/** A sensible "typical" floor: the first one clear of the ground and any band. */
export function typicalLevel(placed: PlacedBuilding): number {
  const all = planLevels(placed)
  const p = placed.placement.params
  const clear = all.filter((l) => l > 0 && !bandAt(p.program, l))
  return clear.length > 0 ? clear[Math.floor(clear.length / 2)] : (all[all.length - 1] ?? 0)
}
