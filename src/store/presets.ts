import type { Mass } from '../geometry/masses'
import { centre } from '../geometry/masses'
import type { Params, Preset } from './params'

const box = (
  id: string,
  x: number,
  z: number,
  length: number,
  depth: number,
  floors: number,
  baseFloor = 0,
): Mass => ({ id, origin: { x, z }, size: { length, depth }, rotation: 0, baseFloor, floors })

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
}

/** Which wing sliders a preset actually reads. */
export const PRESET_WINGS: Record<Preset, ('A' | 'B' | 'C')[]> = {
  bar: ['A'],
  L: ['A', 'B'],
  T: ['A', 'B'],
  U: ['A', 'B', 'C'],
  courtyard: ['A'],
  stacked: ['A'],
}

export function buildMasses(p: Params): Mass[] {
  const d = p.buildingDepth
  const { wingLengthA: a, wingLengthB: b, wingLengthC: c, floors: f } = p

  let masses: Mass[]

  switch (p.preset) {
    case 'bar':
      masses = [box('A', 0, 0, a, d, f)]
      break

    case 'L':
      masses = [box('A', 0, 0, a, d, f), box('B', 0, d, d, b, f)]
      break

    case 'T': {
      const cx = (a - d) / 2
      masses = [box('A', 0, 0, a, d, f), box('B', cx, d, d, b, f)]
      break
    }

    case 'U':
      masses = [
        box('A', 0, 0, a, d, f),
        box('B', 0, d, d, b, f),
        box('C', a - d, d, d, c, f),
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

  return centre(masses)
}
