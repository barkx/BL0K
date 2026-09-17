import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { DoubleSide, Euler, InstancedMesh, Material, Matrix4, Quaternion, Vector3 } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { MaterialSet } from './materials'
import type { Instance } from '../geometry/balcony'
import { MeshBuilder } from '../lib/mesh'
import type { Elevation } from '../geometry/elevations'
import type { PlacedBuilding } from '../site/build'
import type { SiteDrag } from './useSiteDrag'
import type { CoreDrag } from './useCoreDrag'
import type { Tool } from '../store/store'

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
/**
 * Which elevation was clicked, asked of the elevations themselves.
 *
 * This used to guess: take the mass's bounding box, find the nearest of its
 * four edges, and rebuild the key as `massId:N`. That worked only while every
 * mass was an axis-aligned rectangle. A mitred wing has faces at any angle and
 * can have two near the same compass point, so the guess named a face that
 * sometimes did not exist and the Facade rung selected nothing.
 *
 * Measuring against the real faces fixes it for every shape, and removes the
 * second place elevation keys were being invented — `buildElevations` is now
 * the only one, so the two can no longer disagree.
 *
 * Buried faces are skipped. A face another wing is pressed against has no
 * facade to override, and offering it was never useful.
 */
function faceAtPoint(
  elevations: Elevation[],
  massId: string,
  x: number,
  z: number,
): string | null {
  let best: string | null = null
  let bestDistance = Infinity
  for (const e of elevations) {
    if (e.massId !== massId || e.abutting) continue
    const dx = x - e.origin.x
    const dz = z - e.origin.z
    // Only faces the point actually falls along, with a little slack for the
    // wall thickness the app does not model.
    const u = dx * e.uDir.x + dz * e.uDir.z
    if (u < -0.5 || u > e.length + 0.5) continue
    const away = Math.abs(dx * e.normal.x + dz * e.normal.z)
    if (away < bestDistance) {
      bestDistance = away
      best = e.key
    }
  }
  return best
}

/** Pixels of travel that turn a press into an orbit rather than a click. */
const CLICK_SLOP = 4

