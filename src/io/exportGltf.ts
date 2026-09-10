import { BufferGeometry, Mesh, MeshStandardMaterial, Scene } from 'three'
import { GLTFExporter } from 'three-stdlib'
import type { Building } from '../geometry/build'
import type { Instance } from '../geometry/balcony'
import { MeshBuilder, type V3 } from '../lib/mesh'

/**
 * Instances are baked into one buffer for export. GPU instancing is a runtime
 * optimisation; a glTF that every downstream tool can open matters more here.
 */
function bake(instances: Instance[]): BufferGeometry | null {
  if (instances.length === 0) return null
  const b = new MeshBuilder()

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

export async function exportGltf(building: Building): Promise<ArrayBuffer> {
  const scene = new Scene()
  scene.name = 'ApartmentBlock'

  const wall = new MeshStandardMaterial({ name: 'Wall', color: '#c9c3b9', roughness: 0.85 })
  const glass = new MeshStandardMaterial({
    name: 'Glass',
    color: '#87a0ad',
    roughness: 0.06,
    metalness: 0.2,
    transparent: true,
    opacity: 0.45,
  })
  const slab = new MeshStandardMaterial({ name: 'Slab', color: '#bdb8b0', roughness: 0.9 })
  const metal = new MeshStandardMaterial({ name: 'Metal', color: '#8e949a', metalness: 0.85, roughness: 0.35 })
  const infill = new MeshStandardMaterial({
    name: 'Balustrade',
    color: '#a9bcc4',
    roughness: 0.1,
    transparent: true,
    opacity: 0.4,
  })

  for (const [id, g] of Object.entries(building.walls.byMass)) {
    const mesh = new Mesh(g, wall)
    mesh.name = `Walls_${id}`
    scene.add(mesh)
  }
  for (const [id, g] of Object.entries(building.roof.byMass)) {
    const mesh = new Mesh(g, wall)
    mesh.name = `Roof_${id}`
    scene.add(mesh)
  }
  const glazing = new Mesh(building.walls.glass, glass)
  glazing.name = 'Glazing'
  scene.add(glazing)

  const baked: [string, Instance[], MeshStandardMaterial][] = [
    ['BalconySlabs', building.balconies.slabs, slab],
    ['Balustrades', building.balconies.panels, infill],
    ['Handrails', building.balconies.rails, metal],
    ['Bars', building.balconies.bars, metal],
  ]
  const temporary: BufferGeometry[] = []
  for (const [name, items, material] of baked) {
    const g = bake(items)
    if (!g) continue
    temporary.push(g)
    const mesh = new Mesh(g, material)
    mesh.name = name
    scene.add(mesh)
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
    // The walls and roof buffers belong to the live building — leave those alone.
    temporary.forEach((g) => g.dispose())
    ;[wall, glass, slab, metal, infill].forEach((m) => m.dispose())
  }
}
