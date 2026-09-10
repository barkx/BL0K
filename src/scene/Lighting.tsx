import { useMemo } from 'react'
import type { MaterialSet } from './materials'

/**
 * One directional light with a real position derived from azimuth/altitude,
 * not a hardcoded offset — a date/time control can drive these two numbers
 * later without touching the scene.
 */
export const SUN_AZIMUTH = 142
export const SUN_ALTITUDE = 46

export function sunPosition(azimuthDeg: number, altitudeDeg: number, distance: number) {
  const az = (azimuthDeg * Math.PI) / 180
  const al = (altitudeDeg * Math.PI) / 180
  return [
    distance * Math.cos(al) * Math.sin(az),
    distance * Math.sin(al),
    distance * Math.cos(al) * Math.cos(az),
  ] as [number, number, number]
}

export function Lighting({ mat, radius }: { mat: MaterialSet; radius: number }) {
  const sun = useMemo(() => sunPosition(SUN_AZIMUTH, SUN_ALTITUDE, radius * 2.2), [radius])

  if (mat.mode === 'diagram') {
    return (
      <>
        <ambientLight intensity={0.95} />
        <directionalLight position={sun} intensity={0.25} />
      </>
    )
  }

  const extent = radius * 1.35

  return (
    <>
      <hemisphereLight args={['#eef2f6', '#9a958e', mat.mode === 'pbr' ? 0.35 : 0.75]} />
      <ambientLight intensity={mat.mode === 'pbr' ? 0.15 : 0.45} />
      <directionalLight
        position={sun}
        intensity={mat.mode === 'pbr' ? 2.4 : 1.5}
        castShadow={mat.shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={radius * 6}
      />
      {/* A cool fill from the opposite side keeps north elevations readable. */}
      <directionalLight position={[-sun[0], sun[1] * 0.5, -sun[2]]} intensity={0.35} color="#cddbe8" />
    </>
  )
}
