import type { BufferGeometry } from 'three'
import { MeshBuilder } from '../lib/mesh'
import { subtractSpans, type Span } from '../lib/rect'
import type { Params } from '../store/params'
import type { Elevation } from './elevations'
import type { FacadeModel, ModuleSlot, Opening } from './facade'
import { cheekRect, DOWN, faceRect, frameOf, shelfRect, UP, type Frame } from './frame'
import { loggiaHeadEdge } from './balcony'
import { useAt, type Use } from '../store/program'

/**
 * One merged opaque buffer per mass *and programme*.
 *
 * Split by mass so diagram mode can tint by position in the stack, and by use
 * so it can tint a public floor differently. The split lives here rather than
 * in the scene because geometry must not depend on the render mode — three
 * modes over one geometry is a locked decision, and a buffer that existed only
 * in diagram mode would break it.
 */
export interface WallPart {
  massId: string
  use: Use
  geometry: BufferGeometry
}

export interface BuiltWalls {
  parts: WallPart[]
  /** Every window pane, merged. One draw call, no per-instance matrices. */
  glass: BufferGeometry
  triangles: number
}

/**
 * A wall run with rectangular holes in it, built as bands and piers rather
 * than by boolean subtraction. Windows share a sill and head line per floor,
 * so the run reduces to: a band under the sill, a band over the head, and
 * piers between the openings.
 */
function perforatedWall(
  b: MeshBuilder,
  f: Frame,
  uStart: number,
  uEnd: number,
  yBase: number,
  yTop: number,
  face: number,
  ops: Opening[],
  reveal: number,
) {
  if (ops.length === 0) {
    faceRect(b, f, uStart, uEnd, yBase, yTop, face)
    return
  }

  const { y0, y1 } = ops[0]
  faceRect(b, f, uStart, uEnd, yBase, y0, face)
  faceRect(b, f, uStart, uEnd, y1, yTop, face)

  const piers = subtractSpans(
    { a: uStart, b: uEnd },
    ops.map((o) => ({ a: o.u0, b: o.u1 })),
  )
  for (const p of piers) faceRect(b, f, p.a, p.b, y0, y1, face)

  // The reveal: a shallow tunnel from the wall face back to the glass.
  if (reveal > 1e-4) {
    const inner = face - reveal
    for (const o of ops) {
      cheekRect(b, f, o.u0, face, inner, o.y0, o.y1, f.tan)
      cheekRect(b, f, o.u1, face, inner, o.y0, o.y1, f.negTan)
      shelfRect(b, f, o.u0, o.u1, face, inner, o.y1, DOWN)
      shelfRect(b, f, o.u0, o.u1, face, inner, o.y0, UP)
    }
  }
}

export function buildWalls(
  elevations: Elevation[],
  facade: FacadeModel,
  p: Params,
): BuiltWalls {
  // Pre-size the buffers from the module count. Growing by doubling would
  // otherwise copy the whole vertex buffer a dozen times on a tall block.
  const quadsPerModule = 24
  const modulesPerPart = new Map<string, number>()
  const partKey = (massId: string, use: Use) => `${massId}#${use}`
  for (const m of facade.modules) {
    const k = partKey(m.massId, m.use)
    modulesPerPart.set(k, (modulesPerPart.get(k) ?? 0) + 1)
  }

  const builders = new Map<string, { massId: string; use: Use; b: MeshBuilder }>()
  const builderFor = (massId: string, use: Use) => {
    const k = partKey(massId, use)
    let hit = builders.get(k)
    if (!hit) {
      const estimate = (modulesPerPart.get(k) ?? 0) * quadsPerModule + 128
      builders.set(k, (hit = { massId, use, b: new MeshBuilder(estimate) }))
    }
    return hit.b
  }
  const glass = new MeshBuilder(facade.openings.length + 16)

  const modulesByFloor = new Map<string, ModuleSlot[]>()
  for (const m of facade.modules) {
    const k = `${m.elevKey}#${m.floor}`
    const list = modulesByFloor.get(k)
    if (list) list.push(m)
    else modulesByFloor.set(k, [m])
  }

  const opsByModule = new Map<string, Opening[]>()
  for (const o of facade.openings) {
    const k = `${o.elevKey}#${o.floor}#${o.moduleIndex}`
    const list = opsByModule.get(k)
    if (list) list.push(o)
    else opsByModule.set(k, [o])
  }

  for (const e of elevations) {
    if (e.abutting) continue
    const f = frameOf(e)

    for (let i = 0; i < e.floors; i++) {
      const floor = e.baseFloor + i
      // Every quad on this floor goes to its programme's buffer, junction
      // slivers included: a sliver of blank wall beside a shopfront belongs to
      // the shopfront's floor, not to the housing above it.
      const b = builderFor(e.massId, useAt(p.program, floor))
      const yBase = floor * p.floorHeight
      const yTop = yBase + p.floorHeight
      const mods = modulesByFloor.get(`${e.key}#${floor}`) ?? []

      // Wall between the junction edge and the first whole module: blank.
      const covered: Span[] = mods.map((m) => ({ a: m.u0, b: m.u1 }))
      for (const open of e.openByFloor[i]) {
        for (const sliver of subtractSpans(open, covered)) {
          faceRect(b, f, sliver.a, sliver.b, yBase, yTop, 0)
        }
      }

      for (const m of mods) {
        const ops = (opsByModule.get(`${e.key}#${floor}#${m.index}`) ?? []).sort((x, y) => x.u0 - y.u0)

        if (m.balcony === 'loggia') {
          const d = p.balconyDepth
          // The recess stops short of the floor above so the slab edge reads
          // across the opening — without it, stacked loggias merge into one
          // continuous slot.
          const edge = loggiaHeadEdge(p.floorHeight)
          const yHead = yTop - edge

          faceRect(b, f, m.u0, m.bu0, yBase, yTop, 0)
          faceRect(b, f, m.bu1, m.u1, yBase, yTop, 0)
          faceRect(b, f, m.bu0, m.bu1, yHead, yTop, 0)

          // The recess itself: two cheeks, a soffit, a floor, and a glazed back.
          cheekRect(b, f, m.bu0, 0, -d, yBase, yHead, f.tan)
          cheekRect(b, f, m.bu1, 0, -d, yBase, yHead, f.negTan)
          shelfRect(b, f, m.bu0, m.bu1, 0, -d, yHead, DOWN)
          shelfRect(b, f, m.bu0, m.bu1, 0, -d, yBase, UP)
          perforatedWall(b, f, m.bu0, m.bu1, yBase, yHead, -d, ops, p.reveal)
        } else {
          perforatedWall(b, f, m.u0, m.u1, yBase, yTop, 0, ops, p.reveal)
        }

        for (const o of ops) {
          faceRect(glass, f, o.u0, o.u1, o.y0, o.y1, -(o.setback + p.reveal))
        }
      }
    }
  }

  const parts: WallPart[] = []
  let triangles = glass.triangles
  for (const { massId, use, b } of builders.values()) {
    triangles += b.triangles
    parts.push({ massId, use, geometry: b.toGeometry() })
  }

  return { parts, glass: glass.toGeometry(), triangles }
}
