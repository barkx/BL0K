import type { BufferGeometry } from 'three'
import { MeshBuilder, horizontalQuad } from '../lib/mesh'
import { EPS } from '../lib/clamp'
import { rectArea, type Rect, type Span } from '../lib/rect'
import { facesOf, footprint, type Mass } from './masses'
import type { Elevation } from './elevations'
import type { Params } from '../store/params'

/**
 * A vertical core: stairs, lift and riser as one rectangular shaft.
 *
 * Massing only, and deliberately so. `project.md` §1 still lists floorplans,
 * corridors, stairs and lifts as non-goals — this is the shaft they would live
 * in, not the things themselves. What it buys is an NIA that shows its
 * working, and a facade that knows where its units cannot be.
 */
export interface Core {
  id: string
  /** Plan rectangle in the building's local frame. */
  rect: Rect
  /** Exclusive: the shaft passes through levels 0 to `topFloor - 1`. */
  topFloor: number
  /** How far the shaft rises above the roof slab, metres. */
  overrun: number
  /** Where it sits on the track, 0 to 1. This is what a drag edits. */
  t: number
  /** Its own buffer, because a core is a thing you can pick and drag. */
  geometry: BufferGeometry
}

/**
 * A straight run the cores slide along. In `perimeter` mode this follows the
 * wall line of an exterior face; in `centre` mode, the spine of a wing.
 *
 * Deliberately independent of core size: the track belongs to the building, so
 * a shaft does not slide sideways when you widen it, and a drag has something
 * stable to resolve against.
 */
export interface TrackSegment {
  /** Elevation this run follows. Null on a centre track. */
  elevKey: string | null
  from: { x: number; z: number }
  to: { x: number; z: number }
  /** Unit vector pointing into the building. Zero on a centre track. */
  inward: { x: number; z: number }
  length: number
  /** Distance along the whole track before this segment starts. */
  start: number
}

export interface BuiltCores {
  cores: Core[]
  track: TrackSegment[]
  trackLength: number
  /** Floor area the cores occupy, summed over every level they pass through. */
  area: number
  /** Plan size actually built, once fitted. Null when there are none. */
  fit: { width: number; depth: number } | null
  triangles: number
}

export const NO_CORES: BuiltCores = {
  cores: [],
  track: [],
  trackLength: 0,
  area: 0,
  fit: null,
  triangles: 0,
}

/** Never let a fitted core collapse to nothing; below this it is not a core. */
const MIN_SIDE = 1.5

// ---------------------------------------------------------------------------
// The track
// ---------------------------------------------------------------------------

const segment = (
  elevKey: string | null,
  from: { x: number; z: number },
  to: { x: number; z: number },
  inward: { x: number; z: number },
  start: number,
): TrackSegment => ({
  elevKey,
  from,
  to,
  inward,
  length: Math.hypot(to.x - from.x, to.z - from.z),
  start,
})

/**
 * The exterior wall lines at ground level, junction-blanked stretches removed.
 *
 * `openByFloor[0]` has already done the hard part: it is exactly the run of a
 * face that is outside rather than buried in another wing. Reusing it means a
 * core can never be dragged onto a face that does not exist.
 */
function perimeterTrack(elevations: Elevation[], ground: Set<string>): TrackSegment[] {
  const out: TrackSegment[] = []
  let start = 0
  for (const e of elevations) {
    if (e.abutting || e.baseFloor !== 0 || !ground.has(e.massId)) continue
    for (const span of e.openByFloor[0] ?? []) {
      const at = (u: number) => ({
        x: e.origin.x + e.uDir.x * u,
        z: e.origin.z + e.uDir.z * u,
      })
      const s = segment(e.key, at(span.a), at(span.b), { x: -e.normal.x, z: -e.normal.z }, start)
      if (s.length <= MIN_SIDE) continue
      out.push(s)
      start += s.length
    }
  }
  return out
}

/**
 * The spine of a wing: the line along its longest face, through its middle,
 * trimmed to the outline.
 *
 * Reading the direction off the longest face rather than off a bounding box is
 * what carries this to a mitred wing, whose box says nothing useful about which
 * way it runs. On a rectangle the longest face is the long side, so this is the
 * same line the old longer-axis test produced.
 */
