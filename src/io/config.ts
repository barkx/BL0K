import { DEFAULTS, resolveParams, type Params } from '../store/params'
import { rectanglePoly, type Poly } from '../lib/poly'
import {
  DEFAULT_PLOT_DEPTH,
  DEFAULT_PLOT_WIDTH,
  makePlacement,
  type Placement,
  type Site,
  type Underlay,
} from '../site/types'

/**
 * v1: params at the top level.
 * v2: `{ version, params }` — one building, no site.
 * v3: `{ version, site }` — a plot and many placed buildings, and from M10 an
 *     optional underlay image carried inline as a data URL.
 *
 * The `app` field is informational only — the loader never reads it — so files
 * written before the BL0K rename still load unchanged.
 */
export const CONFIG_VERSION = 3

export interface SavedConfig {
  version: number
  app: 'bl0k'
  site: Site
}

export function serialize(site: Site): string {
  const payload: SavedConfig = {
    version: CONFIG_VERSION,
    app: 'bl0k',
    site,
  }
  return JSON.stringify(payload, null, 2)
}

export interface LoadResult {
  site: Site
  version: number
  /** A human note when the file had to be reshaped, else null. */
  migrated: string | null
  /** Written by a newer build than this one. */
  future: boolean
}

/** Fill any missing keys from defaults, so an older file still loads. */
function readParams(incoming: unknown): { params: Params; filled: number } {
  const source = (incoming ?? {}) as Partial<Params>
  const params = { ...DEFAULTS } as Params
  let filled = 0
  for (const key of Object.keys(DEFAULTS) as (keyof Params)[]) {
    const v = source[key]
    if (v === undefined || v === null) filled++
    else (params as unknown as Record<string, unknown>)[key] = v
  }
  if (typeof params.overrides !== 'object' || params.overrides === null) params.overrides = {}
  return { params: resolveParams(params), filled }
}

function readPlot(incoming: unknown): Poly {
  if (Array.isArray(incoming)) {
    const points = incoming
      .filter((p) => p && typeof p === 'object')
      .map((p) => ({ x: Number((p as Poly[number]).x), z: Number((p as Poly[number]).z) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z))
    if (points.length >= 3) return points
  }
  return rectanglePoly(DEFAULT_PLOT_WIDTH, DEFAULT_PLOT_DEPTH)
}

/**
 * An underlay is only restored if the image itself is there and the numbers are
 * sane. A half-read one would sit on the ground at the wrong scale looking like
 * real survey data, which is worse than no underlay at all.
 */
function readUnderlay(incoming: unknown): Underlay | null {
  if (!incoming || typeof incoming !== 'object') return null
  const u = incoming as Partial<Underlay>
  if (typeof u.src !== 'string' || !u.src.startsWith('data:image/')) return null

  const width = Number(u.width)
  const aspect = Number(u.aspect)
  if (!Number.isFinite(width) || width <= 0) return null
  if (!Number.isFinite(aspect) || aspect <= 0) return null

  const opacity = Number(u.opacity)
  return {
    src: u.src,
    name: typeof u.name === 'string' ? u.name : 'Underlay',
    width,
    aspect,
    position: { x: Number(u.position?.x) || 0, z: Number(u.position?.z) || 0 },
    rotation: Number.isFinite(Number(u.rotation)) ? Number(u.rotation) : 0,
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.05, opacity)) : 0.7,
    visible: u.visible !== false,
    locked: u.locked === true,
  }
}

function readPlacement(incoming: unknown, index: number): Placement {
  const source = (incoming ?? {}) as Partial<Placement> & { params?: unknown }
  const { params } = readParams(source.raw ?? source.params)
  return makePlacement({
    id: typeof source.id === 'string' ? source.id : undefined,
    name: typeof source.name === 'string' ? source.name : `Building ${index + 1}`,
    position: {
      x: Number(source.position?.x) || 0,
      z: Number(source.position?.z) || 0,
    },
    rotation: Number.isFinite(Number(source.rotation)) ? Number(source.rotation) : 0,
    raw: params,
    params,
  })
}

/**
 * Migrate rather than reject. A v1 or v2 file describes a single building with
 * no site, so it becomes a one-building site on a default plot. A file from a
 * newer build loads with its unknown keys dropped.
 */
export function parseConfig(text: string): LoadResult {
  const raw = JSON.parse(text) as Record<string, unknown>
  const version = typeof raw.version === 'number' ? raw.version : 1

  // v3 and later
  if (raw.site && typeof raw.site === 'object') {
    const site = raw.site as Partial<Site>
    const buildings = Array.isArray(site.buildings) ? site.buildings : []
    return {
      site: {
        plot: readPlot(site.plot),
        buildings:
          buildings.length > 0
            ? buildings.map(readPlacement)
            : [makePlacement({ name: 'Building A' })],
        underlay: readUnderlay(site.underlay),
      },
      version,
      migrated: null,
      future: version > CONFIG_VERSION,
    }
  }

  // v1 and v2: one building, params only.
  const { params, filled } = readParams(raw.params ?? raw)
  return {
    site: {
      plot: rectanglePoly(DEFAULT_PLOT_WIDTH, DEFAULT_PLOT_DEPTH),
      buildings: [makePlacement({ name: 'Building A', raw: params, params })],
      underlay: null,
    },
    version,
    migrated:
      `a single building became a one-building site on a default plot` +
      (filled > 0 ? `, and ${filled} missing setting(s) took defaults` : ''),
    future: version > CONFIG_VERSION,
  }
}

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
