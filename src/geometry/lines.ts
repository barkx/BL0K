import { BufferAttribute, BufferGeometry } from 'three'
import { footprint, massBase, massTop, type Mass } from './masses'
import type { Elevation } from './elevations'
import type { Core } from './core'
import type { Params } from '../store/params'

/**
 * Line work for the white and diagram modes: mass silhouettes plus a floor
 * line on every exterior face. Generated explicitly rather than via
 * EdgesGeometry — the wall buffer is non-indexed triangle soup, so edge
 * extraction there would draw every internal seam.
 */
export function buildEdges(
  masses: Mass[],
  elevations: Elevation[],
  cores: Core[],
  p: Params,
): BufferGeometry {
  const v: number[] = []
  const seg = (
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
  ) => v.push(x0, y0, z0, x1, y1, z1)

  const OFF = 0.012

  for (const m of masses) {
    const r = footprint(m)
    const y0 = massBase(m, p.floorHeight)
    const y1 = massTop(m, p.floorHeight) + p.roofParapet
    const corners: [number, number][] = [
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
    ]
    for (const [x, z] of corners) seg(x, y0, z, x, y1, z)
    for (let i = 0; i < 4; i++) {
      const a = corners[i]
      const b = corners[(i + 1) % 4]
      seg(a[0], y0, a[1], b[0], y0, b[1])
      seg(a[0], y1, a[1], b[0], y1, b[1])
    }
  }

  // Only the overrun is above the roof, so only the overrun is drawn. Outlining
  // the buried shaft would print a box through the middle of every elevation.
  for (const core of cores) {
    if (core.overrun <= 0) continue
    const r = core.rect
    const y0 = core.topFloor * p.floorHeight
    const y1 = y0 + core.overrun
    const corners: [number, number][] = [
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
    ]
    for (const [x, z] of corners) seg(x, y0, z, x, y1, z)
    for (let i = 0; i < 4; i++) {
      const a = corners[i]
      const b = corners[(i + 1) % 4]
      seg(a[0], y0, a[1], b[0], y0, b[1])
      seg(a[0], y1, a[1], b[0], y1, b[1])
    }
  }

  for (const e of elevations) {
    if (e.abutting) continue
    for (let i = 0; i <= e.floors; i++) {
      const floor = e.baseFloor + i
      const y = floor * p.floorHeight
      const spans = e.openByFloor[Math.min(i, e.floors - 1)]
      for (const s of spans) {
        const ax = e.origin.x + e.uDir.x * s.a + e.normal.x * OFF
        const az = e.origin.z + e.uDir.z * s.a + e.normal.z * OFF
        const bx = e.origin.x + e.uDir.x * s.b + e.normal.x * OFF
        const bz = e.origin.z + e.uDir.z * s.b + e.normal.z * OFF
        seg(ax, y, az, bx, y, bz)
      }
    }
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3))
  g.computeBoundingSphere()
  return g
}