function spineOf(m: Mass): { from: { x: number; z: number }; to: { x: number; z: number } } | null {
  const faces = facesOf(m)
  if (faces.length === 0) return null
  const longest = faces.reduce((best, f) => (f.length > best.length ? f : best), faces[0])
  const dir = longest.uDir
  const centre = {
    x: m.shape.reduce((s, q) => s + q.x, 0) / m.shape.length,
    z: m.shape.reduce((s, q) => s + q.z, 0) / m.shape.length,
  }

  // How far the line may run each way before it leaves the outline.
  let lo = -Infinity
  let hi = Infinity
  for (const f of faces) {
    const denom = dir.x * f.normal.x + dir.z * f.normal.z
    const away = (centre.x - f.origin.x) * f.normal.x + (centre.z - f.origin.z) * f.normal.z
    if (Math.abs(denom) < 1e-9) {
      if (away > 1e-9) return null
      continue
    }
    const t = -away / denom
    if (denom > 0) hi = Math.min(hi, t)
    else lo = Math.max(lo, t)
  }
  if (!(hi > lo)) return null
  return {
    from: { x: centre.x + dir.x * lo, z: centre.z + dir.z * lo },
    to: { x: centre.x + dir.x * hi, z: centre.z + dir.z * hi },
  }
}

/** The spine of each ground-level wing. */
function centreTrack(ground: Mass[]): TrackSegment[] {
  const out: TrackSegment[] = []
  let start = 0
  for (const m of ground) {
    const line = spineOf(m)
    if (!line) continue
    const s = segment(null, line.from, line.to, { x: 0, z: 0 }, start)
    if (s.length <= MIN_SIDE) continue
    out.push(s)
    start += s.length
  }
  return out
}

export function buildTrack(masses: Mass[], elevations: Elevation[], p: Params): TrackSegment[] {
  const ground = masses.filter((m) => m.baseFloor === 0)
  return p.corePlacement === 'perimeter'
    ? perimeterTrack(elevations, new Set(ground.map((m) => m.id)))
    : centreTrack(ground)
}

export const trackLength = (track: TrackSegment[]) =>
  track.length === 0 ? 0 : track[track.length - 1].start + track[track.length - 1].length

/**
 * Nearest point on the track to a plan point, as a 0 to 1 position.
 *
 * This is what a drag resolves to: the cursor is projected onto the ground and
 * then onto the track, so the shaft follows the wall it is on rather than the
 * cursor, and a drag that wanders off the building still lands somewhere real.
 */
export function nearestOnTrack(track: TrackSegment[], point: { x: number; z: number }): number {
  const total = trackLength(track)
  if (total <= 0) return 0

  let best = Infinity
  let bestAt = 0
  for (const s of track) {
    const ex = s.to.x - s.from.x
    const ez = s.to.z - s.from.z
    const len2 = ex * ex + ez * ez
    if (len2 < EPS) continue
    const u = Math.max(
      0,
      Math.min(1, ((point.x - s.from.x) * ex + (point.z - s.from.z) * ez) / len2),
    )
    const d = Math.hypot(point.x - (s.from.x + u * ex), point.z - (s.from.z + u * ez))
    if (d < best) {
      best = d
      bestAt = s.start + u * s.length
    }
  }
  return bestAt / total
}

// ---------------------------------------------------------------------------
// Placing the cores
// ---------------------------------------------------------------------------

/**
 * Default positions: share the cores between runs by length, then space each
 * run's share evenly within it.
 *
 * The obvious rule — cut the whole track into equal parts — puts a single core
 * on an L hard against a gable end, because the runs are not laid end to end in
 * plan. Sharing per run gives the answer you would draw: one core mid-run on
 * the longest run, two one per wing, four one per side of a courtyard.
 */
