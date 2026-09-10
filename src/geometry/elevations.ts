import { footprint, type Mass } from './masses'
import type { Dir } from '../store/params'
import { EPS, same } from '../lib/clamp'
import { overlaps, subtractSpans, type Span } from '../lib/rect'

export const DIRS: Dir[] = ['N', 'E', 'S', 'W']

/**
 * One face of one mass, in a local 2D frame: `u` runs along the elevation,
 * `v` runs up. Everything in the facade builder is authored in (u, v) and
 * pushed to world through `toWorld`, so no builder needs to know about axes.
 *
 * The frame is chosen so that a quad wound (u0,v0) (u1,v0) (u1,v1) (u0,v1)
 * faces outward — tangent = up x normal.
 */
export interface Elevation {
  key: string
  massId: string
  dir: Dir
  /** World XZ of the u = 0, v = 0 corner. */
  origin: { x: number; z: number }
  /** Unit direction of increasing u, in XZ. */
  uDir: { x: number; z: number }
  /** Outward normal, in XZ. */
  normal: { x: number; z: number }
  length: number
  baseFloor: number
  floors: number
  /**
   * Exterior spans, one entry per floor of this mass. A junction blanks only
   * the part of the face it actually covers — an L-shape keeps the rest of its
   * long elevation.
   */
  openByFloor: Span[][]
  /** Nothing exterior on any floor: hide it entirely. */
  abutting: boolean
  exteriorArea: number
}

interface Frame {
  origin: { x: number; z: number }
  uDir: { x: number; z: number }
  normal: { x: number; z: number }
  length: number
}

function frameFor(m: Mass, dir: Dir): Frame {
  const r = footprint(m)
  switch (dir) {
    case 'N':
      return { origin: { x: r.x1, z: r.z0 }, uDir: { x: -1, z: 0 }, normal: { x: 0, z: -1 }, length: r.x1 - r.x0 }
    case 'S':
      return { origin: { x: r.x0, z: r.z1 }, uDir: { x: 1, z: 0 }, normal: { x: 0, z: 1 }, length: r.x1 - r.x0 }
    case 'E':
      return { origin: { x: r.x1, z: r.z1 }, uDir: { x: 0, z: -1 }, normal: { x: 1, z: 0 }, length: r.z1 - r.z0 }
    case 'W':
      return { origin: { x: r.x0, z: r.z0 }, uDir: { x: 0, z: 1 }, normal: { x: -1, z: 0 }, length: r.z1 - r.z0 }
  }
}

/** (u, v) in the elevation frame to world, optionally pushed `out` along the normal. */
export function toWorld(e: Elevation, u: number, v: number, out = 0): [number, number, number] {
  return [
    e.origin.x + e.uDir.x * u + e.normal.x * out,
    v,
    e.origin.z + e.uDir.z * u + e.normal.z * out,
  ]
}

/** Where does another mass sit, measured along this elevation's u axis? */
function projectOnto(e: Frame, m: Mass): Span {
  const r = footprint(m)
  const along = (x: number, z: number) => (x - e.origin.x) * e.uDir.x + (z - e.origin.z) * e.uDir.z
  const p = [along(r.x0, r.z0), along(r.x1, r.z0), along(r.x0, r.z1), along(r.x1, r.z1)]
  return { a: Math.min(...p), b: Math.max(...p) }
}

/** Is `other` pressed flat against this face — same plane, facing back at us? */
function isFlush(m: Mass, dir: Dir, other: Mass): boolean {
  const r = footprint(m)
  const o = footprint(other)
  switch (dir) {
    case 'N':
      return same(o.z1, r.z0) && overlaps(o.x0, o.x1, r.x0, r.x1)
    case 'S':
      return same(o.z0, r.z1) && overlaps(o.x0, o.x1, r.x0, r.x1)
    case 'E':
      return same(o.x0, r.x1) && overlaps(o.z0, o.z1, r.z0, r.z1)
    case 'W':
      return same(o.x1, r.x0) && overlaps(o.z0, o.z1, r.z0, r.z1)
  }
}

const levelsOverlap = (a: Mass, b: Mass) =>
  Math.min(a.baseFloor + a.floors, b.baseFloor + b.floors) - Math.max(a.baseFloor, b.baseFloor) > 0

export function buildElevations(masses: Mass[], floorHeight: number): Elevation[] {
  const out: Elevation[] = []

  for (const m of masses) {
    for (const dir of DIRS) {
      const f = frameFor(m, dir)
      const blockers = masses.filter((o) => o.id !== m.id && isFlush(m, dir, o) && levelsOverlap(m, o))

      const openByFloor: Span[][] = []
      let exteriorArea = 0

      for (let i = 0; i < m.floors; i++) {
        const level = m.baseFloor + i
        const cuts = blockers
          .filter((o) => level >= o.baseFloor && level < o.baseFloor + o.floors)
          .map((o) => projectOnto(f, o))
        const open = subtractSpans({ a: 0, b: f.length }, cuts)
        openByFloor.push(open)
        exteriorArea += open.reduce((s, sp) => s + (sp.b - sp.a), 0) * floorHeight
      }

      out.push({
        key: `${m.id}:${dir}`,
        massId: m.id,
        dir,
        origin: f.origin,
        uDir: f.uDir,
        normal: f.normal,
        length: f.length,
        baseFloor: m.baseFloor,
        floors: m.floors,
        openByFloor,
        abutting: exteriorArea < EPS,
        exteriorArea,
      })
    }
  }

  return out
}

/** Is a module's span fully in the open on this floor? */
export function spanIsOpen(open: Span[], a: number, b: number): boolean {
  return open.some((s) => a > s.a - EPS && b < s.b + EPS)
}
