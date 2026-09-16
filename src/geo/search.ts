/**
 * Place search, through Nominatim.
 *
 * The app's first outbound request, and deliberately the only kind: it happens
 * when someone types a place and presses Enter, never on load, never on a
 * keystroke, never in the background. Everything else in URBGEN still works
 * with the network unplugged.
 *
 * Nominatim is free and needs no key, which keeps the no-credentials rule. Its
 * usage policy asks for no more than one request a second and no
 * autocomplete-as-you-type — so the throttle below is a term of use rather than
 * a nicety, and the caller must not wire this to `onChange`.
 */

export interface Place {
  name: string
  lat: number
  lon: number
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

/** Nominatim asks for a second between requests. This enforces it. */
let lastCall = 0
const GAP_MS = 1100

export class SearchError extends Error {}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const wait = Math.max(0, lastCall + GAP_MS - Date.now())
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  const url = `${ENDPOINT}?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`
  let response: Response
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    // An abort is the caller changing its mind, not a failure.
    if (signal?.aborted) throw e
    throw new SearchError('No answer from the search service. Check the connection.')
  }
  if (!response.ok) {
    throw new SearchError(
      response.status === 429
        ? 'The search service is rate limiting. Wait a moment and try again.'
        : `The search service returned ${response.status}.`,
    )
  }

  const raw: unknown = await response.json()
  if (!Array.isArray(raw)) return []
  return raw
    .map((r) => {
      const item = r as { display_name?: unknown; lat?: unknown; lon?: unknown }
      const lat = Number(item.lat)
      const lon = Number(item.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return { name: String(item.display_name ?? 'Unnamed place'), lat, lon }
    })
    .filter((p): p is Place => p !== null)
}
