import type { BufferGeometry } from 'three'
import { MeshBuilder, horizontalQuad } from '../lib/mesh'
import { intersectSpans, subtractRects, type Rect, type Span } from '../lib/rect'
import { same } from '../lib/clamp'
import type { Params, Dir } from '../store/params'
import { footprint, massTop, type Mass } from './masses'
import type { Elevation } from './elevations'
import { cheekRect, faceRect, frameOf, shelfRect, UP } from './frame'

export const PARAPET_THICKNESS = 0.25

/** Where a roof rectangle meets this face, measured along u. */
function capSpanOnFace(m: Mass, dir: Dir, cap: Rect): Span | null {
  const r = footprint(m)
  switch (dir) {
    case 'N':
      return same(cap.z0, r.z0) ? { a: r.x1 - cap.x1, b: r.x1 - cap.x0 } : null
    case 'S':
      return same(cap.z1, r.z1) ? { a: cap.x0 - r.x0, b: cap.x1 - r.x0 } : null
    case 'E':
      return same(cap.x1, r.x1) ? { a: r.z1 - cap.z1, b: r.z1 - cap.z0 } : null
    case 'W':
      return same(cap.x0, r.x0) ? { a: cap.z0 - r.z0, b: cap.z1 - r.z0 } : null
  }
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
      .map(footprint)

    const caps = subtractRects(footprint(m), blockers)
    for (const c of caps) horizontalQuad(b, c.x0, c.x1, c.z0, c.z1, topY, true)

    if (p.roofParapet > 1e-3) {
      const t = PARAPET_THICKNESS
      const h = p.roofParapet
      for (const e of elevations.filter((el) => el.massId === m.id && !el.abutting)) {
        const f = frameOf(e)
        const capSpans = caps
          .map((c) => capSpanOnFace(m, e.dir, c))
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
