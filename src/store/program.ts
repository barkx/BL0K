/**
 * What a floor is for.
 *
 * ## Why bands rather than a use per floor
 *
 * Residential is the ground state and never appears in a band: `program` lists
 * only the stretches that are something else. A building with no bands is a
 * building of flats, which is what every file written before this existed
 * meant, so the migration is "no bands" rather than a rule about what an
 * absent value implies.
 *
 * It also matches how the decision is actually made. A brief says "retail at
 * ground, housing above", not thirty values that happen to agree. Dragging the
 * Floors slider changes the level count constantly, and a per-floor array would
 * need resizing — and a resize rule — on every drag; a band only needs
 * clamping, which `resolveParams()` already does in one place.
 *
 * Levels are **absolute**, the same index `ModuleSlot.floor` and
 * `Elevation.baseFloor` already carry. So a band means the same thing to a
 * stacked mass starting at level 6 as to the wing beside it, and no new
 * coordinate enters the model.
 */
export type Use = 'residential' | 'retail' | 'office' | 'amenity'

/** Everything a band can be. Residential is the absence of a band. */
export type PublicUse = Exclude<Use, 'residential'>

export const PUBLIC_USES: PublicUse[] = ['retail', 'office', 'amenity']

export const USE_LABEL: Record<Use, string> = {
  residential: 'Residential',
  retail: 'Retail',
  office: 'Office',
  amenity: 'Amenity',
}

/**
 * A run of levels given over to something other than housing.
 *
 * Both ends are inclusive, because a brief says "floors 0 to 1" and not "0 up
 * to but not including 2" — an off-by-one here would be invisible in the
 * viewport and wrong in the metrics.
 *
 * The four window figures are the band's own. A public floor is not a flat and
 * should not be glazed like one: a shopfront sits low and wide where a window
 * sits high and narrow. They mirror the building's own figures rather than
 * inventing a second vocabulary, and they are clamped by the same vertical-fit
 * rule in `resolveParams()`.
 */
export interface ProgramBand {
  from: number
  to: number
  use: PublicUse
  sillHeight: number
  windowHeight: number
  windowWidth: number
  windowsPerModule: number
}

/** A shopfront's sill: a kerb upstand, not a windowsill. */
export const SHOPFRONT_SILL = 0.15

/**
 * A band as first proposed, before `resolveParams()` has had it.
 *
 * Glazed nearly floor to ceiling and one opening per module, which is what
 * separates a shopfront from a window at a glance. Everything here is a
 * starting point the user can move.
 */
export function defaultBand(
  use: PublicUse,
  from: number,
  to: number,
  floorHeight: number,
): ProgramBand {
  return {
    from,
    to,
    use,
    sillHeight: SHOPFRONT_SILL,
    windowHeight: Math.max(1.2, floorHeight - SHOPFRONT_SILL - 0.45),
    windowWidth: 3.0,
    windowsPerModule: 1,
  }
}

/**
 * The band covering a level, or null for housing.
 *
 * A linear scan, deliberately: `resolveParams()` leaves the list sorted and
 * disjoint and a building has one or two bands, so the first match is the only
 * match and an index would cost more than it saved.
 */
export function bandAt(program: ProgramBand[], level: number): ProgramBand | null {
  for (const b of program) {
    if (level >= b.from && level <= b.to) return b
  }
  return null
}

export const useAt = (program: ProgramBand[], level: number): Use =>
  bandAt(program, level)?.use ?? 'residential'

/** Levels this band covers, once it has been clamped. */
export const bandLevels = (b: ProgramBand) => Math.max(0, b.to - b.from + 1)
