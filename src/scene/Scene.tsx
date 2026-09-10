import { useCallback, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Grid, OrbitControls } from '@react-three/drei'
import { PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '../store/store'
import { makeMaterials, type MaterialSet } from './materials'
import { Lighting } from './Lighting'
import { Building } from './Building'
import { Plot } from './Plot'
import { useSiteDrag } from './useSiteDrag'
import type { PlacedBuilding } from '../site/build'

const VIEW_DIRECTION = new Vector3(0.62, 0.46, 0.64).normalize()

/**
 * Reframe when the site changes shape, not on every slider tick. The fit
 * solves for the bounding sphere against *both* field-of-view angles — a tall
 * narrow viewport is limited by the horizontal one, so using the vertical fov
 * alone crops the site.
 */
function CameraRig({
  shapeKey,
  radius,
  height,
  centre,
}: {
  shapeKey: string
  radius: number
  height: number
  centre: { x: number; z: number }
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const size = useThree((s) => s.size)
  const fitRequest = useStore((s) => s.fitRequest)

  const fit = useCallback(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const target = new Vector3(centre.x, height * 0.45, centre.z)
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
  }, [camera, controls, radius, height, centre.x, centre.z, size.width, size.height])

  useEffect(() => {
    fit()
    // Keyed to shape changes and explicit requests — refitting mid-drag is disorienting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeKey, fitRequest, controls])

  return null
}

/** The ground catches shadows and clears the selection when clicked. */
function Ground({
  radius,
  colour,
  shadows,
}: {
  radius: number
  colour: string
  shadows: boolean
}) {
  const selectBuilding = useStore((s) => s.selectBuilding)

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.02, 0]}
      receiveShadow={shadows}
      onPointerDown={() => selectBuilding(null)}
    >
      <circleGeometry args={[radius * 8, 64]} />
      <meshStandardMaterial color={colour} roughness={0.95} />
    </mesh>
  )
}

/**
 * Inside the Canvas so the drag hook can reach the camera and orbit controls.
 * One hook for the whole site rather than one per building — the window
 * listeners it installs should exist once.
 */
function Buildings({
  placed,
  mat,
  selectedId,
  selectedElevation,
  onSelectBuilding,
  onSelectElevation,
}: {
  placed: PlacedBuilding[]
  mat: MaterialSet
  selectedId: string | null
  selectedElevation: string | null
  onSelectBuilding: (id: string | null) => void
  onSelectElevation: (key: string | null) => void
}) {
  const drag = useSiteDrag()
  return (
    <>
      {placed.map((p) => (
        <Building
          key={p.placement.id}
          placed={p}
          mat={mat}
          selected={p.placement.id === selectedId}
          selectedElevation={selectedElevation}
          onSelectBuilding={() => onSelectBuilding(p.placement.id)}
          onSelectElevation={onSelectElevation}
          drag={drag}
        />
      ))}
    </>
  )
}

export function Scene() {
  const mode = useStore((s) => s.renderMode)
  const site = useStore((s) => s.site)
  const build = useStore((s) => s.build)
  const selectedId = useStore((s) => s.selectedId)
  const selectedElevation = useStore((s) => s.selectedElevation)
  const selectBuilding = useStore((s) => s.selectBuilding)
  const selectElevation = useStore((s) => s.selectElevation)

  const mat = useMemo(() => makeMaterials(mode), [mode])
  useEffect(() => () => mat.dispose(), [mat])

  const b = build.bounds
  const centre = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }
  const planRadius = Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2
  const radius = Math.max(12, planRadius)
  const height = Math.max(6, build.metrics.maxHeight)

  // Refit when the site's extent changes materially, not on every nudge.
  const shapeKey = `${site.buildings.length}:${Math.round(planRadius)}:${Math.round(height)}`

  const clashing = useMemo(() => {
    const names = new Set(build.metrics.clashes.flat())
    return new Set(
      build.placed.filter((p) => names.has(p.placement.name)).map((p) => p.placement.id),
    )
  }, [build.metrics.clashes, build.placed])

  return (
    <Canvas
      shadows={mat.shadows}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 36, position: [60, 45, 70] }}
    >
      <color attach="background" args={[mat.background]} />
      <fog attach="fog" args={[mat.background, radius * 6, radius * 16]} />

      <Lighting mat={mat} radius={Math.max(radius, height)} />

      <Buildings
        placed={build.placed}
        mat={mat}
        selectedId={selectedId}
        selectedElevation={selectedElevation}
        onSelectBuilding={selectBuilding}
        onSelectElevation={selectElevation}
      />

      <Plot
        plot={site.plot}
        placed={build.placed}
        selectedId={selectedId}
        clashing={clashing}
        mat={mat}
      />

      <Ground radius={radius} colour={mat.groundColor} shadows={mat.shadows} />

      {mat.mode === 'white' && (
        <ContactShadows
          position={[centre.x, 0.01, centre.z]}
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
          fadeDistance={radius * 9}
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
        maxDistance={radius * 14}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
      <CameraRig shapeKey={shapeKey} radius={radius} height={height} centre={centre} />
    </Canvas>
  )
}
