import type { Mass } from '../geometry/masses'
import type { Poly } from '../lib/poly'
import { centre, facesOf, rectShape, topLevel } from '../geometry/masses'
import { overlaps } from '../lib/rect'
import { insetEdges, normalsOf } from '../lib/convex'
import { mitredSegments } from '../geometry/spine'
import { wingDepths, type Params, type Preset } from './params'

const box = (
  id: string,
  x: number,
  z: number,
  length: number,
  depth: number,
  floors: number,
  baseFloor = 0,
): Mass => ({ id, shape: rectShape(x, z, x + length, z + depth), baseFloor, floors })

/**
 * Presets are butt-jointed rather than overlapping in plan: wings meet at a
 * shared face instead of interpenetrating. That kills coincident coplanar
 * faces (and the z-fighting they cause) at source, and leaves junctions as a
 * clean 1D interval problem on the shared elevation. Masses at *different*
 * levels may still overlap in plan — that is what `stacked` is for — so
 * metrics still take a per-level union.
 */
export const PRESET_LABELS: Record<Preset, string> = {
  bar: 'Bar',
  L: 'L-shape',
  T: 'T-shape',
  U: 'U-shape',
  courtyard: 'Courtyard',
  stacked: 'Stacked',
  freeform: 'Freeform',
}

/** Which wing sliders a preset actually reads. */
export const PRESET_WINGS: Record<Preset, ('A' | 'B' | 'C')[]> = {
  bar: ['A'],
  L: ['A', 'B'],
  T: ['A', 'B'],
  U: ['A', 'B', 'C'],
  courtyard: ['A'],
  stacked: ['A'],
  // Freeform has no wings to size, but its depth is wing A's, so the depth
  // slider and every clamp keyed on the shallowest wing still find a number.
  freeform: ['A'],
}

/** Plan dimension a set-back mass must keep. Below this it is a ledge, not a floor. */
const SETBACK_MIN_PLAN = 4

const FLUSH = 1e-6

/**
 * Which of a mass's faces have nothing butted against them.
 *
 * The whole layout is butt-jointed — wings meet at a shared face rather than
 * interpenetrating — and that is what keeps a junction a clean 1D interval on
 * one elevation. Insetting a shared face would pull the two wings apart and
 * open a gap down the joint, so a setback only ever moves the faces that look
 * outward.
 *
 * Asked of the faces rather than of a bounding box, which is the same question
 * `isFlush` asks in `elevations.ts` and for the same reason: two walls abut when
 * one lies in the other's plane looking back, whatever angle either sits at.
 */
function freeEdges(m: Mass, others: Mass[]): boolean[] {
  return facesOf(m).map((f) => {
    for (const o of others) {
      for (const g of facesOf(o)) {
        if (f.normal.x * g.normal.x + f.normal.z * g.normal.z > -1 + FLUSH) continue
        const off = (g.origin.x - f.origin.x) * f.normal.x + (g.origin.z - f.origin.z) * f.normal.z
        if (Math.abs(off) > FLUSH) continue
        const along = (x: number, z: number) =>
          (x - f.origin.x) * f.uDir.x + (z - f.origin.z) * f.uDir.z
        const ps = o.shape.map((q) => along(q.x, q.z))
        if (overlaps(Math.min(...ps), Math.max(...ps), 0, f.length)) return false
      }
    }
    return true
  })
}

/**
 * Step the top floors in from the building's free faces.
 *
 * Every mass that reaches the top of the building is split in two: the bulk
 * keeps its own id and loses its top `n` levels, and a new mass takes those
 * levels at an inset footprint. Nothing else is invented — a mass at a higher
 * `baseFloor` with a smaller rectangle is exactly what `stacked` already
 * builds, so the elevations, the roof, the metrics and the exports all handle
 * it without being told about setbacks at all. `buildRoof` in particular gives
 * the floor below a terrace and a parapet for free, because a mass's roof is
 * already its footprint minus whatever stands on it.
 *
 * The bulk keeps the original id on purpose: a core is assigned to a mass, and
 * an IFC element's identity is derived from one, so the part of the building
 * that did not move should not look like a different building to anything
 * downstream.
 */
