import { buildBuilding, disposeBuilding, type Building } from '../geometry/build'
import type { Bounds2 } from '../lib/poly'
import { computeSiteMetrics, siteBounds, type SiteMetrics } from './metrics'
import type { Placement, Site } from './types'

export interface PlacedBuilding {
  placement: Placement
  building: Building
}

export interface SiteBuild {
  placed: PlacedBuilding[]
  metrics: SiteMetrics
  bounds: Bounds2
  buildMs: number
  triangles: number
}

/**
 * Derives every building on the site, then the site-wide numbers.
 *
 * `previous` lets an unchanged building keep its buffers instead of being
 * rebuilt: moving one block must not regenerate the geometry of every other
 * block on the plot. Identity of the resolved `params` object is the test,
 * which holds because the store replaces params objects rather than mutating
 * them.
 */
export function buildSite(site: Site, previous?: SiteBuild | null): SiteBuild {
  const t0 = performance.now()

  const reusable = new Map<string, PlacedBuilding>()
  for (const p of previous?.placed ?? []) reusable.set(p.placement.id, p)

  const placed: PlacedBuilding[] = site.buildings.map((placement) => {
    const old = reusable.get(placement.id)
    if (old && old.placement.params === placement.params) {
      return { placement, building: old.building }
    }
    return { placement, building: buildBuilding(placement.params) }
  })

  return {
    placed,
    metrics: computeSiteMetrics(site, placed),
    bounds: siteBounds(placed, site.plot),
    buildMs: performance.now() - t0,
    triangles: placed.reduce((s, p) => s + p.building.triangles, 0),
  }
}

/** Disposes every buffer the site owns. */
export function disposeSite(build: SiteBuild | null) {
  if (!build) return
  for (const p of build.placed) disposeBuilding(p.building)
}

/**
 * Disposes only what `next` did not inherit from `previous`. Call instead of
 * `disposeSite` when swapping one build for another.
 */
export function disposeReplaced(previous: SiteBuild | null, next: SiteBuild) {
  if (!previous) return
  const kept = new Set(next.placed.map((p) => p.building))
  for (const p of previous.placed) {
    if (!kept.has(p.building)) disposeBuilding(p.building)
  }
}
