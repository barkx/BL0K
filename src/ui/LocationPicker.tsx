import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  OSM_ATTRIBUTION,
  metresPerPixel,
  panned,
  tileUrl,
  tilesFor,
} from '../geo/tiles'
import { searchPlaces, SearchError, type Place } from '../geo/search'
import { DEFAULT_RADIUS, RADIUS_CHOICES, type GeoAnchor } from '../geo/project'

/**
 * Pick where the project is, on a map.
 *
 * The crosshair does not move: you pan the world under it, and what is under it
 * when you confirm is the site. That is one fewer thing to drag than a marker,
 * and it makes "where exactly" unambiguous at every zoom.
 *
 * The square shows how much surrounding OpenStreetMap data an import would
 * pull, so the radius is chosen against what it actually covers rather than
 * against a number in metres that means nothing until you see it.
 */
export function LocationPicker({
  initial,
  onPick,
  onClose,
}: {
  initial: GeoAnchor | null
  onPick: (picked: { lat: number; lon: number; radius: number }) => void
  onClose: () => void
}) {
  // One piece of state, because panning updates both halves together and two
  // would have to reach into each other to do it.
  const [centre, setCentre] = useState({
    lat: initial?.lat ?? 46.0569,
    lon: initial?.lon ?? 14.5058,
  })
  const [zoom, setZoom] = useState(16)
  const [radius, setRadius] = useState(initial?.radius ?? DEFAULT_RADIUS)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const frame = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Escape closes, as it does everywhere else in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Panning runs on window listeners so the drag survives the cursor leaving
  // the map, which it does constantly near the edges.
  const drag = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      drag.current = { x: e.clientX, y: e.clientY }
      setCentre((c) => panned(c.lat, c.lon, zoom, dx, dy))
    }
    const onUp = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [zoom])

  const runSearch = useCallback(async () => {
    setError(null)
    setSearching(true)
    try {
      const found = await searchPlaces(query)
      setResults(found)
      if (found.length === 0) setError('Nothing found for that.')
    } catch (e) {
      setResults([])
      setError(e instanceof SearchError ? e.message : 'The search failed.')
    } finally {
      setSearching(false)
    }
  }, [query])

  const tiles =
    size.width > 0 ? tilesFor(centre.lat, centre.lon, zoom, size.width, size.height) : []
  const boxPx = (radius * 2) / metresPerPixel(centre.lat, zoom)

  return (
    <div className="modal-scrim" onPointerDown={onClose}>
      <div
        className="picker"
        role="dialog"
        aria-label="Pick the site location"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="picker-head">
          <strong>Where is the project?</strong>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="picker-search">
          <input
            className="text"
            type="text"
            placeholder="A town, a street, a postcode"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Deliberately not searching as you type: Nominatim's usage
              // policy asks for no autocomplete and no more than one request
              // a second.
              if (e.key === 'Enter') void runSearch()
            }}
          />
          <button className="ghost" disabled={searching || query.trim().length < 3} onClick={() => void runSearch()}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {error && <div className="hint error picker-note">{error}</div>}

        {results.length > 0 && (
          <ul className="picker-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon},${r.name}`}>
                <button
                  onClick={() => {
                    setCentre({ lat: r.lat, lon: r.lon })
                    setZoom(17)
                    setResults([])
                  }}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          className="picker-map"
          ref={frame}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            drag.current = { x: e.clientX, y: e.clientY }
          }}
        >
          {tiles.map((t) => (
            <img
              key={`${t.z}/${t.x}/${t.y}`}
              src={tileUrl(t)}
              alt=""
              draggable={false}
              width={256}
              height={256}
              style={{ left: t.left, top: t.top }}
            />
          ))}
          <div
            className="picker-extent"
            style={{ width: boxPx, height: boxPx }}
            aria-hidden="true"
          />
          <div className="picker-cross" aria-hidden="true" />
          <div className="picker-zoom">
            <button
              className="ghost"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              className="ghost"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
              aria-label="Zoom out"
            >
              −
            </button>
          </div>
          <div className="picker-credit">{OSM_ATTRIBUTION}</div>
        </div>

        <div className="picker-foot">
          <div className="field">
            <div className="row">
              <label>Import area</label>
              <span className="value num" style={{ fontSize: 12 }}>
                {radius * 2} × {radius * 2} m
              </span>
            </div>
            <div className="chips">
              {RADIUS_CHOICES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={r === radius}
                  onClick={() => setRadius(r)}
                >
                  {r} m
                </button>
              ))}
            </div>
            <div className="hint">
              How much surrounding map to bring in. The square shows it.
            </div>
          </div>

          <div className="picker-actions">
            <span className="num picker-coords">
              {centre.lat.toFixed(5)}, {centre.lon.toFixed(5)}
            </span>
            <button className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="ghost primary"
              onClick={() => onPick({ lat: centre.lat, lon: centre.lon, radius })}
            >
              Use this location
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
