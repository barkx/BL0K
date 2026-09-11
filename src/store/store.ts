import { create } from 'zustand'
import { DEFAULTS, resolveParams, type FacadeOverride, type Params, type RenderMode } from './params'
import { buildSite, disposeReplaced, disposeSite, type SiteBuild } from '../site/build'
import {
  defaultSite,
  makePlacement,
  nextId,
  suggestName,
  type Placement,
  type Site,
} from '../site/types'
import { rectanglePoly, type Poly, type Vec2 } from '../lib/poly'

interface State {
  site: Site
  build: SiteBuild
  /** Which building the parameter sidebar edits. */
  selectedId: string | null
  /** Elevation key within the selected building, for per-face overrides. */
  selectedElevation: string | null
  /** Bumped to ask the camera to reframe. */
  fitRequest: number
  /** A view setting, not a property of any one building. */
  renderMode: RenderMode
  /** Tracing a new boundary, or editing the existing one. */
  plotMode: 'idle' | 'draw'
  /** Points collected so far while tracing. */
  plotDraft: Poly

  selectBuilding: (id: string | null) => void
  selectElevation: (key: string | null) => void

  /** Edits the selected building's parameters. */
  set: (patch: Partial<Params>) => void
  setOverride: (key: string, patch: FacadeOverride | null) => void

  move: (id: string, position: Vec2) => void
  rotate: (id: string, degrees: number) => void
  rename: (id: string, name: string) => void
  addBuilding: () => void
  duplicateBuilding: (id: string) => void
  removeBuilding: (id: string) => void

  setPlotRect: (width: number, depth: number) => void
  startPlotDraw: () => void
  addDraftPoint: (point: Vec2) => void
  undoDraftPoint: () => void
  finishPlotDraw: () => void
  cancelPlotDraw: () => void
  movePlotVertex: (index: number, point: Vec2) => void
  insertPlotVertex: (index: number, point: Vec2) => void
  removePlotVertex: (index: number) => void
  setRenderMode: (mode: RenderMode) => void

  reset: () => void
  loadSite: (site: Site) => void
  fitView: () => void
}

const initialSite = defaultSite()

let frame = 0
let dirty = false