export function autoOffsets(track: TrackSegment[], count: number): number[] {
  const total = trackLength(track)
  if (count < 1 || total <= 0) return []

  const exact = track.map((s) => (count * s.length) / total)
  const quota = exact.map((v) => Math.floor(v))
  let left = count - quota.reduce((a, b) => a + b, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    // Ties go to the longer run, then to document order, so the same building
    // always produces the same cores.
    .sort((a, b) => b.frac - a.frac || track[b.i].length - track[a.i].length || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    quota[i]++
    left--
  }

  const out: number[] = []
  for (let i = 0; i < track.length; i++) {
    for (let j = 0; j < quota[i]; j++) {
      out.push((track[i].start + ((j + 0.5) / quota[i]) * track[i].length) / total)
    }
  }
  return out.sort((a, b) => a - b)
}

/** Which run does this position fall on, and how far along it? */
function locate(track: TrackSegment[], t: number) {
  const total = trackLength(track)
  const d = Math.max(0, Math.min(total, t * total))
  let index = 0
  while (index < track.length - 1 && d > track[index].start + track[index].length) index++
  return { seg: track[index], along: d - track[index].start }
}

/**
 * How high this shaft goes: the top of the tallest mass that actually covers
 * it. A core under a stacked block's setback should stop where the building
 * stops above it, not punch through thin air at the full height.
 */
function topOver(rect: Rect, masses: Mass[]): number {
  let top = 0
  for (const m of masses) {
    const r = footprint(m)
    const covers =
      r.x0 <= rect.x0 + 1e-4 &&
      r.x1 >= rect.x1 - 1e-4 &&
      r.z0 <= rect.z0 + 1e-4 &&
      r.z1 >= rect.z1 - 1e-4
    if (covers) top = Math.max(top, m.baseFloor + m.floors)
  }
  return top
}

/** Clear depth of the ground-level wing behind a run, across its direction. */
function wingAcross(masses: Mass[], seg: TrackSegment, alongX: boolean): number {
  const mid = { x: (seg.from.x + seg.to.x) / 2, z: (seg.from.z + seg.to.z) / 2 }
  // Step just inside the wall so a perimeter probe lands in its own mass.
  const probe = { x: mid.x + seg.inward.x * 0.05, z: mid.z + seg.inward.z * 0.05 }
  let best = 0
  for (const m of masses) {
    if (m.baseFloor !== 0) continue
    const r = footprint(m)
    if (probe.x < r.x0 - 1e-6 || probe.x > r.x1 + 1e-6) continue
    if (probe.z < r.z0 - 1e-6 || probe.z > r.z1 + 1e-6) continue
    best = Math.max(best, alongX ? r.z1 - r.z0 : r.x1 - r.x0)
  }
  return best
}

function shaftGeometry(rect: Rect, topFloor: number, p: Params): BufferGeometry {
  const { x0, x1, z0, z1 } = rect
  const top = topFloor * p.floorHeight + p.coreOverrun
  const b = new MeshBuilder(6)
  b.quad([x0, 0, z0], [x1, 0, z0], [x1, top, z0], [x0, top, z0], [0, 0, -1])
  b.quad([x1, 0, z1], [x0, 0, z1], [x0, top, z1], [x1, top, z1], [0, 0, 1])
  b.quad([x0, 0, z1], [x0, 0, z0], [x0, top, z0], [x0, top, z1], [-1, 0, 0])
  b.quad([x1, 0, z0], [x1, 0, z1], [x1, top, z1], [x1, top, z0], [1, 0, 0])
  horizontalQuad(b, x0, x1, z0, z1, top, true)
  return b.toGeometry()
}

export function buildCores(masses: Mass[], elevations: Elevation[], p: Params): BuiltCores {
  const track = buildTrack(masses, elevations, p)
  const total = trackLength(track)
  if (p.coreCount < 1 || total <= 0) return { ...NO_CORES, track, trackLength: total }

  const auto = autoOffsets(track, p.coreCount)
  const perimeter = p.corePlacement === 'perimeter'
  const cores: Core[] = []
  let area = 0
  let width = 0
  let depth = 0
  let triangles = 0

  for (let i = 0; i < p.coreCount; i++) {
    const asked = p.coreOffsets[i]
    const t = asked === null || asked === undefined ? auto[i] ?? 0.5 : asked
    const { seg, along } = locate(track, t)
    const alongX = Math.abs(seg.to.x - seg.from.x) > Math.abs(seg.to.z - seg.from.z)

    // The asked-for size may not fit a short run or a shallow wing. Shrink
    // rather than overhang, and report what was built — the same bargain the
    // facade module makes when it snaps to divide an elevation evenly. A
    // perimeter core may use the full depth; a centre one needs wall both sides.
    const across = wingAcross(masses, seg, alongX)
    const cw = Math.min(p.coreWidth, seg.length - 0.5)
    const cd = Math.min(p.coreDepth, across - (perimeter ? 0.5 : 1))
    if (cw < MIN_SIDE || cd < MIN_SIDE) continue
    width = width === 0 ? cw : Math.min(width, cw)
    depth = depth === 0 ? cd : Math.min(depth, cd)

    // Keep the shaft wholly on its run even when its share lands near an end.
    const u = Math.min(Math.max(along, cw / 2), seg.length - cw / 2)
    const cx = seg.from.x + ((seg.to.x - seg.from.x) / seg.length) * u + seg.inward.x * (cd / 2)
    const cz = seg.from.z + ((seg.to.z - seg.from.z) / seg.length) * u + seg.inward.z * (cd / 2)

    const halfX = alongX ? cw / 2 : cd / 2
    const halfZ = alongX ? cd / 2 : cw / 2
    const rect: Rect = { x0: cx - halfX, x1: cx + halfX, z0: cz - halfZ, z1: cz + halfZ }

    const topFloor = topOver(rect, masses)
    if (topFloor < 1) continue

    const geometry = shaftGeometry(rect, topFloor, p)
    triangles += geometry.getAttribute('position').count / 3
    cores.push({
      id: `core${cores.length + 1}`,
      rect,
      topFloor,
      overrun: p.coreOverrun,
      t,
      geometry,
    })
    area += rectArea(rect) * topFloor
  }

  return {
    cores,
    track,
    trackLength: total,
    area,
    fit: cores.length > 0 ? { width, depth } : null,
    triangles,
  }
}

export function disposeCores(built: BuiltCores | null) {
  if (!built) return
  for (const c of built.cores) c.geometry.dispose()
}

// ---------------------------------------------------------------------------
// Telling the facade where it cannot go
// ---------------------------------------------------------------------------

/**
 * Blank the stretch of every elevation a core is pressed against.
 *
 * Purely geometric: a core counts against a face when its rectangle reaches
 * that face's plane, so a perimeter core blanks and a centre one does not,
 * with neither mode special-cased. The facade then skips those modules, and
 * `buildWalls` fills whatever no module covers with solid wall — the same path
 * a junction sliver already takes. There is no window on a lift shaft, and now
 * no unit counted behind one either.
 */
export function blankForCores(elevations: Elevation[], cores: Core[]): Elevation[] {
  if (cores.length === 0) return elevations

  return elevations.map((e) => {
    if (e.abutting) return e
    const alongX = Math.abs(e.uDir.x) > 0.5
    // Where this face's plane sits on the across axis, and which way is out.
    const plane = alongX ? e.origin.z : e.origin.x
    const outward = alongX ? e.normal.z : e.normal.x
    const along = (x: number, z: number) =>
      (x - e.origin.x) * e.uDir.x + (z - e.origin.z) * e.uDir.z

    const hits: Span[] = []
    let top = 0
    for (const c of cores) {
      const near = alongX
        ? outward > 0
          ? c.rect.z1
          : c.rect.z0
        : outward > 0
          ? c.rect.x1
          : c.rect.x0
      if (Math.abs(near - plane) > 0.01) continue

      const u0 = along(c.rect.x0, c.rect.z0)
      const u1 = along(c.rect.x1, c.rect.z1)
      const span = { a: Math.min(u0, u1), b: Math.max(u0, u1) }
      if (span.b <= 0 || span.a >= e.length) continue
      hits.push(span)
      top = Math.max(top, c.topFloor)
    }
    if (hits.length === 0) return e

    return { ...e, blankByFloor: e.openByFloor.map((_, i) => (e.baseFloor + i < top ? hits : [])) }
  })
}
