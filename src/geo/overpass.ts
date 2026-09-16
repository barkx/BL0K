import { boundsAround, type GeoAnchor } from './project'

/**
 * Surroundings, from OpenStreetMap via Overpass.
 *
 * Overpass needs no key, which keeps the no-credentials rule, and it answers
 * with CORS headers so a browser can ask it directly — no proxy, so still no
 * backend. Like the place search, it runs only when someone presses the button.
 *
 * **What comes back is context, and context only.** It is drawn, it is traced
 * over, and it is excluded from every metric, every clash test and every
 * export. That is partly good manners — OSM's buildings are not the scheme —
 * and partly the licence: OSM is ODbL, and putting its geometry inside an IFC
 * handed to a client would carry obligations along with it. Keeping context out
 * of exports keeps deliverables clean.
 */

export type WayKind = 'building' | 'road' | 'water' | 'rail'

export interface OsmWay {
  /**
   * Flat `[lat, lon, lat, lon, …]`, in degrees.
   *
   * Degrees rather than local metres on purpose: the anchor's true north can be
   * turned after an import, and storing the projected result would leave the
   * surroundings pointing the old way. Projection happens at build time.
   */
  points: number[]
  kind: WayKind
  /** Metres. Zero when the data does not say, and then nothing is extruded. */
  height: number
}

export interface OsmContext {
  ways: OsmWay[]
  /** What was asked for, so the UI can say what it fetched. */
  lat: number
  lon: number
  radius: number
  fetchedAt: string
}

const ENDPOINT = 'https://overpass-api.de/api/interpreter'

export class OverpassError extends Error {}

/**
 * `out geom` asks Overpass to inline each way's coordinates.
 *
 * The alternative — `out body; >; out skel qt;` — returns nodes separately and
 * leaves the caller to resolve every reference. This is one pass and no
 * bookkeeping, at the cost of a slightly larger response.
 *
 * Relations are left out of v1. A multipolygon building arrives as members
 * needing assembly, and the ways alone cover the large majority of what a site
 * has around it.
 */
function query(anchor: GeoAnchor): string {
  const b = boundsAround(anchor, anchor.radius)
  const box = `${b.south},${b.west},${b.north},${b.east}`
  // One request, not four. The public instance rate-limits per address, so
  // four clean queries would be worse for everyone than one union — and
  // `waterway=riverbank` is deprecated and was costing a clause for nothing.
  return `[out:json][timeout:25];
(
  way["building"](${box});
  way["highway"](${box});
  way["natural"="water"](${box});
  way["railway"="rail"](${box});
);
out geom;`
}

/**
 * The public Overpass instance rate-limits, and a timeout looks enough like a
 * failure that the natural reaction is to press the button again — which earns
 * a 429 on top of the 504. So the gap is enforced here rather than trusted to
 * the user.
 */
let lastCall = 0
const COOLDOWN_MS = 6000

/** Heights arrive as "12", "12 m", or not at all. Levels are the fallback. */
function heightOf(tags: Record<string, string> | undefined): number {
  if (!tags) return 0
  const direct = Number.parseFloat(tags.height ?? tags['building:height'] ?? '')
  if (Number.isFinite(direct) && direct > 0) return direct
  const levels = Number.parseFloat(tags['building:levels'] ?? '')
  // Three metres a storey: the app's own default, and near enough for context.
  if (Number.isFinite(levels) && levels > 0) return levels * 3
  return 0
}

function kindOf(tags: Record<string, string> | undefined): WayKind | null {
  if (!tags) return null
  if (tags.building) return 'building'
  if (tags.highway) return 'road'
  if (tags.natural === 'water' || tags.waterway) return 'water'
  if (tags.railway) return 'rail'
  return null
}

interface RawWay {
  type?: string
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

export async function fetchContext(
  anchor: GeoAnchor,
  signal?: AbortSignal,
): Promise<OsmContext> {
  const wait = Math.max(0, lastCall + COOLDOWN_MS - Date.now())
  if (wait > 0) {
    throw new OverpassError(
      `Give OpenStreetMap a moment — ${Math.ceil(wait / 1000)}s before asking again.`,
    )
  }
  lastCall = Date.now()

  const body = query(anchor)
  const send = async () => {
    try {
      return await fetch(ENDPOINT, {
        method: 'POST',
        body,
        signal,
        headers: { 'Content-Type': 'text/plain' },
      })
    } catch (e) {
      if (signal?.aborted) throw e
      throw new OverpassError('No answer from OpenStreetMap. Check the connection.')
    }
  }

  let response = await send()
  // A 504 from Overpass is usually a busy minute rather than a broken query —
  // the same request often succeeds seconds later. One retry, after a pause,
  // turns most of those into successes; a loop would just add to the load that
  // caused it.
  if (response.status === 504) {
    await new Promise((r) => setTimeout(r, 4000))
    if (!signal?.aborted) response = await send()
  }

  if (!response.ok) {
    // Worth telling apart: one is their load, the other is our impatience, and
    // they want opposite responses.
    if (response.status === 504) {
      throw new OverpassError(
        'OpenStreetMap timed out twice — the free service is busy. Try again shortly, or a smaller area.',
      )
    }
    if (response.status === 429) {
      throw new OverpassError('Too many requests just now. Wait half a minute and try again.')
    }
    throw new OverpassError(`OpenStreetMap returned ${response.status}.`)
  }

  const payload = (await response.json()) as { elements?: RawWay[] }
  const ways: OsmWay[] = []
  for (const el of payload.elements ?? []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry)) continue
    const kind = kindOf(el.tags)
    if (!kind) continue
    // Two points is a line; a building needs three to enclose anything.
    if (el.geometry.length < 2) continue
    if (kind === 'building' && el.geometry.length < 4) continue

    const points: number[] = []
    for (const g of el.geometry) {
      // Centimetre precision. Seven decimal places would be about a centimetre
      // of latitude anyway, and the config carries this.
      points.push(Math.round(g.lat * 1e7) / 1e7, Math.round(g.lon * 1e7) / 1e7)
    }
    ways.push({ points, kind, height: kind === 'building' ? heightOf(el.tags) : 0 })
  }

  if (ways.length === 0) {
    throw new OverpassError(
      'OpenStreetMap has nothing mapped here. Try a larger area, or check the position.',
    )
  }

  return {
    ways,
    lat: anchor.lat,
    lon: anchor.lon,
    radius: anchor.radius,
    fetchedAt: new Date().toISOString(),
  }
}

/** What was brought in, for the panel to report. */
export function summarise(context: OsmContext) {
  let buildings = 0
  let withHeight = 0
  let roads = 0
  for (const w of context.ways) {
    if (w.kind === 'building') {
      buildings++
      if (w.height > 0) withHeight++
    } else if (w.kind === 'road') roads++
  }
  return { buildings, withHeight, roads, total: context.ways.length }
}
