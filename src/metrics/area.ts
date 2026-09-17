import { footprintsAt, levels, topLevel, type Mass } from '../geometry/masses'
import type { Elevation } from '../geometry/elevations'
import type { FacadeModel } from '../geometry/facade'
import type { BuiltCores } from '../geometry/core'
import { unionArea } from '../lib/rect'
import type { Params } from '../store/params'
import { useAt, type Use } from '../store/program'

export interface AreaMetrics {
  /** Per-level union, before loggias are deducted. */
  gfaGross: number
  gfa: number
  /** Floor area the cores take, summed over every level they pass through. */
  coreArea: number
  /** Net internal area: GFA less the cores, then less the efficiency factor. */
  nia: number
  loggiaLoss: number
  footprintArea: number
  facadeArea: number
  glazedArea: number
  solidArea: number
  glazedRatio: number
  balconyArea: number
  height: number
  topLevel: number
  /**
   * GFA by programme. The residential figure is the one the unit estimate is
   * built on — counting a shopfront as flats is the inaccuracy this fixes.
   */
  gfaByUse: Record<Use, number>
}

export function computeAreas(
  masses: Mass[],
  elevations: Elevation[],
  facade: FacadeModel,
  cores: BuiltCores,
  p: Params,
): AreaMetrics {
  // A naive sum double-counts the corner where two wings meet, so take the
  // union of footprints level by level.
  let gfaGross = 0
  const gfaByUse: Record<Use, number> = { residential: 0, retail: 0, office: 0, amenity: 0 }
  for (const level of levels(masses)) {
    const area = unionArea(footprintsAt(masses, level))
    gfaGross += area
    gfaByUse[useAt(p.program, level)] += area
  }

  // Every loggia is on a residential floor — a band takes balconies off the
  // floors it covers — so the whole deduction lands there.
  const gfa = gfaGross - facade.loggiaArea
  gfaByUse.residential = Math.max(0, gfaByUse.residential - facade.loggiaArea)

  // Core area is real floor area, so it stays in GFA and comes out of NIA. The
  // factor then covers only what is not modelled: internal walls, risers, plant.
  const nia = Math.max(0, gfa - cores.area) * p.efficiency
  const footprintArea = unionArea(footprintsAt(masses, 0))
  const facadeArea = elevations.reduce((s, e) => s + e.exteriorArea, 0)
  const glazedArea = facade.glazedArea
  const top = topLevel(masses)

  return {
    gfaGross,
    gfa,
    coreArea: cores.area,
    nia,
    loggiaLoss: facade.loggiaArea,
    footprintArea,
    facadeArea,
    glazedArea,
    solidArea: Math.max(0, facadeArea - glazedArea),
    glazedRatio: facadeArea > 0 ? glazedArea / facadeArea : 0,
    balconyArea: facade.balconyArea,
    height: top * p.floorHeight + p.roofParapet,
    topLevel: top,
    gfaByUse,
  }
}