export const useStore = create<State>((set, get) => {
  /**
   * Params resolve synchronously so the readouts never lag a drag, but geometry
   * rebuilds at most once per frame. `buildSite` reuses the buffers of any
   * building whose params object is unchanged, so dragging one block around
   * does not regenerate the rest of the plot.
   */
  const schedule = () => {
    if (dirty) return
    dirty = true
    frame = requestAnimationFrame(() => {
      dirty = false
      const previous = get().build
      const next = buildSite(get().site, previous)
      set({ build: next })
      disposeReplaced(previous, next)
    })
  }

  /** Commit a new site and schedule the rebuild. */
  const commit = (site: Site) => {
    set({ site })
    schedule()
  }

  const mapBuilding = (id: string, fn: (b: Placement) => Placement) => {
    const site = get().site
    commit({ ...site, buildings: site.buildings.map((b) => (b.id === id ? fn(b) : b)) })
  }

  const rebuildNow = (site: Site, selectedId: string | null) => {
    cancelAnimationFrame(frame)
    dirty = false
    const previous = get().build
    const next = buildSite(site, null)
    set({ site, build: next, selectedId, selectedElevation: null })
    disposeSite(previous)
  }

  return {
    site: initialSite,
    build: buildSite(initialSite, null),
    selectedId: initialSite.buildings[0]?.id ?? null,
    selectedElevation: null,
    fitRequest: 0,
    renderMode: 'white',
    plotMode: 'idle',
    plotDraft: [],

    selectBuilding: (id) => set({ selectedId: id, selectedElevation: null }),
    selectElevation: (key) => set({ selectedElevation: key }),

    set: (patch) => {
      const id = get().selectedId
      if (!id) return
      mapBuilding(id, (b) => {
        const raw = { ...b.raw, ...patch }
        return { ...b, raw, params: resolveParams(raw) }
      })
    },

    setOverride: (key, patch) => {
      const id = get().selectedId
      if (!id) return
      mapBuilding(id, (b) => {
        const overrides = { ...b.raw.overrides }
        if (patch === null) delete overrides[key]
        else overrides[key] = { ...overrides[key], ...patch }
        const raw = { ...b.raw, overrides }
        return { ...b, raw, params: resolveParams(raw) }
      })
    },

    // Placement changes keep the same `params` object, so no building is rebuilt.
    move: (id, position) => mapBuilding(id, (b) => ({ ...b, position })),
    rotate: (id, degrees) => mapBuilding(id, (b) => ({ ...b, rotation: degrees })),
    rename: (id, name) => mapBuilding(id, (b) => ({ ...b, name })),

    addBuilding: () => {
      const site = get().site
      // Drop it clear of the last building rather than on top of it.
      const last = site.buildings[site.buildings.length - 1]
      const offset = last ? { x: last.position.x + 45, z: last.position.z } : { x: 0, z: 0 }
      const placement = makePlacement({ name: suggestName(site.buildings), position: offset })
      commit({ ...site, buildings: [...site.buildings, placement] })
      set({ selectedId: placement.id, selectedElevation: null })
    },

    duplicateBuilding: (id) => {
      const site = get().site
      const source = site.buildings.find((b) => b.id === id)
      if (!source) return
      const copy: Placement = {
        ...source,
        id: nextId(),
        name: suggestName(site.buildings),
        position: { x: source.position.x + 30, z: source.position.z },
      }
      commit({ ...site, buildings: [...site.buildings, copy] })
      set({ selectedId: copy.id, selectedElevation: null })
    },

    removeBuilding: (id) => {
      const site = get().site
      if (site.buildings.length <= 1) return
      const buildings = site.buildings.filter((b) => b.id !== id)
      commit({ ...site, buildings })
      if (get().selectedId === id) {
        set({ selectedId: buildings[0]?.id ?? null, selectedElevation: null })
      }
    },

    setPlotRect: (width, depth) => {
      const site = get().site
      commit({ ...site, plot: rectanglePoly(width, depth) })
    },

    // --- tracing a new boundary ---------------------------------------------
    startPlotDraw: () => set({ plotMode: 'draw', plotDraft: [], selectedId: null, selectedElevation: null }),
    addDraftPoint: (point) => set({ plotDraft: [...get().plotDraft, point] }),
    undoDraftPoint: () => set({ plotDraft: get().plotDraft.slice(0, -1) }),
    cancelPlotDraw: () => set({ plotMode: 'idle', plotDraft: [] }),

    finishPlotDraw: () => {
      const draft = get().plotDraft
      // Fewer than three points is not a plot; keep drawing rather than commit.
      if (draft.length < 3) return
      const site = get().site
      set({ plotMode: 'idle', plotDraft: [] })
      commit({ ...site, plot: draft })
    },

    // --- editing the existing boundary ---------------------------------------
    movePlotVertex: (index, point) => {
      const site = get().site
      if (index < 0 || index >= site.plot.length) return
      const plot = site.plot.map((p, i) => (i === index ? point : p))
      commit({ ...site, plot })
    },

    insertPlotVertex: (index, point) => {
      const site = get().site
      const plot = [...site.plot]
      plot.splice(index + 1, 0, point)
      commit({ ...site, plot })
    },

    removePlotVertex: (index) => {
      const site = get().site
      // A polygon needs three corners; refuse to go below that.
      if (site.plot.length <= 3) return
      commit({ ...site, plot: site.plot.filter((_, i) => i !== index) })
    },

    reset: () => {
      const fresh = defaultSite()
      rebuildNow(fresh, fresh.buildings[0]?.id ?? null)
    },

    loadSite: (site) => rebuildNow(site, site.buildings[0]?.id ?? null),

    setRenderMode: (renderMode) => set({ renderMode }),

    fitView: () => set({ fitRequest: get().fitRequest + 1 }),
  }
})

/** The selected building, or undefined. */
export const useSelected = () =>
  useStore((s) => s.site.buildings.find((b) => b.id === s.selectedId))

/** The selected building's resolved params, falling back to defaults. */
export const useSelectedParams = () =>
  useStore((s) => s.site.buildings.find((b) => b.id === s.selectedId)?.params ?? DEFAULTS)

export const useSelectedRaw = () =>
  useStore((s) => s.site.buildings.find((b) => b.id === s.selectedId)?.raw ?? DEFAULTS)
