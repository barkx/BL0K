import { useCallback, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, OrbitControls } from '@react-three/drei'
import { PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '../store/store'
import { makeMaterials } from './materials'
import { Lighting } from './Lighting'
import { Building } from './Building'

const VIEW_DIRECTION = new Vector3(0.62, 0.46, 0.64).normalize()

/**
 * Reframe when the building changes shape, not on every slider tick. The fit
 * solves for the bounding sphere against *both* field-of-view angles — a tall
 * narrow viewport is limited by the horizontal one, so using the vertical fov
 * alone crops the building.
 */
function CameraRig({ preset, radius, height }: { preset: string; radius: number; height: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const size = useThree((s) => s.size)
  const fitRequest = useStore((s) => s.fitRequest)

  const fit = useCallback(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const target = new Vector3(0, height * 0.45, 0)
    const sphere = Math.max(6, Math.hypot(radius, height * 0.55) * 1.02)
    const vfov = (camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / Math.max(1, size.height)))
    const distance = sphere / Math.sin(Math.min(vfov, hfov) / 2)

    camera.position.copy(target).addScaledVector(VIEW_DIRECTION, distance)
    camera.near = Math.max(0.25, distance / 800)
    camera.far = distance * 8
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.copy(target)
      controls.update()
    }
  }, [camera, controls, radius, height, size.width, size.height])

  useEffect(() => {
    fit()
    // Keyed to shape changes and explicit requests — refitting mid-drag is disorienting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, fitRequest, controls])

  return null
}

export function Scene() {
  const mode = useStore((s) => s.params.renderMode)
  const preset = useStore((s) => s.params.preset)
  const bounds = useStore((s) => s.building.bounds)
  const height = useStore((s) => s.building.metrics.height)

  const mat = useMemo(() => makeMaterials(mode), [mode])
  useEffect(() => () => mat.dispose(), [mat])

  // The plan half-diagonal drives the camera fit; the scene furniture (ground,
  // fog, shadow camera) gets a floor so a small block still sits in a scene.
  const planRadius = Math.hypot(bounds.x1 - bounds.x0, bounds.z1 - bounds.z0) / 2
  const radius = Math.max(12, planRadius)

  return (
    <Canvas
      shadows={mat.shadows}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 36, position: [60, 45, 70] }}
    >
      <color attach="background" args={[mat.background]} />
      <fog attach="fog" args={[mat.background, radius * 6, radius * 14]} />

      <Lighting mat={mat} radius={Math.max(radius, height)} />
      <Building mat={mat} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow={mat.shadows}>
        <circleGeometry args={[radius * 8, 64]} />
        <meshStandardMaterial color={mat.groundColor} roughness={0.95} />
      </mesh>

      {mat.mode === 'white' && (
        <ContactShadows
          position={[0, 0.01, 0]}
          scale={radius * 4}
          resolution={1024}
          blur={2.2}
          opacity={0.5}
          far={Math.max(8, height * 0.35)}
          color="#3c3f44"
        />
      )}

      {mat.mode === 'diagram' && (
        <Grid
          position={[0, 0.005, 0]}
          args={[radius * 8, radius * 8]}
          cellSize={5}
          cellThickness={0.5}
          cellColor="#c9d2da"
          sectionSize={25}
          sectionThickness={0.9}
          sectionColor="#a7b4c0"
          fadeDistance={radius * 7}
          fadeStrength={1.4}
          infiniteGrid
        />
      )}

      {mat.showEnvironment && <Environment preset="city" background={false} />}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={radius * 12}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
      <CameraRig preset={preset} radius={planRadius} height={height} />
    </Canvas>
  )
}
