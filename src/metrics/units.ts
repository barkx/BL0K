import type { FacadeModel } from '../geometry/facade'
import type { Params } from '../store/params'

export interface UnitMetrics {
  /** Every facade module across every floor, whatever the floor is for. */
  modules: number
  /** Only the modules on residential floors — what the estimate counts. */
  residentialModules: number
  /** Modules on level 0 — the rhythm you see in plan. */
  modulesPerFloor: number
  units: number
  averageUnitArea: number
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
  const units = Math.max(0, Math.round(residentialModules / p.modulesPerUnit))
  return {
    modules,
    residentialModules,
    modulesPerFloor: facade.modulesPerFloor,
    units,
    averageUnitArea: units > 0 ? residentialGfa / units : 0,
  }
}
