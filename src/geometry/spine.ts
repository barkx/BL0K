import { signedArea, type Poly, type Vec2 } from '../lib/poly'

/**
 * A drawn centreline turned into a run of butt-jointed bars.
 *
 * ## Why mitre rather than overlap
 *
 * The obvious way to thicken a polyline is a rectangle per segment. At a corner
 * the two rectangles overlap in a wedge, and that wedge is the problem: it
 * double-counts floor area, it puts two coplanar faces in the same place for
 * the depth sorter to fight over, and it turns a junction from "which interval
 * of this face is buried" into a two-dimensional question.
 *
 * Mitring cuts both bars on the bisector at each vertex instead. The bars then
 * meet on a single shared edge — exactly coplanar, facing opposite ways — which
 * is the same butt joint the presets have always used, and which keeps
 * `isFlush` and the 1D interval blanking working unchanged.
 *
 * The price is that a mitred bar is a trapezoid, not a rectangle. That is the
 * whole reason `Mass` carries a polygon.
 */

/** Below this the mitre is treated as a straight join rather than a corner. */
const COLLINEAR = 1e-6

/**
 * How far a mitre may run out from the centreline, as a multiple of half the
 * depth.
 *
 * A hairpin turn sends the true mitre point towards infinity — the two offset
 * lines become parallel. Rather than emit a spike a kilometre long, the corner
 * is pulled back to this limit. It leaves a small notch on the outside of a
 * very sharp turn, which is visible and finite, where the spike would be
 * neither.
 */
const MITRE_LIMIT = 4

const add = (p: Vec2, d: Vec2, k: number): Vec2 => ({ x: p.x + d.x * k, z: p.z + d.z * k })

interface Leg {
  /** Unit direction along the segment. */
  t: Vec2
  /** Unit normal, 90° from `t`. */
  n: Vec2
  length: number
}

function legs(spine: Poly): Leg[] {
  const out: Leg[] = []
  for (let i = 0; i < spine.length - 1; i++) {
    const dx = spine[i + 1].x - spine[i].x
    const dz = spine[i + 1].z - spine[i].z
    const length = Math.hypot(dx, dz)
    if (length < COLLINEAR) continue
    out.push({
      t: { x: dx / length, z: dz / length },
      n: { x: -dz / length, z: dx / length },
      length,
    })
  }
  return out
}

/**
 * Where one side of the ribbon passes a vertex.
 *
 * At an end it is simply the offset point. At a corner it is where the two
 * offset lines cross, which sits along the bisector of the two normals at
 * `h / cos(half the turn)` — the standard mitre, and the reason a tight turn
 * needs a limit.
 */
function sideAt(before: Leg | null, after: Leg | null, at: Vec2, h: number): Vec2 {
  if (!before) return add(at, after!.n, h)
  if (!after) return add(at, before.n, h)

  const bx = before.n.x + after.n.x
  const bz = before.n.z + after.n.z
  const len = Math.hypot(bx, bz)
  // Doubling straight back: there is no bisector to speak of.
  if (len < COLLINEAR) return add(at, before.n, h)

  const m = { x: bx / len, z: bz / len }
  const cos = m.x * before.n.x + m.z * before.n.z
  if (cos < 1 / MITRE_LIMIT) return add(at, m, h * MITRE_LIMIT)
  return add(at, m, h / cos)
}

/**
 * One quadrilateral per segment, wound the way `rectShape` winds a rectangle so
 * `facesOf` points every normal outward.
 *
 * Adjacent quads share their whole joining edge — the same two points, in
 * opposite order — which is what makes the junction test find them.
 */
export function mitredSegments(spine: Poly, depth: number): Poly[] {
  const l = legs(spine)
  if (l.length === 0 || depth <= 0) return []
  const h = depth / 2

  const side = (sign: 1 | -1): Vec2[] => {
    const pts: Vec2[] = []
    for (let v = 0; v <= l.length; v++) {
      pts.push(sideAt(v > 0 ? l[v - 1] : null, v < l.length ? l[v] : null, spine[v], sign * h))
    }
    return pts
  }

  const left = side(1)
  const right = side(-1)

  const out: Poly[] = []
  for (let i = 0; i < l.length; i++) {
    const quad: Poly = [left[i], left[i + 1], right[i + 1], right[i]]
    // `rectShape` winds negative; match it, or half the normals would point in.
    out.push(signedArea(quad) > 0 ? [...quad].reverse() : quad)
  }
  return out
}

/**
 * Does the ribbon cross itself?
 *
 * Checked on the centreline rather than the outlines: a spine that crosses
 * makes segments overlap in plan, which is the condition the whole mitred
 * arrangement exists to avoid, and the same thing the plot boundary already
 * flags rather than silently accepting.
 */
export function spineCrosses(spine: Poly): boolean {
  const n = spine.length
  for (let i = 0; i + 1 < n; i++) {
    for (let j = i + 2; j + 1 < n; j++) {
      if (segmentsCross(spine[i], spine[i + 1], spine[j], spine[j + 1])) return true
    }
  }
  return false
}

const cross = (o: Vec2, a: Vec2, b: Vec2) =>
  (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)

function segmentsCross(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))
}
