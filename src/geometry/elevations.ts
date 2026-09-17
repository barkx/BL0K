import { facesOf, type Face, type Mass } from './masses'
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
  /**
   * Exterior but unusable: where a core is pressed against this face. Filled
   * after the cores are built, by `blankForCores`. The facade skips modules
   * here and the wall builder fills the gap with solid wall, so a lift shaft
   * reads as blank masonry rather than as windows onto a lift.
   */
  blankByFloor: Span[][]
  /** Nothing exterior on any floor: hide it entirely. */
  abutting: boolean
  exteriorArea: number
}

const CARDINALS: { dir: Dir; x: number; z: number }[] = [
  { dir: 'N', x: 0, z: -1 },
  { dir: 'E', x: 1, z: 0 },
  { dir: 'S', x: 0, z: 1 },
  { dir: 'W', x: -1, z: 0 },
]

/**
 * The compass point a face most nearly looks towards.
 *
 * A polygon can have any number of faces, so `Dir` stops being an identity and
 * becomes a label — but it stays, because a per-elevation override, a balcony
 * seed and the face picker in the UI are all keyed on which way a wall faces,
 * and "roughly north" is still the useful thing to say about one.
 */
function dirOf(normal: { x: number; z: number }): Dir {
  let best = CARDINALS[0]
  let bestDot = -Infinity
  for (const c of CARDINALS) {
    const dot = normal.x * c.x + normal.z * c.z
    if (dot > bestDot) {
      bestDot = dot
      best = c
    }
  }
  return best.dir
}

/**
 * Faces in the order the four hand-written frames used to come out: N, E, S, W
 * for a rectangle, and edge order within a compass point for anything else.
 *
 * The order is worth preserving exactly. It decides the order of the elevations
 * array, which decides the order modules are generated in, which a determinism
 * check compares literally.
 */
function orderedFaces(m: Mass): { face: Face; dir: Dir }[] {
  const labelled = facesOf(m).map((face) => ({ face, dir: dirOf(face.normal) }))
  return labelled.sort(
    (a, b) =>
      CARDINALS.findIndex((c) => c.dir === a.dir) - CARDINALS.findIndex((c) => c.dir === b.dir) ||
      a.face.index - b.face.index,
  )
}

/**
 * Elevation keys, unique but unchanged wherever they can be.
 *
 * A rectangle has one face per compass point, so its keys stay `massId:N` and
 * every per-elevation override in a file written before masses could be angled
 * still finds its face. Only where two faces share a compass point does a key
 * gain an index, which cannot happen to a scheme that did not have one.
 */
function keysFor(m: Mass, faces: { face: Face; dir: Dir }[]): string[] {
  const seen = new Map<Dir, number>()
  const total = new Map<Dir, number>()
  for (const f of faces) total.set(f.dir, (total.get(f.dir) ?? 0) + 1)
  return faces.map((f) => {
    const n = seen.get(f.dir) ?? 0
    seen.set(f.dir, n + 1)
    return (total.get(f.dir) ?? 0) > 1 ? `${m.id}:${f.dir}${n + 1}` : `${m.id}:${f.dir}`
  })
}

/** (u, v) in the elevation frame to world, optionally pushed `out` along the normal. */
export function toWorld(e: Elevation, u: number, v: number, out = 0): [number, number, number] {
  return [
    e.origin.x + e.uDir.x * u + e.normal.x * out,
    v,
    e.origin.z + e.uDir.z * u + e.normal.z * out,
  ]
}

/** Where does another mass sit, measured along this face's u axis? */
function projectOnto(f: Face, m: Mass): Span {
  const along = (x: number, z: number) => (x - f.origin.x) * f.uDir.x + (z - f.origin.z) * f.uDir.z
  const p = m.shape.map((q) => along(q.x, q.z))
  return { a: Math.min(...p), b: Math.max(...p) }
}

/**
 * Is `other` pressed flat against this face — same plane, facing back at us?
 *
 * Asked of faces rather than of bounding boxes, which is what lets a mass sit
 * at any angle: two walls abut when one lies in the other's plane and looks the
 * opposite way, and that is true whatever compass point either of them is near.
 * For an axis-aligned pair it decides exactly what the four hand-written cases
 * decided, because a flush north face *is* a south face in the same plane.
 */
function isFlush(f: Face, other: Mass): boolean {
  for (const g of facesOf(other)) {
    // Facing back at us, within a hair — an exactly opposite pair dots to -1.
    if (f.normal.x * g.normal.x + f.normal.z * g.normal.z > -1 + 1e-6) continue
    // In our plane: the offset between the two origins has no component along
    // our normal.
    const off = (g.origin.x - f.origin.x) * f.normal.x + (g.origin.z - f.origin.z) * f.normal.z
    if (!same(off, 0)) continue
    const span = projectOnto(f, other)
    if (overlaps(span.a, span.b, 0, f.length)) return true
  }
  return false
}

const levelsOverlap = (a: Mass, b: Mass) =>
  Math.min(a.baseFloor + a.floors, b.baseFloor + b.floors) - Math.max(a.baseFloor, b.baseFloor) > 0

export function buildElevations(masses: Mass[], floorHeight: number): Elevation[] {
  const out: Elevation[] = []

  for (const m of masses) {
    const faces = orderedFaces(m)
    const keys = keysFor(m, faces)
    for (let fi = 0; fi < faces.length; fi++) {
      const { face: f, dir } = faces[fi]
      const blockers = masses.filter((o) => o.id !== m.id && isFlush(f, o) && levelsOverlap(m, o))

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
        key: keys[fi],
        massId: m.id,
        dir,
        origin: f.origin,
        uDir: f.uDir,
        normal: f.normal,
        length: f.length,
        baseFloor: m.baseFloor,
        floors: m.floors,
        openByFloor,
        blankByFloor: openByFloor.map(() => []),
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

/** Does a module's span touch a blanked stretch at all? Any overlap kills it. */
export function spanIsBlanked(blank: Span[], a: number, b: number): boolean {
  return blank.some((s) => Math.min(b, s.b) - Math.max(a, s.a) > EPS)
}
