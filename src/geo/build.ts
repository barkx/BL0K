import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from 'three'
import { MeshBuilder, type V3 } from '../lib/mesh'
import { toLocal, type GeoAnchor } from './project'
import type { OsmContext, OsmWay } from './overpass'

/**
 * OSM data, turned into something the scene can draw.
 *
 * Pure, like every other builder here: context and anchor in, `BufferGeometry`
 * out, no scene access. Projection happens here rather than at fetch time, so
 * turning true north afterwards swings the surroundings with it instead of
 * leaving them pointing the old way.
 *
 * Today it draws **lines only** — building footprints, roads, water and rail as
 * flat linework, a map to trace over rather than a model to look at. The
 * extrusion path is intact behind `EXTRUDE_BUILDINGS` below; when it is on, a
 * building carrying a `height` or `building:levels` tag becomes a volume and an
 * untagged one stays an outline, because guessing a height would be inventing
 * data and then drawing it as though it were surveyed.
 */
export interface BuiltContext {
  solids: BufferGeometry | null
  lines: BufferGeometry | null
  triangles: number
}

export const NO_CONTEXT: BuiltContext = { solids: null, lines: null, triangles: 0 }

/**
 * Whether tagged buildings come in as volumes.
 *
 * Off for now, by decision: the surroundings read better as a drawn map than as
 * a field of grey boxes competing with the scheme for attention, and a plot is
 * easier to trace over flat linework. The extrusion path below is kept, and
 * tested, because "for now" is the operative phrase — this is one word away
 * from coming back, and nothing else has to change when it does.
 */
export const EXTRUDE_BUILDINGS = false

/** Ground offsets, so context line work never fights the plot for the same plane. */
const LINE_Y = 0.02
const BUILDING_LINE_Y = 0.04

/** A way's points, projected into the model's metres. */
function ring(way: OsmWay, anchor: GeoAnchor) {
  const out: { x: number; z: number }[] = []
  for (let i = 0; i < way.points.length; i += 2) {
    out.push(toLocal(anchor, way.points[i], way.points[i + 1]))
  }
  // OSM closes a way by repeating its first node. A repeated point is a
  // zero-length edge, which triangulates into nothing useful.
  if (out.length > 1) {
    const a = out[0]
    const b = out[out.length - 1]
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.z - b.z) < 1e-6) out.pop()
  }
  return out
}

export function buildContext(context: OsmContext | null, anchor: GeoAnchor | null): BuiltContext {
  if (!context || !anchor) return NO_CONTEXT

  const solid = new MeshBuilder(1024)
  const segments: number[] = []
  const seg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
    segments.push(ax, ay, az, bx, by, bz)

  for (const way of context.ways) {
    const points = ring(way, anchor)
    if (points.length < 2) continue

    if (way.kind !== 'building') {
      // Roads, water and rail are open ways: draw them as they run.
      for (let i = 0; i < points.length - 1; i++) {
        seg(points[i].x, LINE_Y, points[i].z, points[i + 1].x, LINE_Y, points[i + 1].z)
      }
      continue
    }

    if (points.length < 3) continue

    // Every building gets its outline at ground level, extruded or not.
    for (let i = 0; i < points.length; i++) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      seg(a.x, BUILDING_LINE_Y, a.z, b.x, BUILDING_LINE_Y, b.z)
    }

    if (!EXTRUDE_BUILDINGS || way.height <= 0) continue

    const h = way.height
    // Sides. Wound so the outward face is the one you see from the street; the
    // hint fixes it either way, since OSM ways are not consistently wound.
    for (let i = 0; i < points.length; i++) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      const outward: V3 = [a.z - b.z, 0, b.x - a.x]
      solid.quad([a.x, 0, a.z], [b.x, 0, b.z], [b.x, h, b.z], [a.x, h, a.z], outward)
    }

    // Roof. `ShapeUtils` is three's own ear clipper, already relied on for the
    // plot fill, so an arbitrary footprint caps without a second algorithm.
    const contour = points.map((p) => new Vector2(p.x, p.z))
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, [])) {
      solid.tri(
        [points[i].x, h, points[i].z],
        [points[j].x, h, points[j].z],
        [points[k].x, h, points[k].z],
        [0, 1, 0],
      )
    }
  }

  let lines: BufferGeometry | null = null
  if (segments.length > 0) {
    lines = new BufferGeometry()
    lines.setAttribute('position', new BufferAttribute(new Float32Array(segments), 3))
    lines.computeBoundingSphere()
  }

  return {
    solids: solid.isEmpty ? null : solid.toGeometry(),
    lines,
    triangles: solid.triangles,
  }
}

export function disposeContext(built: BuiltContext | null) {
  if (!built) return
  built.solids?.dispose()
  built.lines?.dispose()
}
