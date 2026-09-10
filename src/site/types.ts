import { DEFAULTS, resolveParams, type Params } from '../store/params'
import { rectanglePoly, type Poly, type Vec2 } from '../lib/poly'

/**
 * One building placed on the site.
 *
 * `buildBuilding()` generates in the building's own local frame, centred on its
 * plan bounding box, and every geometry builder relies on masses being
 * axis-aligned there. So placement lives *here* — a rotation and an offset
 * applied at the scene level — and the whole building pipeline stays untouched.
 *
 * `raw` is what the sliders hold, `params` what the geometry was built from.
 */
export interface Placement {
  id: string
  name: string
  /** Where the building's local origin sits, in site metres. */
  position: Vec2
  /** Rotation about Y, in degrees. Free, not snapped to 90. */
  rotation: number
  raw: Params
  params: Params
}

export interface Site {
  /** Plot boundary as a plan polygon. A rectangle until M9 lets you draw one. */
  plot: Poly
  buildings: Placement[]
}

// Big enough to hold the default L-shape (40 x 53 m) with room to place a
// second block, so the app does not open showing an off-plot warning.
export const DEFAULT_PLOT_WIDTH = 110
export const DEFAULT_PLOT_DEPTH = 90

let counter = 0
/** Ids only need to be unique within a session; configs carry their own. */
export const nextId = () => `b${++counter}`

export function makePlacement(patch: Partial<Placement> = {}): Placement {
  const raw = patch.raw ?? { ...DEFAULTS }
  return {
    id: patch.id ?? nextId(),
    name: patch.name ?? 'Building',
    position: patch.position ?? { x: 0, z: 0 },
    rotation: patch.rotation ?? 0,
    raw,
    params: patch.params ?? resolveParams(raw),
  }
}

export function defaultSite(): Site {
  return {
    plot: rectanglePoly(DEFAULT_PLOT_WIDTH, DEFAULT_PLOT_DEPTH),
    buildings: [makePlacement({ name: 'Building A' })],
  }
}

/** Next free letter for a new building, so names stay readable. */
export function suggestName(existing: Placement[]): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const letter of letters) {
    const name = `Building ${letter}`
    if (!existing.some((b) => b.name === name)) return name
  }
  return `Building ${existing.length + 1}`
}
