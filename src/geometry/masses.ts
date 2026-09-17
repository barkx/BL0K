import type { Rect } from '../lib/rect'
import type { Poly, Vec2 } from '../lib/poly'

/**
 * One extruded **convex polygon**. The building is a list of these — a single
 * box cannot express an L, a courtyard, or an offset stack.
 *
 * A polygon rather than a rectangle because a freely-angled plan cannot be made
 * of rectangles and still butt-joint: two bars meeting at anything but a right
 * angle have to be mitred, and a mitred bar is a trapezoid. Keeping them
 * rectangles would mean overlapping them instead, which is the one thing the
 * preset layout has always refused to do — overlap brings coincident coplanar
 * faces, z-fighting, and a junction problem that stops being one-dimensional.
 *
 * Every preset still emits a rectangle, as four points. Nothing about an
 * axis-aligned building changes by being described this way.
 *
 * Wound consistently and kept convex: `facesOf` reads the winding to point each
 * normal outward, and the junction test assumes an edge is a single straight
 * face rather than something that can double back.
 */
export interface Mass {
  id: string
  /** Plan outline in the building's own local frame. */
  shape: Poly
  baseFloor: number
  floors: number
}

/**
 * An axis-aligned rectangle as a mass outline.
 *
 * Wound to start at the north-east corner and run N, W, S, E, because that is
 * the cycle the four hand-written cardinal frames described before faces came
 * from edges: N ran from `x1` back to `x0`, W down the near side, and so on.
 * Reproducing it exactly is what lets every existing scheme come out unchanged
 * — `u` runs the same way along each face, so openings, overrides and balcony
 * patterns all land where they always did.
 */
export const rectShape = (x0: number, z0: number, x1: number, z1: number): Poly => [
  { x: x1, z: z0 },
  { x: x0, z: z0 },
  { x: x0, z: z1 },
  { x: x1, z: z1 },
]

/**
 * Plan bounding box.
 *
 * Still called `footprint` and still a `Rect`, because for an axis-aligned mass
 * it *is* the footprint, and every existing caller means exactly that. The
 * places that must see the real outline once masses can be angled take
 * `massShape` instead, and are migrated one at a time rather than all at once
 * behind a rename that would hide which is which.
 */
export function footprint(m: Mass): Rect {
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (const p of m.shape) {
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.z < z0) z0 = p.z
    if (p.z > z1) z1 = p.z
  }
  return { x0, x1, z0, z1 }
}

/** The outline itself, for anything that must not settle for the bounding box. */
export const massShape = (m: Mass): Poly => m.shape

/** True while every mass is an axis-aligned rectangle, which is the fast path. */
export function isAxisAligned(m: Mass): boolean {
  if (m.shape.length !== 4) return false
  for (let i = 0; i < 4; i++) {
    const a = m.shape[i]
    const b = m.shape[(i + 1) % 4]
    if (Math.abs(a.x - b.x) > 1e-9 && Math.abs(a.z - b.z) > 1e-9) return false
  }
  return true
}

export interface Face {
  origin: Vec2
  /** Unit direction along the face. */
  uDir: Vec2
  /** Outward unit normal. */
  normal: Vec2
  length: number
  /** Index of the edge this face came from. */
  index: number
}

/**
 * One face per edge of the outline.
 *
 * The frame is chosen so a quad wound (u0,v0) (u1,v0) (u1,v1) (u0,v1) faces
 * outward, which is the contract every facade builder already relies on. With
 * the outline wound as `rectShape` winds it, the outward normal of an edge
 * running `d` is `(-d.z, d.x)` — worked through rather than guessed, and
 * checked against the four cardinal frames the presets used to produce.
 */
export function facesOf(m: Mass): Face[] {
  const out: Face[] = []
  const n = m.shape.length
  for (let i = 0; i < n; i++) {
    const a = m.shape[i]
    const b = m.shape[(i + 1) % n]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz)
    if (length < 1e-9) continue
    out.push({
      origin: { x: a.x, z: a.z },
      uDir: { x: dx / length, z: dz / length },
      normal: { x: -dz / length, z: dx / length },
      length,
      index: i,
    })
  }
  return out
}

export const massBase = (m: Mass, floorHeight: number) => m.baseFloor * floorHeight
export const massTop = (m: Mass, floorHeight: number) => (m.baseFloor + m.floors) * floorHeight

/** Highest occupied level across the building, for camera framing and metrics. */
export const topLevel = (masses: Mass[]) =>
  masses.reduce((n, m) => Math.max(n, m.baseFloor + m.floors), 0)

/** Every level index that has at least one mass on it. */
export function levels(masses: Mass[]): number[] {
  const out: number[] = []
  for (let l = 0; l < topLevel(masses); l++) {
    if (masses.some((m) => l >= m.baseFloor && l < m.baseFloor + m.floors)) out.push(l)
  }
  return out
}

/** Outlines present on a given level, for anything that must not settle for a box. */
export const shapesAt = (masses: Mass[], level: number): Poly[] =>
  masses.filter((m) => level >= m.baseFloor && level < m.baseFloor + m.floors).map((m) => m.shape)

/** Footprints present on a given level. */
export const footprintsAt = (masses: Mass[], level: number): Rect[] =>
  masses.filter((m) => level >= m.baseFloor && level < m.baseFloor + m.floors).map(footprint)

/** Shift all masses so the plan bounding box is centred on the world origin. */
export function centre(masses: Mass[]): Mass[] {
  if (masses.length === 0) return masses
  const rs = masses.map(footprint)
  const cx = (Math.min(...rs.map((r) => r.x0)) + Math.max(...rs.map((r) => r.x1))) / 2
  const cz = (Math.min(...rs.map((r) => r.z0)) + Math.max(...rs.map((r) => r.z1))) / 2
  return masses.map((m) => ({
    ...m,
    shape: m.shape.map((p) => ({ x: p.x - cx, z: p.z - cz })),
  }))
}

export function planBounds(masses: Mass[]): Rect {
  const rs = masses.map(footprint)
  if (rs.length === 0) return { x0: 0, x1: 0, z0: 0, z1: 0 }
  return {
    x0: Math.min(...rs.map((r) => r.x0)),
    x1: Math.max(...rs.map((r) => r.x1)),
    z0: Math.min(...rs.map((r) => r.z0)),
    z1: Math.max(...rs.map((r) => r.z1)),
  }
}
