import { create } from 'zustand'
import {
  clearsCorePlacement,
  DEFAULTS,
  resolveParams,
  type FacadeOverride,
  type Params,
  type RenderMode,
} from './params'
import { buildSite, disposeReplaced, disposeSite, type SiteBuild } from '../site/build'
import {
  defaultSite,
  makePlacement,
  nextId,
  resolveGeo,
  resolveRules,
  suggestName,
  type Placement,
  type Site,
  type SiteRules,
  type Underlay,
} from '../site/types'
import { rectanglePoly, type Poly, type Vec2 } from '../lib/poly'
import type { GeoAnchor } from '../geo/project'
import type { OsmContext } from '../geo/overpass'

/**
 * The sidebar section, which is also the active tool.
 *
 * It lives in the store rather than in the sidebar because the viewport reads
 * it: a tab decides which handles are on screen and what a press means. That is
 * the whole point — one place to ask "what does a click do right now" instead of
 * a precedence ladder inside every pointer handler.
 */
export type Tool =
  | 'site'
  | 'placement'
  | 'massing'
  | 'program'
  | 'facade'
  | 'units'
  | 'settings'

interface State {
  site: Site
  /** Which section is open, and so which editing gestures are live. */
  tool: Tool
  build: SiteBuild
  /** Which building the parameter sidebar edits. */
  selectedId: string | null
  /** Elevation key within the selected building, for per-face overrides. */
  selectedElevation: string | null
  /** Bumped to ask the camera to reframe. */
  fitRequest: number
  /** A view setting, not a property of any one building. */
  renderMode: RenderMode
  /**
   * What a click on the ground means: nothing special, placing a boundary
   * corner, or dropping one of the two calibration points.
   */
  plotMode: 'idle' | 'draw' | 'calibrate'
  /** Points collected so far while tracing. */
  plotDraft: Poly
  /** The two points whose real-world distance sets the underlay scale. */
  calibration: Poly

  setTool: (tool: Tool) => void
  selectBuilding: (id: string | null) => void
  selectElevation: (key: string | null) => void

  /** Edits the selected building's parameters. */
  set: (patch: Partial<Params>) => void
  setOverride: (key: string, patch: FacadeOverride | null) => void
  /** Position one core along its track, 0 to 1. `null` returns it to automatic. */
  setCoreOffset: (index: number, t: number | null) => void
  /** Every core back to the even spread. */
  resetCoreOffsets: () => void

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

  setRules: (patch: Partial<SiteRules>) => void
  /** Where on the earth the site sits. Null clears it. */
  setGeo: (geo: GeoAnchor | null) => void
  /** Imported OpenStreetMap surroundings. Null clears them. */
  setContext: (context: OsmContext | null) => void

  setUnderlay: (underlay: Underlay | null) => void
  updateUnderlay: (patch: Partial<Underlay>) => void
  startCalibration: () => void
  addCalibrationPoint: (point: Vec2) => void
  cancelCalibration: () => void
  applyCalibration: (realDistance: number) => void
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
    tool: 'site',
    selectedId: initialSite.buildings[0]?.id ?? null,
    selectedElevation: null,
    fitRequest: 0,
    renderMode: 'white',
    plotMode: 'idle',
    plotDraft: [],
    calibration: [],

    /**
     * Leaving a tab puts away what belonged to it. A half-drawn boundary or a
     * face override left live under another tool would be a mode you cannot
     * see, which is the failure this whole arrangement exists to avoid.
     */
    setTool: (tool) => {
      const was = get().tool
      if (was === tool) return
      const next: Partial<State> = { tool }
      if (was === 'site') {
        next.plotMode = 'idle'
        next.plotDraft = []
        next.calibration = []
      }
      if (was === 'facade') next.selectedElevation = null
      set(next)
    },

    selectBuilding: (id) => set({ selectedId: id, selectedElevation: null }),
    selectElevation: (key) => set({ selectedElevation: key }),

