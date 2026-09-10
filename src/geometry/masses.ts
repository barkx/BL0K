import type { Rect } from '../lib/rect'

/**
 * One extruded rectangle. The building is a list of these — a single box
 * cannot express an L, a courtyard, or an offset stack.
 */
export interface Mass {
  id: string
  origin: { x: number; z: number }
  size: { length: number; depth: number }
  /** v1 is orthogonal only; a rectangle's rotation just swaps its dimensions. */
  rotation: 0 | 90 | 180 | 270
  baseFloor: number
  floors: number
}

/** Plan footprint. `origin` is the minimum corner. */
export function footprint(m: Mass): Rect {
  const swap = m.rotation === 90 || m.rotation === 270
  const dx = swap ? m.size.depth : m.size.length
  const dz = swap ? m.size.length : m.size.depth
  return { x0: m.origin.x, x1: m.origin.x + dx, z0: m.origin.z, z1: m.origin.z + dz }
}

export const massBase = (m: Mass, floorHeight: number) => m.baseFloor * floorHeight
export const massTop = (m: Mass, floorHeight: number) => (m.baseFloor + m.floors) * floorHeight

/** Highest occupied level across the building, for camera framing and metrics. */
export const topLevel = (masses: Mass[]) =>
  masses.reduce((n, m) => Math.max(n, m.baseFloor + m.floors), 0)

/** Every level index that has at least one mass on it. */
export function levels(masses: Mass[]): number[] {
  const out: number[] = []
  for (let l = 0; l < topLevel(masses); l++) {
    if (masses.some((m) => l >= m.baseFloor && l < m.baseFloor + m.floors)) out.push(l)
  }
  return out
}

/** Footprints present on a given level. */
export const footprintsAt = (masses: Mass[], level: number): Rect[] =>
  masses.filter((m) => level >= m.baseFloor && level < m.baseFloor + m.floors).map(footprint)

/** Shift all masses so the plan bounding box is centred on the world origin. */
export function centre(masses: Mass[]): Mass[] {
  if (masses.length === 0) return masses
  const rs = masses.map(footprint)
  const cx = (Math.min(...rs.map((r) => r.x0)) + Math.max(...rs.map((r) => r.x1))) / 2
  const cz = (Math.min(...rs.map((r) => r.z0)) + Math.max(...rs.map((r) => r.z1))) / 2
  return masses.map((m) => ({ ...m, origin: { x: m.origin.x - cx, z: m.origin.z - cz } }))
}

export function planBounds(masses: Mass[]): Rect {
  const rs = masses.map(footprint)
  if (rs.length === 0) return { x0: 0, x1: 0, z0: 0, z1: 0 }
  return {
    x0: Math.min(...rs.map((r) => r.x0)),
    x1: Math.max(...rs.map((r) => r.x1)),
    z0: Math.min(...rs.map((r) => r.z0)),
    z1: Math.max(...rs.map((r) => r.z1)),
  }
}
