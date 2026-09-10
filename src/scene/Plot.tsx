import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Shape, ShapeGeometry } from 'three'
import type { Poly } from '../lib/poly'
import { groundQuads } from '../site/metrics'
import type { PlacedBuilding } from '../site/build'
import type { MaterialSet } from './materials'

/**
 * A closed line loop through plan points, lifted just off the ground.
 *
 * Built as explicit segments in XZ rather than a rotated 2D shape — the
 * mapping from a `Shape`'s XY into world XZ flips one axis, and getting that
 * wrong silently mirrors the site.
 */
function loopGeometry(points: Poly, y: number): BufferGeometry | null {
  if (points.length < 2) return null
  const v: number[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    v.push(a.x, y, a.z, b.x, y, b.z)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3))
  g.computeBoundingSphere()
  return g
}

/** Filled plot surface. `Shape` is in XY, so world XZ needs z negated. */
function fillGeometry(points: Poly): BufferGeometry | null {
  if (points.length < 3) return null
  const shape = new Shape(points.map((p) => ({ x: p.x, y: -p.z }) as never))
  const g = new ShapeGeometry(shape)
  g.rotateX(-Math.PI / 2)
  return g
}

export function Plot({
  plot,
  placed,
  selectedId,
  clashing,
  mat,
}: {
  plot: Poly
  placed: PlacedBuilding[]
  selectedId: string | null
  clashing: Set<string>
  mat: MaterialSet
}) {
  const fill = useMemo(() => fillGeometry(plot), [plot])
  const boundary = useMemo(() => loopGeometry(plot, 0.03), [plot])

  const outlines = useMemo(
    () =>
      placed.map((p) => ({
        id: p.placement.id,
        loops: groundQuads(p.building, p.placement)
          .map((quad) => loopGeometry(quad, 0.05))
          .filter((g): g is BufferGeometry => g !== null),
      })),
    [placed],
  )

  useEffect(
    () => () => {
      fill?.dispose()
      boundary?.dispose()
      outlines.forEach((o) => o.loops.forEach((g) => g.dispose()))
    },
    [fill, boundary, outlines],
  )

  const diagram = mat.mode === 'diagram'

  return (
    <group>
      {fill && (
        <mesh geometry={fill} position={[0, 0.012, 0]} receiveShadow={mat.shadows}>
          <meshStandardMaterial
            color={diagram ? '#dfe8f1' : '#e6e3de'}
            roughness={0.95}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      )}

      {boundary && (
        <lineSegments geometry={boundary}>
          <lineBasicMaterial color="#2c5d8f" />
        </lineSegments>
      )}

      {outlines.map((o) =>
        o.loops.map((g, i) => (
          <lineSegments key={`${o.id}-${i}`} geometry={g}>
            <lineBasicMaterial
              color={clashing.has(o.id) ? '#b4432c' : o.id === selectedId ? '#2c5d8f' : '#9aa2ab'}
            />
          </lineSegments>
        )),
      )}
    </group>
  )
}
