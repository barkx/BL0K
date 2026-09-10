import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, Euler, InstancedMesh, Material, Matrix4, Quaternion, Vector3 } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useStore } from '../store/store'
import type { MaterialSet } from './materials'
import type { Instance } from '../geometry/balcony'
import type { Dir } from '../store/params'
import { footprint, type Mass } from '../geometry/masses'
import { MeshBuilder } from '../lib/mesh'
import { DIRS } from '../geometry/elevations'

function Instanced({
  items,
  material,
  shadows,
}: {
  items: Instance[]
  material: Material
  shadows: boolean
}) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const pos = new Vector3()
    const scl = new Vector3()
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      e.set(0, it.rotationY, 0)
      q.setFromEuler(e)
      pos.set(it.position[0], it.position[1], it.position[2])
      scl.set(it.scale[0], it.scale[1], it.scale[2])
      mesh.setMatrixAt(i, m.compose(pos, q, scl))
    }
    mesh.count = items.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])

  if (items.length === 0) return null

  return (
    <instancedMesh
      // Instance count is baked into the buffer, so a new count is a new mesh.
      key={items.length}
      ref={ref}
      args={[undefined, undefined, items.length]}
      material={material}
      castShadow={shadows}
      receiveShadow={shadows}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}

/**
 * Which elevation did the ray hit? Decided by which face plane the hit point
 * lies on, not by the facet normal — a click can easily land on a reveal jamb
 * or a loggia cheek, whose normal points along the elevation rather than out
 * of it.
 */
function dirAtPoint(mass: Mass, x: number, z: number): Dir {
  const r = footprint(mass)
  const distance: Record<Dir, number> = {
    N: Math.abs(z - r.z0),
    S: Math.abs(z - r.z1),
    W: Math.abs(x - r.x0),
    E: Math.abs(x - r.x1),
  }
  return DIRS.reduce((best, d) => (distance[d] < distance[best] ? d : best), DIRS[0])
}

/** A wash over the selected face, so the override panel refers to something visible. */
function SelectionOverlay() {
  const selected = useStore((s) => s.selected)
  const elevation = useStore((s) => s.building.elevations.find((e) => e.key === selected))
  const floorHeight = useStore((s) => s.params.floorHeight)

  const geometry = useMemo(() => {
    if (!elevation) return null
    const b = new MeshBuilder()
    const out = 0.08
    for (let i = 0; i < elevation.floors; i++) {
      const y0 = (elevation.baseFloor + i) * floorHeight
      const y1 = y0 + floorHeight
      for (const span of elevation.openByFloor[i]) {
        const p = (u: number, y: number) =>
          [
            elevation.origin.x + elevation.uDir.x * u + elevation.normal.x * out,
            y,
            elevation.origin.z + elevation.uDir.z * u + elevation.normal.z * out,
          ] as [number, number, number]
        b.quad(p(span.a, y0), p(span.b, y0), p(span.b, y1), p(span.a, y1))
      }
    }
    return b.isEmpty ? null : b.toGeometry()
  }, [elevation, floorHeight])

  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshBasicMaterial
        color="#2c5d8f"
        transparent
        opacity={0.2}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  )
}

export function Building({ mat }: { mat: MaterialSet }) {
  const building = useStore((s) => s.building)
  const select = useStore((s) => s.select)
  const selected = useStore((s) => s.selected)

  const masses = useMemo(
    () => new Map(building.masses.map((m) => [m.id, m])),
    [building.masses],
  )

  /**
   * Diagram mode tints by stacking order, not by absolute floor number — in a
   * 30-storey stack the base floors would otherwise land on the same tint and
   * the whole point of the mode would be lost.
   */
  const tintIndex = useMemo(() => {
    const bases = [...new Set(building.masses.map((m) => m.baseFloor))].sort((a, b) => a - b)
    const byId = new Map<string, number>()
    for (const m of building.masses) byId.set(m.id, bases.indexOf(m.baseFloor))
    return byId
  }, [building.masses])

  const pick = (massId: string) => (event: ThreeEvent<MouseEvent>) => {
    const mass = masses.get(massId)
    if (!mass) return
    // A roof hit is not an elevation.
    if (event.face && Math.abs(event.face.normal.y) > 0.8) return
    event.stopPropagation()
    const key = `${massId}:${dirAtPoint(mass, event.point.x, event.point.z)}`
    select(selected === key ? null : key)
  }

  return (
    <group>
      {Object.entries(building.walls.byMass).map(([id, geometry]) => (
        <mesh
          key={`wall-${id}`}
          geometry={geometry}
          material={mat.wall(tintIndex.get(id) ?? 0)}
          castShadow={mat.shadows}
          receiveShadow={mat.shadows}
          onPointerDown={pick(id)}
        />
      ))}

      {Object.entries(building.roof.byMass).map(([id, geometry]) => (
        <mesh
          key={`roof-${id}`}
          geometry={geometry}
          material={mat.wall(tintIndex.get(id) ?? 0)}
          castShadow={mat.shadows}
          receiveShadow={mat.shadows}
        />
      ))}

      <mesh geometry={building.walls.glass} material={mat.glass} receiveShadow={false} />

      <Instanced items={building.balconies.slabs} material={mat.slab} shadows={mat.shadows} />
      <Instanced items={building.balconies.panels} material={mat.panel} shadows={false} />
      <Instanced items={building.balconies.rails} material={mat.metal} shadows={mat.shadows} />
      <Instanced items={building.balconies.bars} material={mat.metal} shadows={false} />

      {mat.showLines && <lineSegments geometry={building.edges} material={mat.line} />}
      <SelectionOverlay />
    </group>
  )
}
