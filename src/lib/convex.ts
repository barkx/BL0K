import { polygonArea, type Poly, type Vec2 } from './poly'

/**
 * Convex polygon algebra: intersection, difference, and inset.
 *
 * Three operations the app suddenly needed once a mass stopped being a
 * rectangle — union area for GFA, the roof as a footprint minus whatever
 * stands on it, and a setback as an edge pushed inward. All three reduce to one
 * primitive, clipping a convex polygon against a half-plane, which is why they
 * live together rather than in three files that would each grow their own
 * epsilon.
 *
 * Everything here assumes **convex** inputs, and every mass is convex: a
 * preset's rectangle, and a mitred bar, both are. The intersection of two
 * convex sets is convex, so the operations compose; a difference is not, which
 * is why `subtract` returns a list of convex pieces rather than one polygon.
 */

const EPS = 1e-9

/** Winding-independent area, so callers need not care which way a poly runs. */
export const area = (poly: Poly) => polygonArea(poly)

/**
 * Keep the part of `poly` on the inner side of a line.
 *
 * The line passes through `at` with outward `normal`; points where
 * `(p − at)·normal <= 0` are kept. Sutherland–Hodgman, which is exact for a
 * convex subject and is the whole engine underneath the rest of this file.
 */
export function clipHalfPlane(poly: Poly, at: Vec2, normal: Vec2): Poly {
  if (poly.length === 0) return poly
  const side = (p: Vec2) => (p.x - at.x) * normal.x + (p.z - at.z) * normal.z
  const out: Poly = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const da = side(a)
    const db = side(b)
    if (da <= EPS) out.push(a)
    // Crossing the line: add the point where the edge meets it.
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db)
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  }
  return out
}

/** Outward normals of a polygon's edges, whichever way it is wound. */
function edgeNormals(poly: Poly): { at: Vec2; normal: Vec2 }[] {
  // Shoelace sign tells the winding, and the winding decides which of the two
  // perpendiculars points out.
  let twice = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    twice += a.x * b.z - b.x * a.z
  }
  const sign = twice < 0 ? 1 : -1
  const out: { at: Vec2; normal: Vec2 }[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < EPS) continue
    out.push({ at: a, normal: { x: (-dz / len) * sign, z: (dx / len) * sign } })
  }
  return out
}

/** The overlap of two convex polygons, empty when they do not meet. */
export function intersect(a: Poly, b: Poly): Poly {
  let out = a
  for (const e of edgeNormals(b)) {
    out = clipHalfPlane(out, e.at, e.normal)
    if (out.length === 0) return []
  }
  return out
}

/**
 * `base` with `cut` taken out of it, as convex pieces.
 *
 * Walks `cut`'s edges: everything of `base` outside an edge is a finished
 * piece, and what remains inside carries on to the next edge. What survives
 * every edge is the overlap, and is dropped. Produces at most one piece per
 * edge of the cut, and no piece overlaps another.
 */
export function subtract(base: Poly, cut: Poly): Poly[] {
  const pieces: Poly[] = []
  let rest = base
  for (const e of edgeNormals(cut)) {
    if (rest.length === 0) break
    // Outside this edge: flip the half-plane by pushing the line the other way.
    const outside = clipHalfPlane(rest, e.at, { x: -e.normal.x, z: -e.normal.z })
    if (outside.length >= 3 && area(outside) > EPS) pieces.push(outside)
    rest = clipHalfPlane(rest, e.at, e.normal)
  }
  return pieces
}

/**
 * Total area covered by a set of convex polygons, counting overlap once.
 *
 * Inclusion–exclusion over subsets, which is exact because the intersection of
 * convex polygons is convex and so has an area this file can compute. It is
 * exponential in the number of polygons, so above `MAX_EXACT` — far more masses
 * than any building has on one level — it falls back to the plain sum. Masses
 * butt-joint rather than overlap, so on every real scheme the two agree anyway;
 * the correction only earns its keep when a drawn centreline crosses itself,
 * which the panel flags separately.
 */
const MAX_EXACT = 12

export function unionArea(polys: Poly[]): number {
  const solid = polys.filter((p) => p.length >= 3)
  if (solid.length === 0) return 0
  if (solid.length === 1) return area(solid[0])
  if (solid.length > MAX_EXACT) return solid.reduce((s, p) => s + area(p), 0)

  let total = 0
  for (let mask = 1; mask < 1 << solid.length; mask++) {
    let current: Poly | null = null
    let bits = 0
    for (let i = 0; i < solid.length; i++) {
      if (!(mask & (1 << i))) continue
      bits++
      current = current === null ? solid[i] : intersect(current, solid[i])
      if (current.length === 0) break
    }
    if (!current || current.length < 3) continue
    total += (bits % 2 === 1 ? 1 : -1) * area(current)
  }
  return total
}

/**
 * Push the chosen edges inward by `d`.
 *
 * Clipping rather than offsetting the outline: moving an edge of a convex
 * polygon inward is exactly intersecting with that edge's half-plane shifted
 * in, and clipping keeps the result convex and correct at the corners, where
 * naively moving points would not.
 */
export function insetEdges(poly: Poly, distanceOf: (index: number) => number): Poly {
  let out = poly
  const edges = edgeNormals(poly)
  for (let i = 0; i < edges.length; i++) {
    const d = distanceOf(i)
    if (!(d > 0)) continue
    const e = edges[i]
    out = clipHalfPlane(out, { x: e.at.x - e.normal.x * d, z: e.at.z - e.normal.z * d }, e.normal)
  }
  return out
}

/** Outward normals, exposed so callers can reason about which edge is which. */
export const normalsOf = (poly: Poly) => edgeNormals(poly).map((e) => e.normal)
