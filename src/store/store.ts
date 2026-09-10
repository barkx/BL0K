import { create } from 'zustand'
import { DEFAULTS, resolveParams, type FacadeOverride, type Params } from './params'
import { buildBuilding, disposeBuilding, type Building } from '../geometry/build'

interface State {
  /** Raw slider positions — what the user asked for. */
  raw: Params
  /** Resolved, mutually consistent params — what the building was built from. */
  params: Params
  building: Building
  /** Elevation key selected in the viewport, for per-face overrides. */
  selected: string | null
  /** Bumped to ask the camera to reframe. */
  fitRequest: number

  set: (patch: Partial<Params>) => void
  reset: () => void
  load: (params: Params) => void
  select: (key: string | null) => void
  fitView: () => void
  setOverride: (key: string, patch: FacadeOverride | null) => void
}

const initialParams = resolveParams(DEFAULTS)

let frame = 0
let dirty = false

export const useStore = create<State>((set, get) => {
  /**
   * Params resolve synchronously so the readouts never lag the drag, but
   * geometry rebuilds at most once per frame — never once per pixel.
   */
  const schedule = () => {
    if (dirty) return
    dirty = true
    frame = requestAnimationFrame(() => {
      dirty = false
      const previous = get().building
      const next = buildBuilding(get().params)
      set({ building: next })
      disposeBuilding(previous)
    })
  }

  const apply = (patch: Partial<Params>) => {
    const raw = { ...get().raw, ...patch }
    set({ raw, params: resolveParams(raw) })
    schedule()
  }

  return {
    raw: DEFAULTS,
    params: initialParams,
    building: buildBuilding(initialParams),
    selected: null,
    fitRequest: 0,

    set: apply,
    reset: () => {
      cancelAnimationFrame(frame)
      dirty = false
      const previous = get().building
      set({ raw: DEFAULTS, params: initialParams, building: buildBuilding(initialParams), selected: null })
      disposeBuilding(previous)
    },
    load: (params) => {
      const resolved = resolveParams(params)
      const previous = get().building
      set({ raw: params, params: resolved, building: buildBuilding(resolved), selected: null })
      disposeBuilding(previous)
    },
    select: (key) => set({ selected: key }),
    fitView: () => set({ fitRequest: get().fitRequest + 1 }),
    setOverride: (key, patch) => {
      const overrides = { ...get().raw.overrides }
      if (patch === null) delete overrides[key]
      else overrides[key] = { ...overrides[key], ...patch }
      apply({ overrides })
    },
  }
})
