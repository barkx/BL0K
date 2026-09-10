import { DEFAULTS, resolveParams, type Params } from '../store/params'

export const CONFIG_VERSION = 2

export interface SavedConfig {
  version: number
  app: 'apartment-block-generator'
  params: Params
}

export function serialize(params: Params): string {
  const payload: SavedConfig = {
    version: CONFIG_VERSION,
    app: 'apartment-block-generator',
    params,
  }
  return JSON.stringify(payload, null, 2)
}

export interface LoadResult {
  params: Params
  version: number
  /** Keys the file did not carry, filled from defaults. */
  filled: string[]
  /** Written by a newer build than this one. */
  future: boolean
}

/**
 * Migrate rather than reject. An older file is missing keys, so it gets
 * defaults for them; a newer file may carry keys we do not know, which are
 * simply dropped. Either way the user gets their building back.
 */
export function parseConfig(text: string): LoadResult {
  const raw = JSON.parse(text) as Partial<SavedConfig> & Partial<Params>
  // v1 files stored params at the top level; v2 nests them under `params`.
  const incoming = (raw.params ?? raw) as Partial<Params>
  const version = typeof raw.version === 'number' ? raw.version : 1

  const params = { ...DEFAULTS } as Params
  const filled: string[] = []

  for (const key of Object.keys(DEFAULTS) as (keyof Params)[]) {
    const v = incoming[key]
    if (v === undefined || v === null) {
      filled.push(key)
    } else {
      ;(params as unknown as Record<string, unknown>)[key] = v
    }
  }
  if (typeof params.overrides !== 'object' || params.overrides === null) params.overrides = {}

  return {
    params: resolveParams(params),
    version,
    filled,
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
