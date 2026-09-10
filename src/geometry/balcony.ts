import type { V3 } from '../lib/mesh'
import type { Params } from '../store/params'
import type { Elevation } from './elevations'
import type { FacadeModel } from './facade'

/** A unit box placed in the world. Consumed by InstancedMesh. */
export interface Instance {
  position: V3
  rotationY: number
  /** Local axes: x along the elevation, y up, z outward. */
  scale: V3
}

export const SLAB_THICKNESS = 0.22
export const RAIL_HEIGHT = 1.1
export const RAIL_CAP = 0.06
export const BAR_SIZE = 0.035
export const BAR_PITCH = 0.12
/** Above this, vertical bars stop being worth the instances. */
export const BAR_BUDGET = 60000

export interface BuiltBalconies {
  slabs: Instance[]
  /** Balustrade infill — glass or solid, depending on `balustrade`. */
  panels: Instance[]
  rails: Instance[]
  bars: Instance[]
  /** True when the bar budget blew and we fell back to solid infill. */
  barsCollapsed: boolean
}

export function buildBalconies(
  elevations: Elevation[],
  facade: FacadeModel,
  p: Params,
): BuiltBalconies {
  const byKey = new Map(elevations.map((e) => [e.key, e]))
  const slabs: Instance[] = []
  const panels: Instance[] = []
  const rails: Instance[] = []
  const bars: Instance[] = []

  const kind = p.balustrade
  const panelT = kind === 'solid' ? 0.16 : 0.03
  const useBars = kind === 'bars'

  // Cost the bars before committing to them.
  let barCount = 0
  if (useBars) {
    for (const m of facade.modules) {
      if (m.balcony === 'none') continue
      const w = m.bu1 - m.bu0
      barCount += Math.floor(w / BAR_PITCH)
      if (m.balcony === 'projecting') barCount += 2 * Math.floor(p.balconyDepth / BAR_PITCH)
    }
  }
  const barsCollapsed = useBars && barCount > BAR_BUDGET
  const drawBars = useBars && !barsCollapsed

  const P = (e: Elevation, u: number, y: number, out: number): V3 => [
    e.origin.x + e.uDir.x * u + e.normal.x * out,
    y,
    e.origin.z + e.uDir.z * u + e.normal.z * out,
  ]

  for (const m of facade.modules) {
    if (m.balcony === 'none') continue
    const e = byKey.get(m.elevKey)
    if (!e) continue

    const yaw = Math.atan2(e.normal.x, e.normal.z)
    const w = m.bu1 - m.bu0
    const uc = (m.bu0 + m.bu1) / 2
    const d = p.balconyDepth
    const yFloor = m.yBase
    const yMid = yFloor + RAIL_HEIGHT / 2
    const yCap = yFloor + RAIL_HEIGHT + RAIL_CAP / 2

    // A loggia's floor is the building slab, already cut into the wall; only a
    // projecting balcony needs a slab of its own.
    const front = m.balcony === 'projecting' ? d : 0

    if (m.balcony === 'projecting') {
      slabs.push({
        position: P(e, uc, yFloor - SLAB_THICKNESS / 2, d / 2),
        rotationY: yaw,
        scale: [w, SLAB_THICKNESS, d],
      })
    }

    const runs: { u: number; y: number; out: number; scale: V3; barsAlong: 'u' | 'out' }[] = []
    // Front infill, on every balcony.
    runs.push({
      u: uc,
      y: yMid,
      out: front - panelT / 2,
      scale: [w, RAIL_HEIGHT, panelT],
      barsAlong: 'u',
    })
    // Cheeks, only where the slab actually cantilevers.
    if (m.balcony === 'projecting') {
      runs.push({ u: m.bu0 + panelT / 2, y: yMid, out: d / 2, scale: [panelT, RAIL_HEIGHT, d], barsAlong: 'out' })
      runs.push({ u: m.bu1 - panelT / 2, y: yMid, out: d / 2, scale: [panelT, RAIL_HEIGHT, d], barsAlong: 'out' })
    }

    for (const r of runs) {
      if (!drawBars) {
        panels.push({ position: P(e, r.u, r.y, r.out), rotationY: yaw, scale: r.scale })
      } else {
        const span = r.barsAlong === 'u' ? r.scale[0] : r.scale[2]
        const n = Math.max(2, Math.floor(span / BAR_PITCH))
        const pitch = span / n
        for (let i = 0; i < n; i++) {
          const off = -span / 2 + pitch * (i + 0.5)
          const u = r.barsAlong === 'u' ? r.u + off : r.u
          const out = r.barsAlong === 'out' ? r.out + off : r.out
          bars.push({
            position: P(e, u, r.y, out),
            rotationY: yaw,
            scale: [BAR_SIZE, RAIL_HEIGHT, BAR_SIZE],
          })
        }
        // Bars need something to land in, top and bottom.
        rails.push({
          position: P(e, r.u, yFloor + 0.05, r.out),
          rotationY: yaw,
          scale: [r.scale[0], 0.08, r.scale[2]],
        })
      }
      // Capping rail reads as the handrail in every variant.
      rails.push({
        position: P(e, r.u, yCap, r.out),
        rotationY: yaw,
        scale: [
          r.barsAlong === 'u' ? r.scale[0] : r.scale[0] + 0.04,
          RAIL_CAP,
          r.barsAlong === 'out' ? r.scale[2] : r.scale[2] + 0.04,
        ],
      })
    }
  }

  return { slabs, panels, rails, bars, barsCollapsed }
}
