import { BufferGeometry, Group, Mesh, MeshStandardMaterial, Scene } from 'three'
import { GLTFExporter } from 'three-stdlib'
import type { SiteBuild } from '../site/build'
import type { Instance } from '../geometry/balcony'
import { MeshBuilder, type V3 } from '../lib/mesh'

/**
 * Instances are baked into one buffer for export. GPU instancing is a runtime
 * optimisation; a glTF that every downstream tool can open matters more here.
 */
function bake(instances: Instance[]): BufferGeometry | null {
  if (instances.length === 0) return null
  const b = new MeshBuilder(instances.length * 6)

  for (const it of instances) {
    const [px, py, pz] = it.position
    const [sx, sy, sz] = it.scale
    const c = Math.cos(it.rotationY)
    const s = Math.sin(it.rotationY)
    // Local axes (x along the elevation, y up, z outward) rotated about Y.
    const at = (lx: number, ly: number, lz: number): V3 => [
      px + lx * c + lz * s,
      py + ly,
      pz - lx * s + lz * c,
    ]
    const dir = (lx: number, lz: number): V3 => [lx * c + lz * s, 0, -lx * s + lz * c]
    const hx = sx / 2
    const hy = sy / 2
    const hz = sz / 2

    b.quad(at(hx, -hy, -hz), at(hx, -hy, hz), at(hx, hy, hz), at(hx, hy, -hz), dir(1, 0))
    b.quad(at(-hx, -hy, hz), at(-hx, -hy, -hz), at(-hx, hy, -hz), at(-hx, hy, hz), dir(-1, 0))
    b.quad(at(-hx, hy, -hz), at(hx, hy, -hz), at(hx, hy, hz), at(-hx, hy, hz), [0, 1, 0])
    b.quad(at(-hx, -hy, hz), at(hx, -hy, hz), at(hx, -hy, -hz), at(-hx, -hy, -hz), [0, -1, 0])
    b.quad(at(-hx, -hy, hz), at(-hx, hy, hz), at(hx, hy, hz), at(hx, -hy, hz), dir(0, 1))
    b.quad(at(hx, -hy, -hz), at(hx, hy, -hz), at(-hx, hy, -hz), at(-hx, -hy, -hz), dir(0, -1))
  }

  return b.toGeometry()
}

function makeMaterials() {
  return {
    wall: new MeshStandardMaterial({ name: 'Wall', color: '#c9c3b9', roughness: 0.85 }),
    glass: new MeshStandardMaterial({
      name: 'Glass',
      color: '#87a0ad',
      roughness: 0.06,
      metalness: 0.2,
      transparent: true,
      opacity: 0.45,
    }),
    slab: new MeshStandardMaterial({ name: 'Slab', color: '#bdb8b0', roughness: 0.9 }),
    metal: new MeshStandardMaterial({
      name: 'Metal',
      color: '#8e949a',
      metalness: 0.85,
      roughness: 0.35,
    }),
    infill: new MeshStandardMaterial({
      name: 'Balustrade',
      color: '#a9bcc4',
      roughness: 0.1,
      transparent: true,
      opacity: 0.4,
    }),
  }
}

/**
 * The whole site as one binary glTF: a named group per building, positioned and
 * rotated exactly as on the plot, so it drops into Rhino, Blender or a viewer
 * with the layout intact.
 */
export async function exportSiteGltf(build: SiteBuild): Promise<ArrayBuffer> {
  const scene = new Scene()
  scene.name = 'Site'

  const m = makeMaterials()
  const temporary: BufferGeometry[] = []

  for (const { placement, building } of build.placed) {
    const group = new Group()
    group.name = placement.name.replace(/\s+/g, '_')
    group.position.set(placement.position.x, 0, placement.position.z)
    group.rotation.y = (placement.rotation * Math.PI) / 180

    for (const [id, g] of Object.entries(building.walls.byMass)) {
      const mesh = new Mesh(g, m.wall)
      mesh.name = `Walls_${id}`
      group.add(mesh)
    }
    for (const [id, g] of Object.entries(building.roof.byMass)) {
      const mesh = new Mesh(g, m.wall)
      mesh.name = `Roof_${id}`
      group.add(mesh)
    }
    const glazing = new Mesh(building.walls.glass, m.glass)
    glazing.name = 'Glazing'
    group.add(glazing)

    const baked: [string, Instance[], MeshStandardMaterial][] = [
      ['BalconySlabs', building.balconies.slabs, m.slab],
      ['Balustrades', building.balconies.panels, m.infill],
      ['Handrails', building.balconies.rails, m.metal],
      ['Bars', building.balconies.bars, m.metal],
    ]
    for (const [name, items, material] of baked) {
      const g = bake(items)
      if (!g) continue
      temporary.push(g)
      const mesh = new Mesh(g, material)
      mesh.name = name
      group.add(mesh)
    }

    scene.add(group)
  }

  try {
    const exporter = new GLTFExporter()
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        scene,
        (result) => resolve(result as ArrayBuffer),
        (err) => reject(err),
        { binary: true },
      )
    })
  } finally {
    // The wall, roof and glass buffers belong to the live site — leave those.
    temporary.forEach((g) => g.dispose())
    Object.values(m).forEach((mat) => mat.dispose())
  }
}
