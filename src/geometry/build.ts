import type { BufferGeometry } from 'three'
import type { Params } from '../store/params'
import { buildMasses } from '../store/presets'
import { planBounds, type Mass } from './masses'
import { buildElevations, type Elevation } from './elevations'
import { buildFacade, type FacadeModel } from './facade'
import { buildWalls, type BuiltWalls } from './walls'
import { buildRoof, type BuiltRoof } from './roof'
import { buildBalconies, type BuiltBalconies } from './balcony'
import { blankForCores, buildCores, disposeCores, type BuiltCores } from './core'
import { buildEdges } from './lines'
import { computeAreas, type AreaMetrics } from '../metrics/area'
import { estimateUnits, type UnitMetrics } from '../metrics/units'
import type { Rect } from '../lib/rect'

export interface Building {
  masses: Mass[]
  elevations: Elevation[]
  facade: FacadeModel
  walls: BuiltWalls
  roof: BuiltRoof
  balconies: BuiltBalconies
  cores: BuiltCores
  edges: BufferGeometry
  metrics: AreaMetrics & UnitMetrics
  bounds: Rect
  buildMs: number
  triangles: number
}

/**
 * The whole derivation, in one pure pass: params in, geometry and metrics out.
 * Nothing here touches the scene, so it stays testable and swappable.
 */
export function buildBuilding(p: Params): Building {
  const t0 = performance.now()

  const masses = buildMasses(p)
  // Two passes over the elevations, and they have to be in this order: the
  // cores need the exterior faces to sit on, and the facade needs to know which
  // stretches of those faces the cores took.
  const faces = buildElevations(masses, p.floorHeight)
  const cores = buildCores(masses, faces, p)
  const elevations = blankForCores(faces, cores.cores)

  const facade = buildFacade(elevations, p)
  const walls = buildWalls(elevations, facade, p)
  const roof = buildRoof(masses, elevations, p)
  const balconies = buildBalconies(elevations, facade, p)
  const edges = buildEdges(masses, elevations, cores.cores, p)

  const areas = computeAreas(masses, elevations, facade, cores, p)
  const units = estimateUnits(facade, areas.gfa, p)

  return {
    masses,
    elevations,
    facade,
    walls,
    roof,
    balconies,
    cores,
    edges,
    metrics: { ...areas, ...units },
    bounds: planBounds(masses),
    buildMs: performance.now() - t0,
    triangles: walls.triangles + cores.triangles,
  }
}

/** Geometry is derived, so the previous pass's buffers are dead the moment a new one lands. */
export function disposeBuilding(b: Building | null) {
  if (!b) return
  for (const g of Object.values(b.walls.byMass)) g.dispose()
  for (const g of Object.values(b.roof.byMass)) g.dispose()
  b.walls.glass.dispose()
  disposeCores(b.cores)
  b.edges.dispose()
}
