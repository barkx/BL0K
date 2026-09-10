import type { FacadeModel } from '../geometry/facade'
import type { Params } from '../store/params'

export interface UnitMetrics {
  /** Every facade module across every floor. */
  modules: number
  /** Modules on level 0 — the rhythm you see in plan. */
  modulesPerFloor: number
  units: number
  averageUnitArea: number
}

/**
 * An estimate, and labelled as one in the UI. It assumes single-aspect units
 * one module wide, which is roughly a double-loaded corridor block. The real
 * number arrives with floorplans.
 */
export function estimateUnits(facade: FacadeModel, gfa: number, p: Params): UnitMetrics {
  const modules = facade.modules.length
  const units = Math.max(0, Math.round(modules / p.modulesPerUnit))
  return {
    modules,
    modulesPerFloor: facade.modulesPerFloor,
    units,
    averageUnitArea: units > 0 ? gfa / units : 0,
  }
}
