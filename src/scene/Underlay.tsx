import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '../store/store'
import { useGroundProjector } from './useGroundProjector'
import type { Underlay as UnderlayModel } from '../site/types'
import type { Poly } from '../lib/poly'

/**
 * Loads a data URL into a texture, disposing the previous one.
 *
 * Deliberately not `useTexture`: that suspends, and a data URL changing under a
 * suspended component tears the whole canvas down and back up, which loses the
 * camera. This just swaps the texture in place.
 */
function useDataUrlTexture(src: string | undefined) {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!src) {
      setTexture(null)
      return
    }
    let stale = false
    let loaded: Texture | null = null
    new TextureLoader().load(src, (t) => {
      if (stale) {
        t.dispose()
        return
      }
      // Without this the image renders washed out against a lit scene.
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 4
      loaded = t
      setTexture(t)
    })
    return () => {
      stale = true
      loaded?.dispose()
    }
  }, [src])

  return texture
}

/** Drag the image across the ground while it is unlocked. */
function useUnderlayDrag(underlay: UnderlayModel | null) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const updateUnderlay = useStore((s) => s.updateUnderlay)
  const toGround = useGroundProjector()
  const drag = useRef<{ grabX: number; grabZ: number } | null>(null)

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const ground = toGround(event.clientX, event.clientY)
      if (!ground) return
      updateUnderlay({ position: { x: ground.x - d.grabX, z: ground.z - d.grabZ } })
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
  }, [controls, toGround, updateUnderlay])

  return useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!underlay || underlay.locked || event.nativeEvent.button !== 0) return
      const ground = toGround(event.nativeEvent.clientX, event.nativeEvent.clientY)
      if (!ground) return
      drag.current = {
        grabX: ground.x - underlay.position.x,
        grabZ: ground.z - underlay.position.z,
      }
      if (controls) controls.enabled = false
    },
    [controls, toGround, underlay],
  )
}

/** The two points marked while setting the scale, plus the line between them. */
function CalibrationMarks({ points }: { points: Poly }) {
  const camera = useThree((s) => s.camera)
  const group = useRef<Mesh[]>([])

  const line = (() => {
    if (points.length < 2) return null
    const g = new BufferGeometry()
    g.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([points[0].x, 0.12, points[0].z, points[1].x, 0.12, points[1].z]),
        3,
      ),
    )
    return g
  })()

  useEffect(() => () => line?.dispose(), [line])

  useFrame(() => {
    for (const mesh of group.current) {
      if (!mesh) continue
      mesh.scale.setScalar(Math.max(0.35, camera.position.distanceTo(mesh.position) * 0.013))
    }
  })

  return (
    <group>
      {line && (
        <lineSegments geometry={line}>
          <lineBasicMaterial color="#b4432c" />
        </lineSegments>
      )}
      {points.map((p, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) group.current[i] = m
          }}
          position={[p.x, 0.12, p.z]}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color="#b4432c" />
        </mesh>
      ))}
    </group>
  )
}

export function Underlay() {
  const underlay = useStore((s) => s.site.underlay)
  const calibration = useStore((s) => s.calibration)
  const plotMode = useStore((s) => s.plotMode)
  const tool = useStore((s) => s.tool)
  const texture = useDataUrlTexture(underlay?.src)
  const beginDrag = useUnderlayDrag(underlay)

  const marks = plotMode === 'calibrate' ? <CalibrationMarks points={calibration} /> : null

  if (!underlay || !underlay.visible || !texture) return marks

  const height = underlay.width * underlay.aspect
  // Locked, or while tracing, the image must never intercept a ground click.
  // Outside the Site tab the image is scenery: still traced over, never nudged.
  const inert = underlay.locked || plotMode !== 'idle' || tool !== 'site'

  return (
    <>
      <mesh
        position={[underlay.position.x, 0.008, underlay.position.z]}
        rotation={[-Math.PI / 2, 0, (-underlay.rotation * Math.PI) / 180]}
        onPointerDown={inert ? undefined : beginDrag}
        raycast={inert ? () => null : undefined}
      >
        <planeGeometry args={[underlay.width, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={underlay.opacity}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      {marks}
    </>
  )
}