    set: (patch) => {
      const id = get().selectedId
      if (!id) return
      mapBuilding(id, (b) => {
        const raw = { ...b.raw, ...patch }
        // Hand-placed cores are positions on a track the massing defines. Edit
        // the massing and those numbers point at a path that no longer exists.
        if (clearsCorePlacement(patch)) raw.coreOffsets = raw.coreOffsets.map(() => null)
        return { ...b, raw, params: resolveParams(raw) }
      })
    },

    /**
     * A dragged core is the one thing about a building the geometry cannot
     * derive, so it is stored as a position on the track rather than a point in
     * space — resize the block and the shaft stays where it was put, relative
     * to the wall it is on.
     */
    setCoreOffset: (index, t) => {
      const id = get().selectedId
      if (!id) return
      mapBuilding(id, (b) => {
        const coreOffsets = [...b.raw.coreOffsets]
        coreOffsets[index] = t === null ? null : Math.min(1, Math.max(0, t))
        const raw = { ...b.raw, coreOffsets }
        return { ...b, raw, params: resolveParams(raw) }
      })
    },

    resetCoreOffsets: () => {
      const id = get().selectedId
      if (!id) return
      mapBuilding(id, (b) => {
        const raw = { ...b.raw, coreOffsets: b.raw.coreOffsets.map(() => null) }
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
    startPlotDraw: () =>
      set({ plotMode: 'draw', plotDraft: [], calibration: [], selectedId: null, selectedElevation: null }),
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

    /**
     * Rules change no geometry, but the breach list is part of the metrics, so
     * this goes through `commit` like any other site edit. Nothing rebuilds:
     * every `params` object keeps its identity.
     */
    setRules: (patch) => {
      const site = get().site
      commit({ ...site, rules: resolveRules({ ...site.rules, ...patch }) })
    },

    /**
     * Changes no geometry: the anchor ties the existing local frame to a real
     * place rather than moving anything. It still goes through `commit` so the
     * exports and any future context see it on the next frame.
     */
    setGeo: (geo) => {
      const site = get().site
      commit({ ...site, geo: geo === null ? null : resolveGeo(geo) })
    },

    setContext: (context) => {
      const site = get().site
      commit({ ...site, context })
    },

    reset: () => {
      const fresh = defaultSite()
      rebuildNow(fresh, fresh.buildings[0]?.id ?? null)
    },

    loadSite: (site) => rebuildNow(site, site.buildings[0]?.id ?? null),

    // --- underlay -----------------------------------------------------------
    setUnderlay: (underlay) => {
      const site = get().site
      set({ plotMode: 'idle', calibration: [] })
      commit({ ...site, underlay })
    },

    updateUnderlay: (patch) => {
      const site = get().site
      if (!site.underlay) return
      commit({ ...site, underlay: { ...site.underlay, ...patch } })
    },

    startCalibration: () => {
      if (!get().site.underlay) return
      set({ plotMode: 'calibrate', calibration: [], plotDraft: [] })
    },

    addCalibrationPoint: (point) => {
      const points = get().calibration
      if (points.length >= 2) return
      set({ calibration: [...points, point] })
    },

    cancelCalibration: () => set({ plotMode: 'idle', calibration: [] }),

    /**
     * Rescale the underlay so the two marked points are `realDistance` apart.
     * The scaling is about their midpoint, so whatever you measured stays put
     * instead of sliding away as the image grows.
     */
    applyCalibration: (realDistance) => {
      const { site, calibration } = get()
      if (!site.underlay || calibration.length < 2 || !(realDistance > 0)) return
      const [a, b] = calibration
      const measured = Math.hypot(b.x - a.x, b.z - a.z)
      if (measured < 1e-6) return

      const factor = realDistance / measured
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
      const underlay: Underlay = {
        ...site.underlay,
        width: site.underlay.width * factor,
        position: {
          x: mid.x + (site.underlay.position.x - mid.x) * factor,
          z: mid.z + (site.underlay.position.z - mid.z) * factor,
        },
      }
      set({ plotMode: 'idle', calibration: [] })
      commit({ ...site, underlay })
    },

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
