import { footprintsAt, levels, topLevel, type Mass } from '../geometry/masses'
import type { Elevation } from '../geometry/elevations'
import type { FacadeModel } from '../geometry/facade'
import { unionArea } from '../lib/rect'
import type { Params } from '../store/params'

export interface AreaMetrics {
  /** Per-level union, before loggias are deducted. */
  gfaGross: number
  gfa: number
  loggiaLoss: number
  footprintArea: number
  coverage: number
  facadeArea: number
  glazedArea: number
  solidArea: number
  glazedRatio: number
  balconyArea: number
  height: number
  topLevel: number
}

export function computeAreas(
  masses: Mass[],
  elevations: Elevation[],
  facade: FacadeModel,
  p: Params,
): AreaMetrics {
  // A naive sum double-counts the corner where two wings meet, so take the
  // union of footprints level by level.
  let gfaGross = 0
  for (const level of levels(masses)) {
    gfaGross += unionArea(footprintsAt(masses, level))
  }

  const footprintArea = unionArea(footprintsAt(masses, 0))
  const facadeArea = elevations.reduce((s, e) => s + e.exteriorArea, 0)
  const glazedArea = facade.glazedArea
  const top = topLevel(masses)

  return {
    gfaGross,
    gfa: gfaGross - facade.loggiaArea,
    loggiaLoss: facade.loggiaArea,
    footprintArea,
    coverage: p.siteArea > 0 ? footprintArea / p.siteArea : 0,
    facadeArea,
    glazedArea,
    solidArea: Math.max(0, facadeArea - glazedArea),
    glazedRatio: facadeArea > 0 ? glazedArea / facadeArea : 0,
    balconyArea: facade.balconyArea,
    height: top * p.floorHeight + p.roofParapet,
    topLevel: top,
  }
}
