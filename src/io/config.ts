import { DEFAULTS, resolveParams, type Params } from '../store/params'
import { rectanglePoly, type Poly } from '../lib/poly'
import { DEFAULT_RADIUS, type GeoAnchor } from '../geo/project'
import type { OsmContext } from '../geo/overpass'
import {
  DEFAULT_PLOT_DEPTH,
  DEFAULT_PLOT_WIDTH,
  NO_RULES,
  makePlacement,
  resolveGeo,
  resolveRules,
  type Placement,
  type Site,
  type SiteRules,
  type Underlay,
} from '../site/types'
import { PUBLIC_USES, type ProgramBand } from '../store/program'

/**
 * v1: params at the top level.
 * v2: `{ version, params }` — one building, no site.
 * v3: `{ version, site }` — a plot and many placed buildings, and from M10 an
 *     optional underlay image carried inline as a data URL.
 * v4: the site carries `rules` — the plot's planning limits. A v3 file has no
 *     rules, so it loads with every rule off, which is what it meant.
 * v8: buildings carry `program` — the runs of levels given over to something
 *     other than housing. A file without it is a building of flats, which is
 *     exactly what it described, so no bands is both the migration and the
 *     truth rather than a default standing in for one.
 * v7: the site can carry imported OpenStreetMap surroundings alongside the
 *     anchor. A file without them simply has none.
 * v6: the site can carry a geo anchor — latitude, longitude and true north.
 *     A file without one describes a site with no position, which is what it
 *     meant, so it loads with none rather than with an invented origin.
 * v5: buildings carry a core — count, placement, size, and a hand-placed
 *     position per shaft. A file written before cores existed described a
 *     building without one, so a missing `coreCount` means none rather than
 *     the default, the same bargain v3 files get over rules.
 *
 * The `app` field is informational only — the loader never reads it — so files
 * written under either earlier name, 3DBlock or BL0K, still load unchanged.
 */
export const CONFIG_VERSION = 8

export interface SavedConfig {
  version: number
  app: 'urbgen'
  site: Site
}

export function serialize(site: Site): string {
  const payload: SavedConfig = {
    version: CONFIG_VERSION,
    app: 'urbgen',
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
  // Silence is not consent to a core: only a file that names `coreCount` gets
  // the default. Otherwise loading an old scheme would quietly change its GFA
  // split and put a shaft on a roof the author never drew.
  if (source.coreCount === undefined || source.coreCount === null) params.coreCount = 0
  // An offset list of the wrong shape would place shafts at arbitrary points on
  // a track it was never measured against. `resolveParams` sizes it; this makes
  // sure what it sizes is a list of numbers and nulls.
  params.coreOffsets = Array.isArray(source.coreOffsets)
    ? source.coreOffsets.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
    : []
  // A band with a missing end or an unknown use would clamp to something the
  // author never drew, so anything malformed is dropped rather than repaired.
  // `resolveParams` then orders what is left and fits it to the floor count.
  params.program = Array.isArray(source.program)
    ? source.program.filter(
        (b): b is ProgramBand =>
          !!b &&
          typeof b === 'object' &&
          Number.isFinite((b as ProgramBand).from) &&
          Number.isFinite((b as ProgramBand).to) &&
          (PUBLIC_USES as string[]).includes((b as ProgramBand).use),
      )
    : []
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

/** Missing or unreadable rules mean no rules, never an invented limit. */
function readRules(incoming: unknown): SiteRules {
  if (!incoming || typeof incoming !== 'object') return { ...NO_RULES }
  const r = incoming as Partial<SiteRules>
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return resolveRules({
    setback: num(r.setback),
    separation: num(r.separation),
    heightCap: num(r.heightCap),
    farCap: num(r.farCap),
    coverageCap: num(r.coverageCap),
  })
}

/** No position is a perfectly good answer, and the only honest default. */
function readGeo(incoming: unknown): GeoAnchor | null {
  if (!incoming || typeof incoming !== 'object') return null
  const g = incoming as Partial<GeoAnchor>
  const lat = Number(g.lat)
  const lon = Number(g.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return resolveGeo({
    lat,
    lon,
    trueNorth: Number(g.trueNorth) || 0,
    radius: Number(g.radius) || DEFAULT_RADIUS,
  })
}

/**
 * Imported surroundings, or none. Half-read context would draw a partial
 * neighbourhood that looks like survey data, so anything malformed is dropped
 * whole rather than patched up.
 */
function readContext(incoming: unknown): OsmContext | null {
  if (!incoming || typeof incoming !== 'object') return null
  const c = incoming as Partial<OsmContext>
  if (!Array.isArray(c.ways) || c.ways.length === 0) return null
  const ways = c.ways.filter(
    (w) =>
      w &&
      Array.isArray(w.points) &&
      w.points.length >= 4 &&
      w.points.every((n) => Number.isFinite(n)),
  )
  if (ways.length === 0) return null
  return {
    ways,
    lat: Number(c.lat) || 0,
    lon: Number(c.lon) || 0,
    radius: Number(c.radius) || DEFAULT_RADIUS,
    fetchedAt: typeof c.fetchedAt === 'string' ? c.fetchedAt : '',
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
        rules: readRules(site.rules),
        geo: readGeo(site.geo),
        context: readContext(site.context),
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
      rules: { ...NO_RULES },
      geo: null,
      context: null,
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
