import type { Vec2 } from '../lib/poly'

/**
 * Where a site sits on the earth, and which way north points.
 *
 * The app's own frame is flat, metric and arbitrary — the plot is drawn wherever
 * the user drew it. This is the one piece of information that ties that frame to
 * a real place, which is what lets OSM data arrive already at true scale, and
 * what lets an exported IFC land where it belongs instead of at the origin.
 */
export interface GeoAnchor {
  /** Decimal degrees, WGS84. Positive north. */
  lat: number
  /** Decimal degrees, WGS84. Positive east. */
  lon: number
  /**
   * Degrees clockwise from the model's north to true north.
   *
   * The model's north is -Z, which is where elevation `N` faces. Zero means the
   * drawing is already oriented; 30 means true north is 30 degrees clockwise of
   * the way the plot was drawn.
   */
  trueNorth: number
  /**
   * Half-width, in metres, of the square of surrounding map this project cares
   * about. What an OSM import pulls, and what the picker draws as a box.
   */
  radius: number
}

/** The radii the picker offers. A city block, a street, a neighbourhood. */
export const RADIUS_CHOICES = [100, 250, 500, 1000] as const
export const DEFAULT_RADIUS = 250

/**
 * Metres per degree of latitude and longitude at a given latitude.
 *
 * The standard series expansions, good to about a centimetre. A sphere of
 * radius 6 371 km is the obvious shortcut and is wrong by roughly 0.2% — twenty
 * centimetres in a hundred metres, which is larger than anything else this app
 * rounds, so it is not worth the two lines it saves.
 */
function metresPerDegree(lat: number): { perLat: number; perLon: number } {
  const f = (lat * Math.PI) / 180
  return {
    perLat:
      111132.92 - 559.82 * Math.cos(2 * f) + 1.175 * Math.cos(4 * f) - 0.0023 * Math.cos(6 * f),
    perLon: 111412.84 * Math.cos(f) - 93.5 * Math.cos(3 * f) + 0.118 * Math.cos(5 * f),
  }
}

/**
 * A point on the earth, in the site's local metres.
 *
 * **A local tangent plane, not Web Mercator.** Mercator scales distance by
 * 1/cos(latitude), so at 46 degrees north a 40 m building would arrive 58 m
 * long — plausible enough to go unnoticed and wrong enough to ruin every
 * metric. A plane tangent at the anchor has no such distortion; over the
 * hundreds of metres a site spans its error is far below a metre, and this app
 * measures in metres.
 *
 * North is -Z, matching the elevation the facade builder calls `N`.
 */
export function toLocal(anchor: GeoAnchor, lat: number, lon: number): Vec2 {
  const { perLat, perLon } = metresPerDegree(anchor.lat)
  const east = (lon - anchor.lon) * perLon
  const north = (lat - anchor.lat) * perLat
  const r = (anchor.trueNorth * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  // Model east is +X and model north is -Z. True north is `trueNorth` degrees
  // clockwise of model north, so it lands at (sin, cos) in (east, north)
  // components, and true east ninety degrees clockwise of that.
  return { x: north * s + east * c, z: east * s - north * c }
}

/** The inverse, for reading a position back out as coordinates. */
export function toGeo(anchor: GeoAnchor, p: Vec2): { lat: number; lon: number } {
  const { perLat, perLon } = metresPerDegree(anchor.lat)
  const r = (anchor.trueNorth * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  // Solving the pair in `toLocal` back for north and east.
  const north = p.x * s - p.z * c
  const east = p.x * c + p.z * s
  return { lat: anchor.lat + north / perLat, lon: anchor.lon + east / perLon }
}

/**
 * The bounding box, in degrees, of a square of `radius` metres about the anchor.
 * What an Overpass query needs.
 */
export function boundsAround(anchor: GeoAnchor, radius: number) {
  const { perLat, perLon } = metresPerDegree(anchor.lat)
  const dLat = radius / perLat
  const dLon = radius / perLon
  return {
    south: anchor.lat - dLat,
    west: anchor.lon - dLon,
    north: anchor.lat + dLat,
    east: anchor.lon + dLon,
  }
}

/**
 * IFC wants an angle as degrees, minutes, seconds and millionths of a second,
 * with every part carrying the sign of the whole.
 */
export function compoundAngle(deg: number): [number, number, number, number] {
  const sign = deg < 0 ? -1 : 1
  const abs = Math.abs(deg)
  const d = Math.floor(abs)
  const m = Math.floor((abs - d) * 60)
  const sFull = (abs - d - m / 60) * 3600
  const sec = Math.floor(sFull)
  const millionths = Math.round((sFull - sec) * 1e6)
  // Rounding can carry: 59.9999999 seconds must not be written as 60.
  if (millionths >= 1e6) return normalise(sign, d, m, sec + 1, millionths - 1e6)
  return normalise(sign, d, m, sec, millionths)
}

function normalise(
  sign: number,
  d: number,
  m: number,
  s: number,
  u: number,
): [number, number, number, number] {
  if (s >= 60) {
    s -= 60
    m += 1
  }
  if (m >= 60) {
    m -= 60
    d += 1
  }
  return [sign * d, sign * m, sign * s, sign * u]
}

/** Decimal degrees, parsed from whatever a map or a GIS put on the clipboard. */
export function parseLatLon(text: string): { lat: number; lon: number } | null {
  // Handles "46.0569, 14.5058", "46.0569 14.5058" and Google's "@46.05,14.50,17z".
  const cleaned = text.replace(/^@/, '').split(/,|\s+/).filter(Boolean)
  if (cleaned.length < 2) return null
  const lat = Number(cleaned[0])
  const lon = Number(cleaned[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}
