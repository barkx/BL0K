import { footprint, type Mass } from '../geometry/masses'
import type { Building } from '../geometry/build'
import {
  bounds,
  convexOverlap,
  isSimple,
  place,
  pointInPolygon,
  polygonArea,
  type Bounds2,
  type Poly,
} from '../lib/poly'
import { checkRules, type Breach } from './rules'
import type { Placement, Site } from './types'
import type { Use } from '../store/program'

export interface SiteMetrics {
  buildings: number
  /** Sum across every building. */
  gfa: number
  /** The same total, split by what each floor is for. */
  gfaByUse: Record<Use, number>
  /** Sum of the floor area cores take out of every storey. */
  coreArea: number
  /** Sum of per-building NIA, each GFA less its cores, times its own factor. */
  nia: number
  units: number
  facadeArea: number
  balconyArea: number
  loggiaLoss: number
  /** Sum of per-building level-0 footprints. */
  footprint: number
  plotArea: number
  /** Footprint over plot area. Only meaningful while nothing overlaps. */
  coverage: number
  /** Floor area ratio — GFA over plot area. The number a planner asks for. */
  far: number
  maxHeight: number
  /** Pairs of building names whose footprints intersect. */
  clashes: [string, string][]
  /** Buildings not entirely inside the plot. */
  offPlot: string[]
  /** False when the boundary crosses itself, which makes area meaningless. */
  plotSimple: boolean
  /** Planning limits the scheme breaks. Empty when every rule is off or met. */
  breaches: Breach[]
}

/** A mass footprint as a plan quad in site coordinates. */
function massQuad(mass: Mass, p: Placement): Poly {
  const r = footprint(mass)
  return [
    { x: r.x0, z: r.z0 },
    { x: r.x1, z: r.z0 },
    { x: r.x1, z: r.z1 },
    { x: r.x0, z: r.z1 },
  ].map((v) => place(v, p.rotation, p.position))
}

/** Every ground-level footprint quad of a building, in site coordinates. */
export function groundQuads(building: Building, p: Placement): Poly[] {
  return building.masses
    .filter((m) => m.baseFloor === 0)
    .map((m) => massQuad(m, p))
}

/** Every footprint quad at any level — used for bounds and clash testing. */
export function allQuads(building: Building, p: Placement): Poly[] {
  return building.masses.map((m) => massQuad(m, p))
}

export function siteBounds(placed: { placement: Placement; building: Building }[], plot: Poly): Bounds2 {
  const points = [...plot]
  for (const { placement, building } of placed) {
    for (const quad of allQuads(building, placement)) points.push(...quad)
  }
  return bounds(points)
}

export function computeSiteMetrics(
  site: Site,
  placed: { placement: Placement; building: Building }[],
): SiteMetrics {
  const plotArea = polygonArea(site.plot)

  let gfa = 0
  const gfaByUse: Record<Use, number> = { residential: 0, retail: 0, office: 0, amenity: 0 }
  let coreArea = 0
  let nia = 0
  let units = 0
  let facadeArea = 0
  let balconyArea = 0
  let loggiaLoss = 0
  let footprintTotal = 0
  let maxHeight = 0

  for (const { building } of placed) {
    gfa += building.metrics.gfa
    for (const use of Object.keys(gfaByUse) as Use[]) {
      gfaByUse[use] += building.metrics.gfaByUse[use]
    }
    coreArea += building.metrics.coreArea
    nia += building.metrics.nia
    units += building.metrics.units
    facadeArea += building.metrics.facadeArea
    balconyArea += building.metrics.balconyArea
    loggiaLoss += building.metrics.loggiaLoss
    footprintTotal += building.metrics.footprintArea
    maxHeight = Math.max(maxHeight, building.metrics.height)
  }

  // A scheme with overlapping buildings is invalid, and its coverage figure
  // would silently over-count. Flag it rather than quietly summing.
  const clashes: [string, string][] = []
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = allQuads(placed[i].building, placed[i].placement)
      const b = allQuads(placed[j].building, placed[j].placement)
      if (a.some((qa) => b.some((qb) => convexOverlap(qa, qb)))) {
        clashes.push([placed[i].placement.name, placed[j].placement.name])
      }
    }
  }

  const offPlot: string[] = []
  if (site.plot.length >= 3) {
    for (const { placement, building } of placed) {
      const outside = groundQuads(building, placement).some((quad) =>
        quad.some((corner) => !pointInPolygon(corner, site.plot)),
      )
      if (outside) offPlot.push(placement.name)
    }
  }

  const coverage = plotArea > 0 ? footprintTotal / plotArea : 0
  const far = plotArea > 0 ? gfa / plotArea : 0
  const offPlotNames = new Set(offPlot)

  const breaches = checkRules(
    site.rules,
    site.plot,
    placed.map(({ placement, building }) => ({
      name: placement.name,
      height: building.metrics.height,
      ground: groundQuads(building, placement),
      all: allQuads(building, placement),
      offPlot: offPlotNames.has(placement.name),
    })),
    { far, coverage },
    clashes,
  )

  return {
    buildings: placed.length,
    gfa,
    gfaByUse,
    coreArea,
    nia,
    units,
    facadeArea,
    balconyArea,
    loggiaLoss,
    footprint: footprintTotal,
    plotArea,
    coverage,
    far,
    maxHeight,
    clashes,
    offPlot,
    plotSimple: isSimple(site.plot),
    breaches,
  }
}
