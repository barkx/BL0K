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

/**
 * A site plan or map screenshot laid on the ground to trace over.
 *
 * The image sits in the config as a data URL so a saved scheme travels whole.
 * Its ground size is one number — `width` in metres — with the height
 * following the pixel aspect, which is what calibration adjusts.
 */
export interface Underlay {
  src: string
  name: string
  /** Width on the ground in metres; height follows `aspect`. */
  width: number
  /** Pixel height over pixel width. */
  aspect: number
  position: Vec2
  /** Degrees about Y. */
  rotation: number
  opacity: number
  visible: boolean
  /** Locked images are inert, so they never steal a click while you trace. */
  locked: boolean
}

/**
 * Planning limits for the plot, checked the way clashes and off-plot are.
 *
 * These belong to the site, not to any one building: a setback is a property of
 * the boundary, and a plot ratio cap is meaningless per block. Zero means the
 * rule is off, which is how a fresh site opens — inventing limits nobody asked
 * for would put warnings on a scheme that has no breach.
 */
export interface SiteRules {
  /** Minimum distance from any building footprint to the plot boundary, m. */
  setback: number
  /** Minimum distance between two buildings, m. */
  separation: number
  /** Maximum building height, m, measured to the top of the parapet. */
  heightCap: number
  /** Maximum plot ratio — GFA over plot area. */
  farCap: number
  /** Maximum site coverage, as a fraction of plot area. */
  coverageCap: number
}

export const NO_RULES: SiteRules = {
  setback: 0,
  separation: 0,
  heightCap: 0,
  farCap: 0,
  coverageCap: 0,
}

/**
 * The single place site rules are made sane, mirroring what `resolveParams()`
 * does for a building. A negative setback or a cap above the caps' plausible
 * range is a typo, not a limit, so it is clamped rather than obeyed.
 */
export function resolveRules(raw: SiteRules): SiteRules {
  const positive = (v: number, max: number) =>
    Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0
  return {
    setback: positive(raw.setback, 100),
    separation: positive(raw.separation, 200),
    heightCap: positive(raw.heightCap, 300),
    farCap: positive(raw.farCap, 20),
    coverageCap: positive(raw.coverageCap, 1),
  }
}

export interface Site {
  /** Plot boundary as a plan polygon; drawn and edited on the ground. */
  plot: Poly
  buildings: Placement[]
  /** Optional image to trace over. */
  underlay: Underlay | null
  /** Planning limits. All zero — every rule off — until the user sets them. */
  rules: SiteRules
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

/** Ground width a freshly dropped image takes, before it is calibrated. */
export const DEFAULT_UNDERLAY_WIDTH = 120

export function defaultSite(): Site {
  return {
    plot: rectanglePoly(DEFAULT_PLOT_WIDTH, DEFAULT_PLOT_DEPTH),
    buildings: [makePlacement({ name: 'Building A' })],
    underlay: null,
    rules: { ...NO_RULES },
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
