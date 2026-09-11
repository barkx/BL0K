import { useCallback, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Vec2 } from '../lib/poly'

const GROUND = new Plane(new Vector3(0, 1, 0), 0)

/**
 * Screen pixels to a point on the y=0 plane.
 *
 * Shared by everything that drags in plan — buildings and plot vertices — so
 * there is one projection, not one per interaction. It re-casts from client
 * coordinates rather than using an intersection event, because a drag has to
 * keep working when the cursor leaves whatever mesh it started on.
 */
export function useGroundProjector() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const raycaster = useMemo(() => new Raycaster(), [])

  return useCallback(
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
}
