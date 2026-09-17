import {
  Color,
  DoubleSide,
  LineBasicMaterial,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three'
import type { RenderMode } from '../store/params'
import type { Use } from '../store/program'

export interface MaterialSet {
  mode: RenderMode
  /**
   * Diagram mode tints masses by their position in the stack, and a floor given
   * over to public programme by what it is for. White and PBR ignore `use`
   * entirely — a study model is white, and the programme is a reading of the
   * scheme rather than a property of its surfaces.
   */
  wall: (tintIndex: number, use?: Use) => Material
  glass: Material
  /** The core shaft. Only its overrun is ever above the roof to be seen. */
  core: Material
  /** Imported surroundings. Deliberately recessive: it is not the scheme. */
  context: Material
  contextLine: LineBasicMaterial
  slab: Material
  panel: Material
  metal: Material
  line: LineBasicMaterial
  showLines: boolean
  showEnvironment: boolean
  shadows: boolean
  background: string
  groundColor: string
  groundOpacity: number
  dispose: () => void
}

/**
 * Blueprint ramp for diagram mode, one step per level in the stack. The steps
 * are spread wide enough that two adjacent masses never read as one.
 */
const DIAGRAM_TINTS = ['#eff3f8', '#c2d3e4', '#93aecb', '#6a89ac', '#4d6a8a']

/**
 * Public programme, in the one warm hue this palette allows itself.
 *
 * Deliberately outside the blueprint ramp: a plinth has to be legible as *not
 * housing* at a glance, and another step of the same blue would read as one
 * more mass in the stack. Three tones of a single hue rather than three hues,
 * so the drawing-office palette gains one accent and not a colour wheel.
 */
const USE_TINTS: Record<Use, string | null> = {
  residential: null,
  retail: '#b9803c',
  office: '#d0a163',
  amenity: '#e3c495',
}

type Kit = Omit<MaterialSet, 'dispose'>

export function makeMaterials(mode: RenderMode): MaterialSet {
  const pool: Material[] = []
  const keep = <T extends Material>(m: T) => {
    pool.push(m)
    return m
  }

  const kit = build(mode, keep)
  return { ...kit, dispose: () => pool.forEach((m) => m.dispose()) }
}

function build(mode: RenderMode, keep: <T extends Material>(m: T) => T): Kit {
  if (mode === 'diagram') {
    const tints = DIAGRAM_TINTS.map((c) => keep(new MeshBasicMaterial({ color: new Color(c) })))
    const useTints = new Map<Use, Material>()
    for (const [use, colour] of Object.entries(USE_TINTS)) {
      if (colour) useTints.set(use as Use, keep(new MeshBasicMaterial({ color: new Color(colour) })))
    }
    return {
      mode,
      wall: (tintIndex, use) =>
        (use && useTints.get(use)) ?? tints[Math.min(tintIndex, tints.length - 1)],
      glass: keep(new MeshBasicMaterial({ color: '#4d6a8a', transparent: true, opacity: 0.55 })),
      // Darker than every mass tint, so the core reads as the one thing on the
      // roof that is not the building.
      core: keep(new MeshBasicMaterial({ color: '#33495f' })),
      context: keep(new MeshBasicMaterial({ color: '#dfe6ee' })),
      contextLine: keep(new LineBasicMaterial({ color: '#5f7d9e' })),
      slab: keep(new MeshBasicMaterial({ color: '#f4f6f8' })),
      panel: keep(new MeshBasicMaterial({ color: '#6d8caa', transparent: true, opacity: 0.4, side: DoubleSide })),
      metal: keep(new MeshBasicMaterial({ color: '#3f556b' })),
      line: keep(new LineBasicMaterial({ color: '#22303d' })),
      showLines: true,
      showEnvironment: false,
      shadows: false,
      background: '#f7f8fa',
      groundColor: '#e9edf1',
      groundOpacity: 1,
    }
  }

  if (mode === 'pbr') {
    const wall = keep(
      new MeshStandardMaterial({ color: '#c9c3b9', roughness: 0.82, metalness: 0.02 }),
    )
    return {
      mode,
      wall: () => wall,
      glass: keep(
        new MeshStandardMaterial({
          color: '#87a0ad',
          roughness: 0.06,
          metalness: 0.25,
          transparent: true,
          opacity: 0.42,
          envMapIntensity: 1.4,
        }),
      ),
      core: keep(new MeshStandardMaterial({ color: '#b3aea6', roughness: 0.93 })),
      context: keep(new MeshStandardMaterial({ color: '#b9b5ae', roughness: 0.95 })),
      contextLine: keep(new LineBasicMaterial({ color: '#5d646b' })),
      slab: keep(new MeshStandardMaterial({ color: '#bdb8b0', roughness: 0.9 })),
      panel: keep(
        new MeshStandardMaterial({
          color: '#a9bcc4',
          roughness: 0.08,
          metalness: 0.1,
          transparent: true,
          opacity: 0.36,
          side: DoubleSide,
          envMapIntensity: 1.6,
        }),
      ),
      metal: keep(new MeshStandardMaterial({ color: '#8e949a', roughness: 0.32, metalness: 0.88 })),
      line: keep(new LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.12 })),
      showLines: false,
      showEnvironment: true,
      shadows: true,
      background: '#d8dde2',
      groundColor: '#8d9298',
      groundOpacity: 1,
    }
  }

  // The classic architectural study model: matte white, soft shadow, thin ink.
  const wall = keep(new MeshStandardMaterial({ color: '#f1efec', roughness: 0.9, metalness: 0 }))
  return {
    mode,
    wall: () => wall,
    glass: keep(new MeshStandardMaterial({ color: '#b9c2c7', roughness: 0.4, metalness: 0.05 })),
    // A shade off the wall white: on a study model the core is the same
    // material, read only by its shadow and its edge.
    core: keep(new MeshStandardMaterial({ color: '#e4e1dd', roughness: 0.92 })),
    context: keep(new MeshStandardMaterial({ color: '#e3e0db', roughness: 0.96 })),
    contextLine: keep(new LineBasicMaterial({ color: '#8a8175' })),
    slab: keep(new MeshStandardMaterial({ color: '#e9e6e2', roughness: 0.9 })),
    panel: keep(
      new MeshStandardMaterial({
        color: '#dfe3e6',
        roughness: 0.35,
        transparent: true,
        opacity: 0.5,
        side: DoubleSide,
      }),
    ),
    metal: keep(new MeshStandardMaterial({ color: '#cfcdc9', roughness: 0.6, metalness: 0.2 })),
    line: keep(new LineBasicMaterial({ color: '#3a3f46', transparent: true, opacity: 0.55 })),
    showLines: true,
    showEnvironment: false,
    shadows: true,
    background: '#eceae7',
    groundColor: '#e2dfdb',
    groundOpacity: 1,
  }
}
