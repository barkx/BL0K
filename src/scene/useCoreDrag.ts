import { useCallback, useEffect, useRef } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '../store/store'
import { useGroundProjector } from './useGroundProjector'
import { nearestOnTrack, type TrackSegment } from '../geometry/core'
import type { Vec2 } from '../lib/poly'

/**
 * Dragging a core along the track it sits on.
 *
 * Same shape as `useSiteDrag`, and for the same reasons: one hook for the whole
 * site rather than one per building, and the move runs on window listeners
 * because a drag has to survive the cursor leaving the mesh it began on — a
 * core is small, so it leaves almost immediately.
 *
 * What differs is what the cursor means. A building follows the pointer; a core
 * is constrained, so the ground point is projected onto the nearest run of the
 * track and the shaft slides to that position. The cursor can be well off the
 * building and the core still lands somewhere real. The projection is done in
 * the building's own frame, so it works on a rotated block without the geometry
 * layer ever learning about rotation.
 */
export interface CoreDrag {
  begin: (
    index: number,
    track: TrackSegment[],
    placement: { position: Vec2; rotation: number },
    event: ThreeEvent<PointerEvent>,
  ) => void
  /** True if the last press turned into a drag. Reading it clears the flag. */
  consumeMoved: () => boolean
}

/** Pixels of travel before a press counts as a drag rather than a click. */
const THRESHOLD = 4

export function useCoreDrag(): CoreDrag {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const setCoreOffset = useStore((s) => s.setCoreOffset)
  const toGround = useGroundProjector()

  const drag = useRef<{
    index: number
    track: TrackSegment[]
    placement: { position: Vec2; rotation: number }
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (!d.moved) {
        if (Math.hypot(event.clientX - d.startX, event.clientY - d.startY) < THRESHOLD) return
        d.moved = true
        moved.current = true
      }
      const ground = toGround(event.clientX, event.clientY)
      if (!ground) return

      // World back into the building's own frame: undo the offset, then the
      // rotation. `place()` in lib/poly applies the two the other way round.
      const dx = ground.x - d.placement.position.x
      const dz = ground.z - d.placement.position.z
      const r = (d.placement.rotation * Math.PI) / 180
      const c = Math.cos(r)
      const s = Math.sin(r)
      const local = { x: dx * c - dz * s, z: dx * s + dz * c }

      setCoreOffset(d.index, nearestOnTrack(d.track, local))
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
  }, [controls, setCoreOffset, toGround])

  const begin = useCallback(
    (index, track, placement, event) => {
      // Left button only; right-drag stays orbit and pan.
      if (event.nativeEvent.button !== 0) return
      moved.current = false
      drag.current = {
        index,
        track,
        placement,
        startX: event.nativeEvent.clientX,
        startY: event.nativeEvent.clientY,
        moved: false,
      }
      if (controls) controls.enabled = false
    },
    [controls],
  ) as CoreDrag['begin']

  const consumeMoved = useCallback(() => {
    const was = moved.current
    moved.current = false
    return was
  }, [])

  return { begin, consumeMoved }
}
