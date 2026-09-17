/**
 * A target mix of apartment types, and the allocation that meets it.
 *
 * The unit estimate has always been one number over one divisor: every module
 * is the same unit, so `modules / modulesPerUnit` is the count. That is fine
 * for a massing study and useless for a brief, which never says "220 flats" —
 * it says 30% one-bed, 45% two-bed, 25% three-bed.
 *
 * Nothing here touches geometry. A type's `modules` is how many facade modules
 * one flat of that type spans, and the modules themselves are unchanged: the
 * rhythm is still the elevation's, and the mix is an accounting of the modules
 * that already exist. Placing particular flats in particular bays would be
 * floorplans, which is a §1 non-goal and stays one.
 */

export type UnitType = 'studio' | 'oneBed' | 'twoBed' | 'threeBed'

export const UNIT_TYPES: UnitType[] = ['studio', 'oneBed', 'twoBed', 'threeBed']

export const UNIT_LABEL: Record<UnitType, string> = {
  studio: 'Studio',
  oneBed: '1 bed',
  twoBed: '2 bed',
  threeBed: '3 bed',
}

export interface UnitTypeSpec {
  /** Facade modules one flat of this type spans. */
  modules: number
  /**
   * Target share of the unit count, as a percentage.
   *
   * Zero means the type is not in the scheme — the same bargain the site rules
   * make, where a limit nobody set is off rather than defaulted. Shares need
   * not sum to 100: they are normalised when the allocation runs, and the panel
   * says so rather than refusing the numbers you typed.
   */
  share: number
}

export type UnitMix = Record<UnitType, UnitTypeSpec>

/**
 * No mix at all, which is what every scheme opens with and what every file
 * written before this described. The estimate then falls back to the single
 * `modulesPerUnit` divisor, so nothing changes until somebody asks for a mix.
 */
export const NO_MIX: UnitMix = {
  studio: { modules: 1, share: 0 },
  oneBed: { modules: 1, share: 0 },
  twoBed: { modules: 1.5, share: 0 },
  threeBed: { modules: 2, share: 0 },
}

export const mixIsSet = (mix: UnitMix) => UNIT_TYPES.some((t) => mix[t].share > 0)

const zeros = (): Record<UnitType, number> => ({
  studio: 0,
  oneBed: 0,
  twoBed: 0,
  threeBed: 0,
})

export interface Allocation {
  units: Record<UnitType, number>
  total: number
  /** Modules the allocation consumed. */
  modulesUsed: number
  /** Modules nothing could be built from — fewer than the cheapest type wants. */
  modulesSpare: number
  /** Target share per type, normalised to sum to one. */
  target: Record<UnitType, number>
  /** Share actually achieved, as a fraction of the unit count. */
  achieved: Record<UnitType, number>
}

/**
 * Fill a pool of modules with flats, keeping as close to the target mix as the
 * pool allows.
 *
 * One flat at a time: among the types that still fit in what is left, take the
 * one whose achieved share would sit furthest below its target, breaking ties
 * by declaration order. Stop when nothing fits.
 *
 * Chosen over solving for the counts directly because it cannot overspend. A
 * closed form — `units = modules / average`, rounded per type — has to round,
 * and rounding can claim a module the building does not have; catching that
 * afterwards means a correction pass whose result is harder to predict than
 * this loop's. Here the budget falls monotonically and the leftover is reported
 * rather than hidden, which is the same bargain the module fit already makes
 * with its snapped width.
 *
 * Deterministic: same pool and same targets, same allocation, every time.
 */
export function allocateUnits(modules: number, mix: UnitMix): Allocation {
  const units = zeros()
  const target = zeros()
  const achieved = zeros()

  const wanted = UNIT_TYPES.filter((t) => mix[t].share > 0 && mix[t].modules > 0)
  const totalShare = wanted.reduce((s, t) => s + mix[t].share, 0)
  if (wanted.length === 0 || totalShare <= 0 || modules <= 0) {
    return { units, total: 0, modulesUsed: 0, modulesSpare: Math.max(0, modules), target, achieved }
  }
  for (const t of wanted) target[t] = mix[t].share / totalShare

  let remaining = modules
  let total = 0
  for (;;) {
    let best: UnitType | null = null
    let bestDeficit = -Infinity
    for (const t of wanted) {
      // A hair of tolerance, so a 1.5-module flat still fits a 1.5-module
      // remainder that floating point has nudged to 1.4999999.
      if (mix[t].modules > remaining + 1e-9) continue
      // Measured against the count this flat would make, so the first pick
      // goes to the largest target rather than to whichever type is listed
      // first.
      const deficit = target[t] - units[t] / (total + 1)
      if (deficit > bestDeficit + 1e-12) {
        bestDeficit = deficit
        best = t
      }
    }
    if (!best) break
    units[best]++
    total++
    remaining -= mix[best].modules
  }

  for (const t of UNIT_TYPES) achieved[t] = total > 0 ? units[t] / total : 0

  return {
    units,
    total,
    modulesUsed: modules - remaining,
    modulesSpare: remaining,
    target,
    achieved,
  }
}
