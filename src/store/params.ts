import { clamp } from '../lib/clamp'

export type Preset = 'bar' | 'L' | 'T' | 'U' | 'courtyard' | 'stacked'
export type Dir = 'N' | 'E' | 'S' | 'W'
export type BalconyType = 'none' | 'projecting' | 'loggia' | 'mixed'
export type BalconyPattern = 'every' | 'alternate' | 'checkerboard' | 'random'
export type BalustradeKind = 'glass' | 'solid' | 'bars'
export type RenderMode = 'white' | 'pbr' | 'diagram'
export type CorePlacement = 'perimeter' | 'centre'

/** Per-elevation escape hatch, keyed `${massId}:${dir}`. */
export interface FacadeOverride {
  balconyType?: BalconyType
  balconyPattern?: BalconyPattern
  windowsPerModule?: number
}

export interface Params {
  // massing
  preset: Preset
  floors: number
  floorHeight: number
  buildingDepth: number
  wingLengthA: number
  wingLengthB: number
  wingLengthC: number
  courtyardWidth: number
  massOffset: number
  roofParapet: number

  // facade
  moduleWidth: number
  windowsPerModule: number
  windowWidth: number
  windowHeight: number
  sillHeight: number
  reveal: number

  // balconies
  balconyType: BalconyType
  balconyDepth: number
  balconyWidthRatio: number
  balconyPattern: BalconyPattern
  balconyStartFloor: number
  balustrade: BalustradeKind
  randomSeed: number

  // core
  coreCount: number
  /** Which track the shafts sit on: against an exterior face, or on the spine. */
  corePlacement: CorePlacement
  /**
   * Position of each core along that track, 0 to 1. `null` means "wherever the
   * even spread puts it" — a dragged core takes a number, and everything else
   * stays automatic. One entry per core.
   */
  coreOffsets: (number | null)[]
  coreWidth: number
  coreDepth: number
  coreOverrun: number

  // metrics inputs
  modulesPerUnit: number
  /** Net internal area as a share of GFA *after* the cores are taken out. */
  efficiency: number

  overrides: Record<string, FacadeOverride>
}

export const DEFAULTS: Params = {
  preset: 'L',
  floors: 8,
  floorHeight: 3.0,
  buildingDepth: 13,
  wingLengthA: 40,
  wingLengthB: 40,
  wingLengthC: 40,
  courtyardWidth: 25,
  massOffset: 0,
  roofParapet: 0.9,

  moduleWidth: 6.0,
  windowsPerModule: 2,
  windowWidth: 1.6,
  windowHeight: 2.1,
  // 0.9 m of sill under a 2.1 m window fills a 3.0 m floor exactly, leaving
  // nothing for the slab and head. 0.65 m keeps the spec's window and floor
  // heights and still clears HEAD_MIN.
  sillHeight: 0.65,
  reveal: 0.1,

  balconyType: 'projecting',
  balconyDepth: 1.8,
  balconyWidthRatio: 0.8,
  balconyPattern: 'every',
  balconyStartFloor: 1,
  balustrade: 'glass',
  randomSeed: 1,

  coreCount: 1,
  corePlacement: 'perimeter',
  coreOffsets: [null],
  coreWidth: 6.5,
  coreDepth: 6.5,
  // A lift overrun clears the parapet, which is the only reason a core is
  // visible at all on a massing model.
  coreOverrun: 1.6,

  modulesPerUnit: 1,
  // What is left after the core is already deducted: internal walls, risers
  // and plant. Still a factor, not a measurement.
  efficiency: 0.9,

  overrides: {},
}

export interface Range {
  min: number
  max: number
  step: number
  label: string
  unit?: string
  hint?: string
}

const RANGES = {
  floors: { min: 2, max: 30, step: 1, label: 'Floors' },
  floorHeight: { min: 2.6, max: 4.0, step: 0.05, label: 'Floor height', unit: 'm', hint: 'Floor to floor' },
  buildingDepth: { min: 9, max: 24, step: 0.5, label: 'Wing depth', unit: 'm' },
  wingLengthA: { min: 12, max: 90, step: 0.5, label: 'Wing A', unit: 'm' },
  wingLengthB: { min: 12, max: 90, step: 0.5, label: 'Wing B', unit: 'm' },
  wingLengthC: { min: 12, max: 90, step: 0.5, label: 'Wing C', unit: 'm' },
  courtyardWidth: { min: 12, max: 60, step: 0.5, label: 'Courtyard width', unit: 'm' },
  massOffset: { min: 0, max: 20, step: 0.5, label: 'Mass offset', unit: 'm' },
  roofParapet: { min: 0, max: 1.5, step: 0.05, label: 'Parapet', unit: 'm' },

  moduleWidth: { min: 3.0, max: 9.0, step: 0.1, label: 'Module width', unit: 'm', hint: 'One apartment module' },
  windowsPerModule: { min: 1, max: 3, step: 1, label: 'Windows per module' },
  windowWidth: { min: 0.6, max: 3.5, step: 0.05, label: 'Window width', unit: 'm' },
  windowHeight: { min: 1.2, max: 2.8, step: 0.05, label: 'Window height', unit: 'm' },
  sillHeight: { min: 0, max: 1.2, step: 0.05, label: 'Sill height', unit: 'm', hint: '0 = floor to ceiling' },
  reveal: { min: 0, max: 0.4, step: 0.01, label: 'Reveal', unit: 'm', hint: 'Inset from wall face' },

  balconyDepth: { min: 1.2, max: 2.5, step: 0.05, label: 'Balcony depth', unit: 'm' },
  balconyWidthRatio: { min: 0.4, max: 1.0, step: 0.01, label: 'Balcony width', hint: 'Share of module' },
  balconyStartFloor: { min: 0, max: 29, step: 1, label: 'Start floor' },
  randomSeed: { min: 1, max: 999, step: 1, label: 'Seed' },

  coreCount: { min: 0, max: 4, step: 1, label: 'Cores', hint: '0 = none' },
  coreWidth: { min: 2, max: 10, step: 0.1, label: 'Core width', unit: 'm', hint: 'Along the wing' },
  coreDepth: { min: 2, max: 10, step: 0.1, label: 'Core depth', unit: 'm', hint: 'Across the wing' },
  coreOverrun: { min: 0, max: 3.5, step: 0.1, label: 'Overrun', unit: 'm', hint: 'Lift rise above the roof' },

  modulesPerUnit: { min: 1, max: 3, step: 0.5, label: 'Modules per unit' },
  efficiency: { min: 0.85, max: 0.97, step: 0.01, label: 'Efficiency', hint: 'NIA as a share of GFA less cores' },
} satisfies Record<string, Range>

