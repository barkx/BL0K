/**
 * Plan-space polygon maths for the site layer.
 *
 * Buildings are generated axis-aligned in their own local frame and then placed
 * with a rotation and an offset, so the site has to reason about *rotated*
 * quads rather than the AABBs `lib/rect.ts` handles. Everything works in the XZ
 * plane, wound either way. Area, containment and simplicity handle concave
 * polygons — the plot may be any shape. Only `convexOverlap` and `polygonGap`
 * require convex input, and both are only ever given building footprint quads.
 */

export interface Vec2 {
  x: number
  z: number
}

export type Poly = Vec2[]

const EPS = 1e-9

/** Signed area by the shoelace formula; positive when wound counter-clockwise. */
export function signedArea(poly: Poly): number {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j].x * poly[i].z - poly[i].x * poly[j].z
  }
  return a / 2
}

export const polygonArea = (poly: Poly) => Math.abs(signedArea(poly))

export function centroid(poly: Poly): Vec2 {
  const a = signedArea(poly)
  if (Math.abs(a) < EPS) {
    // Degenerate: fall back to the average of the vertices.
    const n = Math.max(1, poly.length)
    return {
      x: poly.reduce((s, p) => s + p.x, 0) / n,
      z: poly.reduce((s, p) => s + p.z, 0) / n,
    }
  }
  let cx = 0
  let cz = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j].x * poly[i].z - poly[i].x * poly[j].z
    cx += (poly[j].x + poly[i].x) * cross
    cz += (poly[j].z + poly[i].z) * cross
  }
  return { x: cx / (6 * a), z: cz / (6 * a) }
}

export interface Bounds2 {
  x0: number
  x1: number
  z0: number
  z1: number
}

export function bounds(points: Poly): Bounds2 {
  if (points.length === 0) return { x0: 0, x1: 0, z0: 0, z1: 0 }
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (const p of points) {
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.z < z0) z0 = p.z
    if (p.z > z1) z1 = p.z
  }
  return { x0, x1, z0, z1 }
}

/** Rotate about the origin by `deg`, then translate. */
export function place(p: Vec2, deg: number, offset: Vec2): Vec2 {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return {
    x: p.x * c + p.z * s + offset.x,
    z: -p.x * s + p.z * c + offset.z,
  }
}

/** Ray casting. Points exactly on an edge may fall either way — fine here. */
export function pointInPolygon(point: Vec2, poly: Poly): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j]
    const b = poly[i]
    const straddles = b.z > point.z !== a.z > point.z
    if (!straddles) continue
    const t = (a.z - point.z) / (a.z - b.z)
    if (point.x < b.x * t + a.x * (1 - t)) inside = !inside
  }
  return inside
}

const axesOf = (poly: Poly): Vec2[] => {
  const out: Vec2[] = []
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ex = poly[i].x - poly[j].x
    const ez = poly[i].z - poly[j].z
    const l = Math.hypot(ex, ez)
    if (l > EPS) out.push({ x: -ez / l, z: ex / l })
  }
  return out
}

const project = (poly: Poly, axis: Vec2) => {
  let lo = Infinity
  let hi = -Infinity
  for (const p of poly) {
    const d = p.x * axis.x + p.z * axis.z
    if (d < lo) lo = d
    if (d > hi) hi = d
  }
  return { lo, hi }
}

/**
 * Do two convex polygons overlap? Separating-axis test, exact for convex
 * shapes. `tolerance` lets two buildings touch without counting as a clash.
 */
export function convexOverlap(a: Poly, b: Poly, tolerance = 1e-3): boolean {
  if (a.length < 3 || b.length < 3) return false
  for (const axis of [...axesOf(a), ...axesOf(b)]) {
    const pa = project(a, axis)
    const pb = project(b, axis)
    if (Math.min(pa.hi, pb.hi) - Math.max(pa.lo, pb.lo) <= tolerance) return false
  }
  return true
}

/** A rectangle as a closed polygon, wound counter-clockwise in XZ. */
export function rectanglePoly(width: number, depth: number, centre: Vec2 = { x: 0, z: 0 }): Poly {
  const w = width / 2
  const d = depth / 2
  return [
    { x: centre.x - w, z: centre.z - d },
    { x: centre.x + w, z: centre.z - d },
    { x: centre.x + w, z: centre.z + d },
    { x: centre.x - w, z: centre.z + d },
  ]
}

const cross3 = (o: Vec2, a: Vec2, b: Vec2) =>
  (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)

/** Is `q` on segment `pr`, given the three are collinear? */
const onSegment = (p: Vec2, q: Vec2, r: Vec2) =>
  q.x >= Math.min(p.x, r.x) - EPS &&
  q.x <= Math.max(p.x, r.x) + EPS &&
  q.z >= Math.min(p.z, r.z) - EPS &&
  q.z <= Math.max(p.z, r.z) + EPS

export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = cross3(p3, p4, p1)
  const d2 = cross3(p3, p4, p2)
  const d3 = cross3(p1, p2, p3)
  const d4 = cross3(p1, p2, p4)

  if (((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
      ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))) return true

  // Collinear touching counts: a plot that doubles back on itself is not simple.
  if (Math.abs(d1) <= EPS && onSegment(p3, p1, p4)) return true
  if (Math.abs(d2) <= EPS && onSegment(p3, p2, p4)) return true
  if (Math.abs(d3) <= EPS && onSegment(p1, p3, p2)) return true
  if (Math.abs(d4) <= EPS && onSegment(p1, p4, p2)) return true
  return false
}

/**
 * Does the boundary cross itself? Shoelace area is meaningless on a
 * self-intersecting polygon — the lobes cancel — so coverage and plot ratio
 * would quietly report nonsense. Cheap to check: the plot has a handful of
 * vertices.
 */
export function isSimple(poly: Poly): boolean {
  const n = poly.length
  if (n < 3) return false
  for (let i = 0; i < n; i++) {
    const a1 = poly[i]
    const a2 = poly[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges: they legitimately share an endpoint.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
      if (segmentsIntersect(a1, a2, poly[j], poly[(j + 1) % n])) return false
    }
  }
  return true
}

/** Midpoint of the edge leaving vertex `i`. */
export const edgeMidpoint = (poly: Poly, i: number): Vec2 => {
  const a = poly[i]
  const b = poly[(i + 1) % poly.length]
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
}

/** Distance from `p` to the segment `ab`, zero when it lands on it. */
export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const ex = b.x - a.x
  const ez = b.z - a.z
  const len2 = ex * ex + ez * ez
  // A degenerate edge collapses to its start point.
  const t = len2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.z - a.z) * ez) / len2))
  return Math.hypot(p.x - (a.x + t * ex), p.z - (a.z + t * ez))
}

/**
 * Distance from `p` to the nearest point on the polygon's *boundary*. Always
 * positive, inside or out — a setback is measured to the line, and which side
 * of it you are on is `pointInPolygon`'s question, not this one's.
 */
export function distanceToBoundary(p: Vec2, poly: Poly): number {
  let best = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = pointSegmentDistance(p, poly[j], poly[i])
    if (d < best) best = d
  }
  return best
}

/**
 * Gap between two polygons that do not overlap, as the smallest vertex-to-edge
 * distance either way. Exact for convex input, which is all the site gives it:
 * the closest pair of disjoint convex shapes always involves a vertex.
 */
export function polygonGap(a: Poly, b: Poly): number {
  let best = Infinity
  for (const p of a) best = Math.min(best, distanceToBoundary(p, b))
  for (const p of b) best = Math.min(best, distanceToBoundary(p, a))
  return best
}
