/**
 * Slippy-map arithmetic, for the location picker.
 *
 * Hand-rolled rather than pulled from a library: it is thirty lines of standard
 * Web Mercator, and a map library would be a large dependency for one modal.
 *
 * **This is the one place Mercator is correct.** The projection in
 * `geo/project.ts` deliberately refuses it, because Mercator distorts distance
 * by 1/cos(latitude) and the model is measured in metres. Here the distortion
 * is the point — it is what makes the tiles square and what every tile server
 * on earth assumes. The two must not be confused, which is why they live in
 * different files.
 */

/** Tiles are 256 px square, everywhere, by convention older than the web app. */
export const TILE = 256

/** Zoom range the picker offers: a city block at 19, a region at 12. */
export const MIN_ZOOM = 12
export const MAX_ZOOM = 19

/**
 * Tile coordinates, fractional. The integer part is which tile, the fraction is
 * where within it — which is exactly what positioning a map by pixel needs.
 */
export const lonToTileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z

export function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

export const tileXToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180

export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

/**
 * Ground metres per screen pixel, which is what draws the import radius at the
 * right size. Latitude-dependent, because Mercator.
 */
export const metresPerPixel = (lat: number, z: number) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z

export interface TileRef {
  x: number
  y: number
  z: number
  /** Where the tile's top-left corner sits in the viewport, in pixels. */
  left: number
  top: number
}

/**
 * Every tile needed to cover a viewport centred on a point.
 *
 * Wraps in x so panning across the date line does not tear, and drops tiles
 * outside the y range rather than asking a server for a tile that cannot exist.
 */
export function tilesFor(
  lat: number,
  lon: number,
  z: number,
  width: number,
  height: number,
): TileRef[] {
  const n = 2 ** z
  const cx = lonToTileX(lon, z)
  const cy = latToTileY(lat, z)
  // The viewport's top-left corner, in fractional tiles.
  const x0 = cx - width / 2 / TILE
  const y0 = cy - height / 2 / TILE

  const out: TileRef[] = []
  for (let ty = Math.floor(y0); ty < y0 + height / TILE; ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = Math.floor(x0); tx < x0 + width / TILE; tx++) {
      out.push({
        x: ((tx % n) + n) % n,
        y: ty,
        z,
        left: Math.round((tx - x0) * TILE),
        top: Math.round((ty - y0) * TILE),
      })
    }
  }
  return out
}

/**
 * Pan by a pixel delta, returning the new centre.
 *
 * Done in tile space rather than by adding metres to a latitude, so a drag
 * behaves the same at every zoom and does not drift near the poles.
 */
export function panned(
  lat: number,
  lon: number,
  z: number,
  dx: number,
  dy: number,
): { lat: number; lon: number } {
  const x = lonToTileX(lon, z) - dx / TILE
  const y = latToTileY(lat, z) - dy / TILE
  const n = 2 ** z
  return {
    lat: tileYToLat(Math.min(n, Math.max(0, y)), z),
    lon: tileXToLon(((x % n) + n) % n, z),
  }
}

/**
 * The tile URL.
 *
 * OpenStreetMap's own tiles, which need no key — and whose usage policy asks
 * for attribution, forbids bulk downloading, and expects heavy use to seek
 * permission first. Hence: tiles load only while the picker is open, nothing is
 * prefetched, and the zoom range is capped.
 */
export const tileUrl = ({ x, y, z }: TileRef) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`

/** Required by the ODbL wherever the data is shown. Not decoration. */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'
