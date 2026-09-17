import type { BufferGeometry } from 'three'
import { MeshBuilder, horizontalPoly } from '../lib/mesh'
import { intersectSpans, type Span } from '../lib/rect'
import { subtract } from '../lib/convex'
import type { Poly } from '../lib/poly'
import type { Params } from '../store/params'
import { massTop, type Mass } from './masses'
import type { Elevation } from './elevations'
import { cheekRect, faceRect, frameOf, shelfRect, UP } from './frame'

export const PARAPET_THICKNESS = 0.25

/**
 * Where a roof cap runs along an elevation, measured in that elevation's `u`.
 *
 * Asked of the elevation's own frame rather than of compass directions, so it
 * holds for a mitred wing whose faces sit at any angle. A cap edge counts when
 * it lies in the face's plane; how much of the face it covers is the range of
 * its points projected onto `u`.
 */
function capSpanOnFace(e: Elevation, cap: Poly): Span | null {
  const on: number[] = []
  for (const q of cap) {
    const away = (q.x - e.origin.x) * e.normal.x + (q.z - e.origin.z) * e.normal.z
    if (Math.abs(away) > 1e-6) continue
    on.push((q.x - e.origin.x) * e.uDir.x + (q.z - e.origin.z) * e.uDir.z)
  }
  if (on.length < 2) return null
  const a = Math.min(...on)
  const b = Math.max(...on)
  return b - a > 1e-6 ? { a, b } : null
}

export interface BuiltRoof {
  byMass: Record<string, BufferGeometry>
}

/**
 * Flat roof plus a simple parapet. The roof of a mass is its footprint minus
 * whatever sits on top of it, and the parapet runs only where an exposed roof
 * edge meets an exterior face — so a stacked mass does not get a parapet
 * buried inside the wall above it.
 */
export function buildRoof(masses: Mass[], elevations: Elevation[], p: Params): BuiltRoof {
  const byMass: Record<string, BufferGeometry> = {}

  for (const m of masses) {
    const b = new MeshBuilder(64)
    const topY = massTop(m, p.floorHeight)
    const topLevel = m.baseFloor + m.floors

    const blockers = masses
      .filter((o) => o.id !== m.id && o.baseFloor <= topLevel && o.baseFloor + o.floors > topLevel)
      .map((o) => o.shape)

    // The roof is the outline less whatever stands on it. Cutting polygons
    // rather than boxes is what lets a mitred wing keep its shape up here, and
    // what lets a set-back storey leave a terrace the shape of the gap.
    let caps: Poly[] = [m.shape]
    for (const blocker of blockers) caps = caps.flatMap((c) => subtract(c, blocker))
    for (const c of caps) horizontalPoly(b, c, topY, true)

    if (p.roofParapet > 1e-3) {
      const t = PARAPET_THICKNESS
      const h = p.roofParapet
      for (const e of elevations.filter((el) => el.massId === m.id && !el.abutting)) {
        const f = frameOf(e)
        const capSpans = caps
          .map((c) => capSpanOnFace(e, c))
          .filter((s): s is Span => s !== null)
        const exposed = intersectSpans(e.openByFloor[e.floors - 1], capSpans)

        for (const s of exposed) {
          faceRect(b, f, s.a, s.b, topY, topY + h, 0)
          faceRect(b, f, s.a, s.b, topY, topY + h, -t, f.negOut)
          shelfRect(b, f, s.a, s.b, 0, -t, topY + h, UP)
          cheekRect(b, f, s.a, 0, -t, topY, topY + h, f.negTan)
          cheekRect(b, f, s.b, 0, -t, topY, topY + h, f.tan)
        }
      }
    }

    if (!b.isEmpty) byMass[m.id] = b.toGeometry()
  }

  return { byMass }
}
