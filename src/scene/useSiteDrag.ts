import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '../store/store'
import type { Vec2 } from '../lib/poly'

/**
 * Dragging a building across the ground.
 *
 * The obvious implementations both fail. Handling it on the ground mesh means
 * the drag dies the moment the cursor passes over another building; handling it
 * on the building mesh means it dies as soon as the cursor leaves that
 * building. So the drag starts from a building's pointerdown and then runs on
 * window listeners, re-casting the pointer onto the y=0 plane each move.
 *
 * Orbit is suspended for the duration, otherwise the camera swings with the
 * drag. The grab offset is kept so the block does not jump to the cursor.
 */
export interface SiteDrag {
  begin: (id: string, position: Vec2, event: ThreeEvent<PointerEvent>) => void
  /** True if the last press turned into a drag. Reading it clears the flag. */
  consumeMoved: () => boolean
}

const GROUND = new Plane(new Vector3(0, 1, 0), 0)
/** Pixels of travel before a press counts as a drag rather than a click. */
const THRESHOLD = 4

export function useSiteDrag(): SiteDrag {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const move = useStore((s) => s.move)

  const raycaster = useMemo(() => new Raycaster(), [])
  const drag = useRef<{
    id: string
    grab: Vec2
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const moved = useRef(false)

  const toGround = useCallback(
    (clientX: number, clientY: number): Vec2 | null => {
      const rect = gl.domElement.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      const ndc = new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = new Vector3()
      return raycaster.ray.intersectPlane(GROUND, hit) ? { x: hit.x, z: hit.z } : null
    },
    [camera, gl, raycaster],
  )

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (!d.moved) {
        const travel = Math.hypot(event.clientX - d.startX, event.clientY - d.startY)
        if (travel < THRESHOLD) return
        d.moved = true
        moved.current = true
      }
      const ground = toGround(event.clientX, event.clientY)
      if (!ground) return
      move(d.id, { x: ground.x - d.grab.x, z: ground.z - d.grab.z })
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
  }, [controls, move, toGround])

  const begin = useCallback(
    (id: string, position: Vec2, event: ThreeEvent<PointerEvent>) => {
      // Left button only; right-drag stays orbit and pan.
      if (event.nativeEvent.button !== 0) return
      const ground = toGround(event.nativeEvent.clientX, event.nativeEvent.clientY)
      if (!ground) return
      moved.current = false
      drag.current = {
        id,
        grab: { x: ground.x - position.x, z: ground.z - position.z },
        startX: event.nativeEvent.clientX,
        startY: event.nativeEvent.clientY,
        moved: false,
      }
      if (controls) controls.enabled = false
    },
    [controls, toGround],
  )

  const consumeMoved = useCallback(() => {
    const was = moved.current
    moved.current = false
    return was
  }, [])

  return { begin, consumeMoved }
}