/** A wash over the selected face, so the override panel refers to something visible. */
function SelectionOverlay({
  elevation,
  floorHeight,
}: {
  elevation: Elevation | undefined
  floorHeight: number
}) {
  const geometry = useMemo(() => {
    if (!elevation) return null
    const b = new MeshBuilder(64)
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

/**
 * One placed building. Generated in its own local frame, then positioned and
 * rotated here — which is why the whole geometry pipeline could stay
 * axis-aligned and untouched when the site layer arrived.
 */
export function Building({
  placed,
  mat,
  selected,
  selectedElevation,
  onSelectBuilding,
  onSelectElevation,
  drag,
  coreDrag,
  tool,
  onUseTool,
}: {
  placed: PlacedBuilding
  mat: MaterialSet
  selected: boolean
  selectedElevation: string | null
  onSelectBuilding: () => void
  onSelectElevation: (key: string | null) => void
  drag: SiteDrag
  coreDrag: CoreDrag
  /** Which section is open, and so which gestures are live on this building. */
  tool: Tool
  /** Jump to the tab that owns whatever was just clicked. */
  onUseTool: (tool: Tool) => void
}) {
  const { placement, building } = placed

  const tintIndex = useMemo(() => {
    const bases = [...new Set(building.masses.map((m) => m.baseFloor))].sort((a, b) => a - b)
    const byId = new Map<string, number>()
    for (const m of building.masses) byId.set(m.id, bases.indexOf(m.baseFloor))
    return byId
  }, [building.masses])

  const masses = useMemo(
    () => new Map(building.masses.map((m) => [m.id, m])),
    [building.masses],
  )

  const elevation = building.elevations.find((e) => e.key === selectedElevation)

  /**
   * Where the press landed, and whether this building was already selected when
   * it landed.
   *
   * The screen position tells a click from an orbit — `useSiteDrag` answers that
   * only while it owns the drag, and outside Placement it does not. The
   * selection flag is what keeps the ladder honest: the press that selects a
   * building is rung one, so its release must not immediately count as rung two.
   */
  const press = useRef<{ x: number; y: number; wasSelected: boolean } | null>(null)

  /**
   * Rung one of the ladder: select the building and open Placement, which is
   * where you would put it. Moving it is editing, so the drag itself still
   * belongs to Placement — anywhere else the press falls through to orbit.
   */
  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    // Always consume the press, in every tab. The ground behind this building
    // clears the selection on a press, so letting one through would deselect
    // the very building being clicked. Stopping here does not reach the native
    // event, so orbit still works when no tool claims the drag.
    event.stopPropagation()
    press.current = {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
      wasSelected: selected,
    }
    if (!selected) {
      onSelectBuilding()
      onUseTool('placement')
    }
    if (tool !== 'placement') return
    drag.begin(placement.id, placement.position, event)
  }

  /** The press, if it stayed still enough to mean a click. */
  const clickOf = (event: ThreeEvent<PointerEvent>) => {
    const start = press.current
    press.current = null
    if (drag.consumeMoved()) return null
    if (!start) return null
    const travel = Math.hypot(
      event.nativeEvent.clientX - start.x,
      event.nativeEvent.clientY - start.y,
    )
    return travel < CLICK_SLOP ? start : null
  }

  /**
   * Clicking the same building again walks down the ladder: Placement, then
   * Massing, then Facade — place it, shape it, detail it.
   *
   * Each rung is the scale you would work at next, so repeated clicks drill in
   * rather than cycling through unrelated panels. Rung one happens on the press
   * that selects; this handles the rest. The Facade rung needs a *vertical*
   * face, because that is the thing being overridden — a click on a roof, or on
   * a sill, has no elevation to name.
   */
  const onPointerUp = (massId: string) => (event: ThreeEvent<PointerEvent>) => {
    const click = clickOf(event)
    // The press that selected this building was rung one. Its release is not
    // also rung two, or one click would land you in Massing.
    if (!click || !click.wasSelected) return

    // Clicked in from outside the ladder — Site, Units, Settings — so start it.
    if (tool !== 'placement' && tool !== 'massing' && tool !== 'facade') {
      onUseTool('placement')
      return
    }

    if (tool === 'placement') {
      onUseTool('massing')
      return
    }

    if (!masses.has(massId)) return
    if (event.face && Math.abs(event.face.normal.y) > 0.8) return
    // The hit point is in world space; the faces are in the building's frame.
    const local = event.object.worldToLocal(event.point.clone())
    const key = faceAtPoint(building.elevations, massId, local.x, local.z)
    // No face owns this point — a sliver, or a wall that is entirely buried.
    // Drilling into Facade with nothing selected would look broken, so stay.
    if (!key) return

    if (tool === 'facade') {
      // Already at the bottom: further clicks just move between faces.
      onSelectElevation(selectedElevation === key ? null : key)
      return
    }
    onUseTool('facade')
    onSelectElevation(key)
  }

  return (
    <group
      position={[placement.position.x, 0, placement.position.z]}
      rotation={[0, (placement.rotation * Math.PI) / 180, 0]}
    >
      {building.walls.parts.map((part) => (
        <mesh
          key={`wall-${part.massId}-${part.use}`}
          geometry={part.geometry}
          material={mat.wall(tintIndex.get(part.massId) ?? 0, part.use)}
          castShadow={mat.shadows}
          receiveShadow={mat.shadows}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp(part.massId)}
        />
      ))}

      {Object.entries(building.roof.byMass).map(([id, geometry]) => (
        <mesh
          key={`roof-${id}`}
          geometry={geometry}
          material={mat.wall(tintIndex.get(id) ?? 0)}
          castShadow={mat.shadows}
          receiveShadow={mat.shadows}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp(id)}
        />
      ))}

      <mesh geometry={building.walls.glass} material={mat.glass} receiveShadow={false} />

      {building.cores.cores.map((core, index) => (
        <mesh
          key={core.id}
          geometry={core.geometry}
          material={mat.core}
          castShadow={mat.shadows}
          receiveShadow={mat.shadows}
          onPointerDown={(event) => {
            // Same bargain as a face override: the first click selects the
            // building, and only then does a press on a shaft move the shaft
            // rather than the block. Otherwise reaching for a building by its
            // roof would shove its core across the plan.
            if (!selected) {
              onPointerDown(event)
              return
            }
            event.stopPropagation()
            // A shaft belongs to Massing, so grabbing one goes there and drags
            // in the same gesture — no need to find the tab first.
            onUseTool('massing')
            coreDrag.begin(index, building.cores.track, placement, event)
          }}
        />
      ))}

      <Instanced items={building.balconies.slabs} material={mat.slab} shadows={mat.shadows} />
      <Instanced items={building.balconies.panels} material={mat.panel} shadows={false} />
      <Instanced items={building.balconies.rails} material={mat.metal} shadows={mat.shadows} />
      <Instanced items={building.balconies.bars} material={mat.metal} shadows={false} />

      {mat.showLines && <lineSegments geometry={building.edges} material={mat.line} />}

      {selected && tool === 'facade' && (
        <SelectionOverlay elevation={elevation} floorHeight={placement.params.floorHeight} />
      )}
    </group>
  )
}