/** Every range key is also a numeric param, which lets the UI bind generically. */
export type RangeKey = keyof typeof RANGES & keyof Params

/**
 * Widened to `Range` on the way out: `satisfies` above checks each entry, but
 * the literal union it infers hides the optional `unit` and `hint` from
 * generic consumers like the slider.
 */
export const RANGE = RANGES as Record<RangeKey, Range>

/**
 * Which edits invalidate hand-placed cores.
 *
 * An offset means nothing on its own — it is a position along a track, and the
 * track is rebuilt from the massing. Change the footprint, the placement mode
 * or the number of cores and the old numbers would point at arbitrary places on
 * a different path, so they go back to automatic. Everything else (floors,
 * window sizes, balconies) leaves the track alone and keeps them.
 */
const RETRACKING: (keyof Params)[] = [
  'preset',
  'corePlacement',
  'coreCount',
  'wingLengthA',
  'wingLengthB',
  'wingLengthC',
  'courtyardWidth',
  'buildingDepth',
  'massOffset',
]

export function clearsCorePlacement(patch: Partial<Params>): boolean {
  return RETRACKING.some((k) => k in patch)
}

/** Minimum masonry above a window head, and beside one. */
export const HEAD_MIN = 0.25
export const PIER_MIN = 0.3

/**
 * The single clamping point. Raw slider values in, a mutually-consistent set
 * out. The UI displays what comes back from here, so the user always sees the
 * value the building was actually built from.
 */
export function resolveParams(raw: Params): Params {
  const p = { ...raw }

  for (const key of Object.keys(RANGE) as RangeKey[]) {
    const r = RANGE[key]
    const v = p[key as keyof Params]
    if (typeof v === 'number') {
      ;(p as Record<string, unknown>)[key] = clamp(v, r.min, r.max)
    }
  }

  p.floors = Math.round(p.floors)
  p.windowsPerModule = Math.round(clamp(p.windowsPerModule, 1, 3))
  p.randomSeed = Math.round(p.randomSeed)

  // A courtyard needs enough length to wrap a void of any size.
  if (p.preset === 'courtyard') {
    p.wingLengthA = Math.max(p.wingLengthA, 2 * p.buildingDepth + 8)
  }
  // U and T wings hang off a spine that must be wider than the wings are deep.
  if (p.preset === 'U') {
    p.wingLengthA = Math.max(p.wingLengthA, 2 * p.buildingDepth + 4)
  }
  if (p.preset === 'T') {
    p.wingLengthA = Math.max(p.wingLengthA, p.buildingDepth + 4)
  }

  // Vertical fit: window head needs masonry above it, so the sill gives way first.
  const headroom = p.floorHeight - HEAD_MIN
  p.sillHeight = clamp(p.sillHeight, 0, Math.max(0, headroom - RANGE.windowHeight.min))
  p.windowHeight = clamp(
    p.windowHeight,
    RANGE.windowHeight.min,
    Math.max(RANGE.windowHeight.min, headroom - p.sillHeight),
  )

  // Horizontal fit: n windows plus n+1 piers must live inside a module.
  const maxWindow = (p.moduleWidth - (p.windowsPerModule + 1) * PIER_MIN) / p.windowsPerModule
  p.windowWidth = clamp(p.windowWidth, RANGE.windowWidth.min, Math.max(RANGE.windowWidth.min, maxWindow))

  // A loggia is carved out of the wing, so it cannot eat more than half its depth.
  p.balconyDepth = clamp(p.balconyDepth, RANGE.balconyDepth.min, Math.max(RANGE.balconyDepth.min, p.buildingDepth / 2 - 1))

  // A core has to live inside the wing it sits in, with wall either side. The
  // builder shrinks it further when a particular wing is short, because only it
  // knows the mass sizes — this is the part that can be settled from params.
  p.coreCount = Math.round(p.coreCount)
  p.coreDepth = clamp(p.coreDepth, RANGE.coreDepth.min, Math.max(RANGE.coreDepth.min, p.buildingDepth - 1))
  // One offset per core, always: shorter means a new core has nowhere to sit,
  // longer means a stale entry decides where a core goes when the count grows.
  p.coreOffsets = Array.from({ length: p.coreCount }, (_, i) => {
    const v = p.coreOffsets?.[i]
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : null
  })

  p.reveal = Math.min(p.reveal, 0.4)
  p.balconyStartFloor = clamp(Math.round(p.balconyStartFloor), 0, Math.max(0, p.floors - 1))

  return p
}
