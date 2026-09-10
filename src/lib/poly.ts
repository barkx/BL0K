/**
 * Plan-space polygon maths for the site layer.
 *
 * Buildings are generated axis-aligned in their own local frame and then placed
 * with a rotation and an offset, so the site has to reason about *rotated*
 * quads rather than the AABBs `lib/rect.ts` handles. Everything here works on
 * convex polygons in the XZ plane, wound either way.
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
