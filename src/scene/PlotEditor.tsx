import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Mesh } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '../store/store'
import { useGroundProjector } from './useGroundProjector'
import { edgeMidpoint, type Poly } from '../lib/poly'

/**
 * Handles are sized per frame from the camera distance so they keep a roughly
 * constant size on screen. A fixed world size makes them unclickable the
 * moment you zoom out to see a whole site — which is exactly when you want to
 * be editing the boundary.
 *
 * They deliberately respect depth. Drawing them over the buildings would look
 * better, but raycasting still puts the building first, so a handle that
 * appeared to be in front would refuse to be clicked. Hidden and unclickable
 * is at least honest — orbit to reach a corner behind a block.
 */
const CORNER_SCREEN = 0.014
const MIDPOINT_SCREEN = 0.009
const HANDLE_Y = 0.35

function Handle({
  x,
  z,
  screenSize,
  colour,
  opacity = 1,
  onPointerDown,
  onContextMenu,
}: {
  x: number
  z: number
  screenSize: number
  colour: string
  opacity?: number
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void
  onContextMenu?: (event: ThreeEvent<MouseEvent>) => void
}) {
  const ref = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera)

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.scale.setScalar(Math.max(0.35, camera.position.distanceTo(mesh.position) * screenSize))
  })

  return (
    <mesh
      ref={ref}
      position={[x, HANDLE_Y, z]}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={colour} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

/**
 * Vertices drag on window listeners for the same reason buildings do: a drag
 * has to survive the cursor leaving the handle it started on. Orbit is
 * suspended for the duration.
 */
function useVertexDrag() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const movePlotVertex = useStore((s) => s.movePlotVertex)
  const toGround = useGroundProjector()
  const drag = useRef<{ index: number; grabX: number; grabZ: number } | null>(null)

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const ground = toGround(event.clientX, event.clientY)
      if (!ground) return
      movePlotVertex(d.index, { x: ground.x - d.grabX, z: ground.z - d.grabZ })
    }
    const onUp = () => {
      if (!drag.current) return
      drag.current = null
      if (controls) controls.enabled = true
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [controls, movePlotVertex, toGround])

  return useCallback(
    (index: number, x: number, z: number, event: ThreeEvent<PointerEvent>) => {
      if (event.nativeEvent.button !== 0) return
      const ground = toGround(event.nativeEvent.clientX, event.nativeEvent.clientY)
      if (!ground) return
      drag.current = { index, grabX: ground.x - x, grabZ: ground.z - z }
      if (controls) controls.enabled = false
    },
    [controls, toGround],
  )
}

/**
 * Handles on the existing boundary: drag a corner to move it, click a midpoint
 * to add a corner there, right-click a corner to remove it.
 */
export function PlotHandles({ plot }: { plot: Poly }) {
  const beginDrag = useVertexDrag()
  const insertPlotVertex = useStore((s) => s.insertPlotVertex)
  const removePlotVertex = useStore((s) => s.removePlotVertex)
  const canRemove = plot.length > 3

  return (
    <group>
      {plot.map((p, i) => (
        <Handle
          key={`v${i}`}
          x={p.x}
          z={p.z}
          screenSize={CORNER_SCREEN}
          colour="#2c5d8f"
          onPointerDown={(e) => {
            e.stopPropagation()
            beginDrag(i, p.x, p.z, e)
          }}
          onContextMenu={(e) => {
            e.stopPropagation()
            e.nativeEvent.preventDefault()
            if (canRemove) removePlotVertex(i)
          }}
        />
      ))}

      {plot.map((_, i) => {
        const mid = edgeMidpoint(plot, i)
        return (
          <Handle
            key={`m${i}`}
            x={mid.x}
            z={mid.z}
            screenSize={MIDPOINT_SCREEN}
            colour="#7d9ec0"
            opacity={0.85}
            onPointerDown={(e) => {
              e.stopPropagation()
              insertPlotVertex(i, mid)
            }}
          />
        )
      })}
    </group>
  )
}

/**
 * The polyline being traced. The first point is larger and red: clicking it
 * closes the boundary, which is the convention every drawing tool uses.
 */
export function PlotDraft({ draft }: { draft: Poly }) {
  const finishPlotDraw = useStore((s) => s.finishPlotDraw)

  const line = useMemo(() => {
    if (draft.length < 2) return null
    const v: number[] = []
    for (let i = 0; i < draft.length - 1; i++) {
      v.push(draft[i].x, 0.06, draft[i].z, draft[i + 1].x, 0.06, draft[i + 1].z)
    }
    // Show the closing edge once there is a polygon to close.
    if (draft.length >= 3) {
      const a = draft[draft.length - 1]
      const b = draft[0]
      v.push(a.x, 0.06, a.z, b.x, 0.06, b.z)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3))
    return g
  }, [draft])

  useEffect(() => () => line?.dispose(), [line])

  if (draft.length === 0) return null

  return (
    <group>
      {line && (
        <lineSegments geometry={line}>
          <lineBasicMaterial color="#2c5d8f" />
        </lineSegments>
      )}
      {draft.map((p, i) => (
        <Handle
          key={i}
          x={p.x}
          z={p.z}
          screenSize={i === 0 ? CORNER_SCREEN * 1.4 : CORNER_SCREEN}
          colour={i === 0 ? '#b4432c' : '#2c5d8f'}
          onPointerDown={(e) => {
            if (i !== 0 || draft.length < 3) return
            e.stopPropagation()
            finishPlotDraw()
          }}
        />
      ))}
    </group>
  )
}