function applyTopSetback(masses: Mass[], p: Params): Mass[] {
  const s = p.topSetback
  const n = Math.round(p.topSetbackFloors)
  if (s <= 1e-6 || n <= 0) return masses

  const top = topLevel(masses)
  const reaching = masses.filter((m) => m.baseFloor + m.floors === top)

  const out: Mass[] = []
  for (const m of masses) {
    if (m.baseFloor + m.floors !== top) {
      out.push(m)
      continue
    }
    const free = freeEdges(m, reaching.filter((o) => o.id !== m.id))

    // A setback that would leave a wing too narrow to stand on is reduced
    // rather than refused, so dragging the slider degrades instead of snapping
    // back at a threshold nobody can see.
    //
    // Reduced **per direction**, not overall: a long wing that is narrow still
    // steps its ends in the full amount while its sides give way. Opposite
    // faces share the room between them, which is why a 9 m wing set back 4 m
    // moves each side 2.5 m and keeps 4 m of floor.
    const amounts = insetAmounts(m.shape, free, s)
    const shape = insetEdges(m.shape, (e) => amounts[e])

    // Never cascade into the mass below: a setback deeper than the top mass is
    // tall simply takes the whole of it.
    const upper = Math.min(n, m.floors)
    const lower = m.floors - upper
    if (lower > 0) out.push({ ...m, floors: lower })
    out.push({
      id: lower > 0 ? `${m.id}-top` : m.id,
      shape: shape.length >= 3 ? shape : m.shape,
      baseFloor: m.baseFloor + lower,
      floors: upper,
    })
  }
  return out
}

/**
 * How far each free edge may actually move in.
 *
 * Edges that push along the same line compete for the same room, so they are
 * sized together: the width across that direction, less what a floor needs,
 * shared between however many free edges are pulling on it. An edge with room
 * to spare takes the full setback regardless of what a tighter direction had
 * to settle for.
 */
function insetAmounts(shape: Poly, free: boolean[], s: number): number[] {
  const normals = normalsOf(shape)
  return normals.map((n, i) => {
    if (!free[i]) return 0
    const peers = normals.filter(
      (o, j) => free[j] && Math.abs(o.x * n.x + o.z * n.z) > 1 - FLUSH,
    ).length
    let lo = Infinity
    let hi = -Infinity
    for (const q of shape) {
      const t = q.x * n.x + q.z * n.z
      lo = Math.min(lo, t)
      hi = Math.max(hi, t)
    }
    const room = Math.max(0, hi - lo - SETBACK_MIN_PLAN)
    const demand = peers * s
    return demand > room ? (s * room) / demand : s
  })
}

export function buildMasses(p: Params): Mass[] {
  // Wing A's depth is also every other wing's, until one is given its own. The
  // presets that expose only wing A — courtyard and stacked — therefore read
  // `d` throughout and behave exactly as they always did.
  const { A: d, B: dB, C: dC } = wingDepths(p)
  const { wingLengthA: a, wingLengthB: b, wingLengthC: c, floors: f } = p

  let masses: Mass[]

  switch (p.preset) {
    case 'bar':
      masses = [box('A', 0, 0, a, d, f)]
      break

    case 'L':
      masses = [box('A', 0, 0, a, d, f), box('B', 0, d, dB, b, f)]
      break

    case 'T': {
      const cx = (a - dB) / 2
      masses = [box('A', 0, 0, a, d, f), box('B', cx, d, dB, b, f)]
      break
    }

    case 'U':
      masses = [
        box('A', 0, 0, a, d, f),
        box('B', 0, d, dB, b, f),
        box('C', a - dC, d, dC, c, f),
      ]
      break

    case 'courtyard': {
      const cw = p.courtyardWidth
      masses = [
        box('N', 0, 0, a, d, f),
        box('S', 0, d + cw, a, d, f),
        box('W', 0, d, d, cw, f),
        box('E', a - d, d, d, cw, f),
      ]
      break
    }

    case 'freeform': {
      const quads = mitredSegments(p.spine, d)
      // Nothing drawn yet is not an error, it is a building nobody has shaped:
      // fall back to a plain bar so the viewport has something to show and the
      // depth slider still means something.
      masses =
        quads.length > 0
          ? quads.map((shape, i) => ({ id: `S${i}`, shape, baseFloor: 0, floors: f }))
          : [box('A', 0, 0, a, d, f)]
      break
    }

    case 'stacked': {
      const lower = Math.max(1, Math.round(f * 0.4))
      const middle = Math.max(1, Math.round(f * 0.35))
      const upper = Math.max(1, f - lower - middle)
      const o = p.massOffset
      masses = [
        box('A', 0, 0, a, d, lower, 0),
        box('B', o, 0, Math.max(12, a * 0.75), d, middle, lower),
        box('C', o * 2, 0, Math.max(12, a * 0.5), d, upper, lower + middle),
      ]
      break
    }
  }

  return centre(applyTopSetback(masses, p))
}
