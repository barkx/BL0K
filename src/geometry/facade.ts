import { hash01 } from '../lib/rng'
import { clamp } from '../lib/clamp'
import { PIER_MIN, type BalconyType, type Dir, type Params } from '../store/params'
import { spanIsOpen, type Elevation } from './elevations'

/** What a module actually got, once patterns and junctions had their say. */
export type ModuleBalcony = 'none' | 'projecting' | 'loggia'

/**
 * A module is the addressable unit of the facade: (elevation, floor, index).
 * Floorplans will later attach to a range of these, so the address is kept
 * explicit rather than baked into geometry.
 */
export interface ModuleSlot {
  elevKey: string
  massId: string
  dir: Dir
  /** Absolute level index, not an offset within the mass. */
  floor: number
  index: number
  u0: number
  u1: number
  /** World Y of this floor's slab. */
  yBase: number
  balcony: ModuleBalcony
  /** Balcony/loggia extent along u, when it has one. */
  bu0: number
  bu1: number
}

/** One window opening, in its elevation's (u, v) frame. */
export interface Opening {
  elevKey: string
  floor: number
  /** Module this opening belongs to — walls are built module by module. */
  moduleIndex: number
  u0: number
  u1: number
  y0: number
  y1: number
  /** Extra depth behind the wall face — non-zero at the back of a loggia. */
  setback: number
}

export interface ElevationFit {
  requested: number
  actual: number
  count: number
  /** Window width after local pier-minimum clamping, if it differs. */
  windowWidth: number
}

export interface FacadeModel {
  modules: ModuleSlot[]
  openings: Opening[]
  fit: Record<string, ElevationFit>
  glazedArea: number
  /** Plan area removed by loggia recesses — feeds back into GFA. */
  loggiaArea: number
  /** Usable outdoor area of projecting balconies. */
  balconyArea: number
  modulesPerFloor: number
}

/**
 * Modules always divide the elevation evenly: the requested width is a wish,
 * the actual width is `length / round(length / requested)`. Never a ragged
 * remainder bay.
 */
export function fitModules(length: number, requested: number) {
  const count = Math.max(1, Math.round(length / requested))
  return { count, actual: length / count }
}

const idHash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0)
  return h >>> 0
}

const DIR_INDEX: Record<Dir, number> = { N: 0, E: 1, S: 2, W: 3 }

function wantsBalcony(p: Params, pattern: string, seed: number, elev: Elevation, floor: number, index: number) {
  if (floor < p.balconyStartFloor) return false
  switch (pattern) {
    case 'every':
      return true
    case 'alternate':
      return index % 2 === 0
    case 'checkerboard':
      return (index + floor) % 2 === 0
    case 'random':
      return hash01(seed, idHash(elev.massId), DIR_INDEX[elev.dir], floor, index) < 0.55
    default:
      return true
  }
}

export function buildFacade(elevations: Elevation[], p: Params): FacadeModel {
  const modules: ModuleSlot[] = []
  const openings: Opening[] = []
  const fit: Record<string, ElevationFit> = {}
  let glazedArea = 0
  let loggiaArea = 0
  let balconyArea = 0
  let modulesOnGround = 0

  for (const e of elevations) {
    if (e.abutting) continue

    const ov = p.overrides[e.key] ?? {}
    const baseType: BalconyType = ov.balconyType ?? p.balconyType
    const pattern = ov.balconyPattern ?? p.balconyPattern
    const windows = clamp(Math.round(ov.windowsPerModule ?? p.windowsPerModule), 1, 3)

    const { count, actual } = fitModules(e.length, p.moduleWidth)
    const localWindow = Math.max(
      0.4,
      Math.min(p.windowWidth, (actual - (windows + 1) * PIER_MIN) / windows),
    )
    fit[e.key] = { requested: p.moduleWidth, actual, count, windowWidth: localWindow }

    for (let i = 0; i < e.floors; i++) {
      const floor = e.baseFloor + i
      const yBase = floor * p.floorHeight
      const open = e.openByFloor[i]

      for (let k = 0; k < count; k++) {
        const u0 = k * actual
        const u1 = u0 + actual
        // A module straddling a junction is not a facade module at all.
        if (!spanIsOpen(open, u0, u1)) continue
        if (floor === 0) modulesOnGround++

        const bWidth = actual * p.balconyWidthRatio
        const bu0 = u0 + (actual - bWidth) / 2
        const bu1 = bu0 + bWidth

        let balcony: ModuleBalcony = 'none'
        if (baseType !== 'none' && wantsBalcony(p, pattern, p.randomSeed, e, floor, k)) {
          if (baseType === 'mixed') {
            balcony =
              hash01(p.randomSeed + 7919, idHash(e.massId), DIR_INDEX[e.dir], floor, k) < 0.5
                ? 'projecting'
                : 'loggia'
          } else {
            balcony = baseType
          }
        }

        if (balcony === 'projecting') balconyArea += bWidth * p.balconyDepth
        if (balcony === 'loggia') loggiaArea += bWidth * p.balconyDepth

        modules.push({
          elevKey: e.key,
          massId: e.massId,
          dir: e.dir,
          floor,
          index: k,
          u0,
          u1,
          yBase,
          balcony,
          bu0,
          bu1,
        })

        // Openings sit inside the module, or across the back of a loggia recess.
        const [gu0, gu1] = balcony === 'loggia' ? [bu0, bu1] : [u0, u1]
        const runWidth = gu1 - gu0
        const w = Math.max(0.4, Math.min(localWindow, (runWidth - (windows + 1) * PIER_MIN) / windows))
        const pier = (runWidth - windows * w) / (windows + 1)
        const y0 = yBase + p.sillHeight
        const y1 = y0 + p.windowHeight

        for (let n = 0; n < windows; n++) {
          const wu0 = gu0 + pier + n * (w + pier)
          openings.push({
            elevKey: e.key,
            floor,
            moduleIndex: k,
            u0: wu0,
            u1: wu0 + w,
            y0,
            y1,
            setback: balcony === 'loggia' ? p.balconyDepth : 0,
          })
          glazedArea += w * p.windowHeight
        }
      }
    }
  }

  return { modules, openings, fit, glazedArea, loggiaArea, balconyArea, modulesPerFloor: modulesOnGround }
}
