import type { FacadeModel } from '../geometry/facade'
import type { Params } from '../store/params'
import {
  allocateUnits,
  mixIsSet,
  UNIT_TYPES,
  type Allocation,
  type UnitMix,
  type UnitType,
} from '../store/unitMix'

/** One line of the mix, as the panel and the CSV want it. */
export interface UnitTypeMetrics {
  units: number
  /** Modules this type consumed, out of the residential pool. */
  modules: number
  /** GFA attributed to the type, pro rata by the modules it took. */
  area: number
  /** Average area of one flat of this type. */
  averageArea: number
  /** Target share of the unit count, normalised. */
  target: number
  /** Share actually achieved. */
  achieved: number
}

export interface MixMetrics {
  byType: Record<UnitType, UnitTypeMetrics>
  /** Modules too few to build the cheapest wanted type from. */
  modulesSpare: number
}

export interface UnitMetrics {
  /** Every facade module across every floor, whatever the floor is for. */
  modules: number
  /** Only the modules on residential floors — what the estimate counts. */
  residentialModules: number
  /** Modules on level 0 — the rhythm you see in plan. */
  modulesPerFloor: number
  units: number
  averageUnitArea: number
  /**
   * Null when no mix is set. The headline `units` is then the single-type
   * estimate it always was, rather than a mix quietly standing in for one.
   */
  mix: MixMetrics | null
}

/**
 * Area is split pro rata by the modules a type took, not by a typed-in floor
 * area per flat. The app knows how wide a module is and how deep the building
 * is; it does not know where a party wall falls, and inventing one per unit
 * type would be a floorplan wearing a number's clothes.
 */
function mixMetrics(a: Allocation, mix: UnitMix, residentialGfa: number): MixMetrics {
  const byType = {} as Record<UnitType, UnitTypeMetrics>
  // Against the modules the allocation actually spent, not the pool: the
  // leftover belongs to nobody, and dividing it among the types would hand out
  // area that no flat was built from.
  const spent = a.modulesUsed
  for (const t of UNIT_TYPES) {
    const modules = a.units[t] * mix[t].modules
    const area = spent > 0 ? residentialGfa * (modules / spent) : 0
    byType[t] = {
      units: a.units[t],
      modules,
      area,
      averageArea: a.units[t] > 0 ? area / a.units[t] : 0,
      target: a.target[t],
      achieved: a.achieved[t],
    }
  }
  return { byType, modulesSpare: a.modulesSpare }
}

/**
 * An estimate, and labelled as one in the UI. It assumes single-aspect units
 * one module wide, which is roughly a double-loaded corridor block. The real
 * number arrives with floorplans.
 *
 * `residentialGfa`, not total GFA: a shop is not a flat, and a scheme with a
 * retail plinth would otherwise report both more flats than it has and a larger
 * average one.
 */
export function estimateUnits(
  facade: FacadeModel,
  residentialGfa: number,
  p: Params,
): UnitMetrics {
  const modules = facade.modules.length
  const residentialModules = facade.modules.reduce(
    (n, m) => n + (m.use === 'residential' ? 1 : 0),
    0,
  )
  if (mixIsSet(p.unitMix)) {
    const a = allocateUnits(residentialModules, p.unitMix)
    return {
      modules,
      residentialModules,
      modulesPerFloor: facade.modulesPerFloor,
      units: a.total,
      averageUnitArea: a.total > 0 ? residentialGfa / a.total : 0,
      mix: mixMetrics(a, p.unitMix, residentialGfa),
    }
  }

  const units = Math.max(0, Math.round(residentialModules / p.modulesPerUnit))
  return {
    modules,
    residentialModules,
    modulesPerFloor: facade.modulesPerFloor,
    units,
    averageUnitArea: units > 0 ? residentialGfa / units : 0,
    mix: null,
  }
}
