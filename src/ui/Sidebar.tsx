import { useRef, useState } from 'react'
import { Slider } from './Slider'
import { Block, Chips, Select } from './Field'
import { useSelectedParams, useStore, type Tool } from '../store/store'
import { PRESET_LABELS, PRESET_WINGS } from '../store/presets'
import { DEFAULT_TOP_SETBACK } from '../store/params'
import { spineCrosses } from '../geometry/spine'
import type {
  Params,
  BalconyPattern,
  BalconyType,
  BalustradeKind,
  CorePlacement,
  Preset,
  RenderMode,
} from '../store/params'
import { mm } from '../lib/units'
import { download, parseConfig, serialize, stamp } from '../io/config'
import { siteCsv } from '../io/exportCsv'
import { siteIfc, SLAB_THICKNESS, WALL_THICKNESS } from '../io/exportIfc'
import {
  BuildingList,
  LocationControls,
  PlacementControls,
  PlotControls,
  RuleControls,
} from './SitePanel'
import { UnderlayPanel } from './UnderlayPanel'
import { ProgramPanel } from './ProgramPanel'
import { UnitMixPanel } from './UnitMixPanel'
import { DrawingsPanel } from './DrawingsPanel'
import {
  IconDrawings,
  IconFacade,
  IconMassing,
  IconPlacement,
  IconProgram,
  IconSettings,
  IconSite,
  IconUnits,
} from './Icons'

/**
 * The six shapes, without the drawn one.
 *
 * Freeform sits below on its own rather than as a seventh chip. It is not
 * another footprint of the same standing: it reaches parts of the app that
 * still measure a bounding box, so it belongs behind a label that says as much
 * rather than beside six settled options.
 */
const PRESETS = Object.entries(PRESET_LABELS)
  .filter(([value]) => value !== 'freeform')
  .map(([value, label]) => ({ value: value as Preset, label }))

const BALCONY_TYPES: { value: BalconyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'projecting', label: 'Projecting' },
  { value: 'loggia', label: 'Loggia' },
  { value: 'mixed', label: 'Mixed' },
]

const PATTERNS: { value: BalconyPattern; label: string }[] = [
  { value: 'every', label: 'Every module' },
  { value: 'alternate', label: 'Alternate modules' },
  { value: 'checkerboard', label: 'Checkerboard' },
  { value: 'random', label: 'Random (seeded)' },
]

const BALUSTRADES: { value: BalustradeKind; label: string }[] = [
  { value: 'glass', label: 'Glass' },
  { value: 'solid', label: 'Solid' },
  { value: 'bars', label: 'Bars' },
]

const CORE_PLACEMENTS: { value: CorePlacement; label: string }[] = [
  { value: 'perimeter', label: 'On the perimeter' },
  { value: 'centre', label: 'In the centre' },
]

/**
 * The roof is flat unless somebody asks otherwise, so the setback is behind a
 * choice rather than sitting in the panel as though every building had one.
 *
 * Which chip is lit is read straight off `topSetback` instead of a flag of its
 * own: two pieces of state for one fact is two pieces of state that can
 * disagree, and dragging the slider back to zero would then leave a building
 * with "Setback top" selected and a flat roof.
 */
const ROOF_KINDS: { value: 'flat' | 'setback'; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'setback', label: 'Setback top' },
]

const MODES: { value: RenderMode; label: string }[] = [
  { value: 'white', label: 'White' },
  { value: 'pbr', label: 'PBR' },
  { value: 'diagram', label: 'Diagram' },
]

/**
 * The viewport as a PNG, at whatever size it is on screen.
 *
 * Reaches for the canvas by selector rather than through a ref: the canvas
 * belongs to R3F inside `<Scene>`, and threading a ref up through the app just
 * to serve one button would be more coupling than the button is worth.
 */
function saveImage() {
  const canvas = document.querySelector('.viewport canvas') as HTMLCanvasElement | null
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (blob) download(`urbgen-${stamp()}.png`, blob, 'image/png')
  }, 'image/png')
}

/**
 * Freeform, kept deliberately apart from the presets.
 *
 * Kept apart from the presets because it is the newest and least worn-in way to
 * shape a building, not because the numbers are suspect: since stage 3 the
 * area, roof, core track, setback and floor plan all read the real outline
 * rather than the box around it.
 */
function FreeformChoice() {
  const p = useSelectedParams()
  const set = useStore((s) => s.set)
  const on = p.preset === 'freeform'

  return (
    <>
      <div className="field">
        <div className="row">
          <label>Experimental</label>
        </div>
        <div className="chips">
          <button
            type="button"
            aria-pressed={on}
            onClick={() => set({ preset: on ? 'bar' : 'freeform' })}
          >
            Freeform
          </button>
        </div>
        {!on && (
          <div className="hint">
            Draw the plan yourself instead of picking a shape. Wings meet at any
            angle.
          </div>
        )}
      </div>
      {on && (
        <>
          <SpineControls />
          <div className="field">
            <div className="hint">
              Area, roof, core track, setback and the floor-plan drawing all
              follow the real outline, so the numbers hold at any angle. Still
              marked experimental because it is the newest way to shape a
              building and the least worn in.
            </div>
          </div>
        </>
      )}
    </>
  )
}

/**
 * Tracing a building's plan.
 *
 * The centreline is drawn on the ground with the same three keys the boundary
 * uses, because it is the same gesture and a second vocabulary for it would be
 * one to learn for nothing.
 */
function SpineControls() {
  const plotMode = useStore((s) => s.plotMode)
  const startSpineDraw = useStore((s) => s.startSpineDraw)
  const cancelPlotDraw = useStore((s) => s.cancelPlotDraw)
  const draft = useStore((s) => s.plotDraft)
  const p = useSelectedParams()
  const drawing = plotMode === 'spine'
  const legs = Math.max(0, p.spine.length - 1)

  return (
    <>
      <div className="stack">
        <button className="ghost" onClick={drawing ? cancelPlotDraw : startSpineDraw}>
          {drawing ? 'Cancel' : p.spine.length > 0 ? 'Draw it again' : 'Draw a plan'}
        </button>
        <div className="hint">
          {drawing
            ? `${draft.length} point${draft.length === 1 ? '' : 's'} — Enter builds it, Backspace undoes, Esc cancels.`
            : legs > 0
              ? `${legs} leg${legs === 1 ? '' : 's'}, each the depth below. Corners are mitred, so the wings meet cleanly at any angle.`
              : 'Trace a centreline on the ground and the building follows it. Until then this is a plain bar.'}
        </div>
      </div>
      {!drawing && spineWarning(p.spine)}
    </>
  )
}

function spineWarning(spine: Params['spine']) {
  if (spine.length < 2 || !spineCrosses(spine)) return null
  return (
    <div className="field">
      <div className="hint snap">
        The centreline crosses itself, so two wings occupy the same ground. The
        area and the junctions are both unreliable until it is redrawn.
      </div>
    </div>
  )
}

function NoSelection() {
  return (
    <div className="field">
      <div className="hint">
        No building selected. Pick one under Placement, or click it in the viewport.
      </div>
    </div>
  )
}

/** The snap is worth showing: the user asked for one width and got another. */
function ModuleNote() {
  const fit = useStore((s) => {
    const placed = s.build.placed.find((p) => p.placement.id === s.selectedId)
    return placed?.building.facade.fit
  })
  const values = Object.values(fit ?? {}).map((f) => f.actual)
  if (values.length === 0) return null
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const label = hi - lo < 0.01 ? mm(lo) : `${mm(lo)} to ${mm(hi)}`
  return (
    <div className="field">
      <div className="hint snap">Actual {label} — modules divide each elevation evenly.</div>
    </div>
  )
}

/**
 * A core can be shrunk to fit a short or shallow wing, exactly as a module is
 * snapped to divide an elevation. Say so rather than letting the slider lie.
 */
function CoreNote() {
  const cores = useStore((s) => {
    const placed = s.build.placed.find((p) => p.placement.id === s.selectedId)
    return placed?.building.cores
  })
  const placed = useStore((s) => s.site.buildings.find((b) => b.id === s.selectedId))
  const resetCoreOffsets = useStore((s) => s.resetCoreOffsets)
  const p = useSelectedParams()
  if (!cores || cores.fit === null) return null

  const shrunk = cores.fit.width < p.coreWidth - 0.01 || cores.fit.depth < p.coreDepth - 0.01
  const missing = p.coreCount - cores.cores.length
  const moved = (placed?.raw.coreOffsets ?? []).filter((v) => v !== null).length

  return (
    <>
      {(shrunk || missing > 0) && (
        <div className="field">
          <div className="hint snap">
            {shrunk &&
              `Built at ${mm(cores.fit.width)} × ${mm(cores.fit.depth)} — the run is too tight for the size asked. `}
            {missing > 0 && `${missing} core${missing === 1 ? '' : 's'} dropped: no run can hold one.`}
          </div>
        </div>
      )}
      <div className="field">
        <div className="hint">
          {moved > 0
            ? `${moved} core${moved === 1 ? '' : 's'} placed by hand. Select the building, then drag a shaft along its track.`
            : 'Spread evenly. Select the building, then drag a shaft to place it by hand.'}
        </div>
      </div>
      {moved > 0 && (
        <div className="stack">
          <button className="ghost" onClick={resetCoreOffsets}>
            Space them evenly again
          </button>
        </div>
      )}
    </>
  )
}

function SettingsPanel() {
  const site = useStore((s) => s.site)
  const build = useStore((s) => s.build)
  const loadSite = useStore((s) => s.loadSite)
  const reset = useStore((s) => s.reset)
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const onFile = async (f: File) => {
    try {
      const result = parseConfig(await f.text())
      loadSite(result.site)
      setNote(
        result.future
          ? `Loaded a v${result.version} file from a newer build — unknown settings ignored.`
          : result.migrated
            ? `Loaded v${result.version} and migrated it: ${result.migrated}`
            : `Loaded v${result.version}.`,
      )
    } catch {
      setNote('That file could not be read as a site config.')
    }
  }

  const mode = useStore((s) => s.renderMode)
  const setRenderMode = useStore((s) => s.setRenderMode)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const past = useStore((s) => s.past.length)
  const future = useStore((s) => s.future.length)

  return (
    <>
      <Block title="View">
        <Chips value={mode} options={MODES} onChange={setRenderMode} />
        <div className="stack">
          <button className="ghost" onClick={saveImage}>
            Save image (.png)
          </button>
          <div className="hint">
            The viewport as it stands, at its size on screen. Double-click the
            ground to frame the whole site.
          </div>
        </div>
      </Block>

      <Block title="History">
        <div className="stack">
          <div className="pair">
            <button className="ghost" onClick={undo} disabled={past === 0}>
              Undo
            </button>
            <button className="ghost" onClick={redo} disabled={future === 0}>
              Redo
            </button>
          </div>
          <div className="hint">
            {past === 0 && future === 0
              ? 'Nothing to undo yet. Ctrl+Z steps back, Ctrl+Shift+Z forward — in every tab.'
              : `${past} step${past === 1 ? '' : 's'} back, ${future} forward. Ctrl+Z and Ctrl+Shift+Z.`}
          </div>
        </div>
      </Block>

      <Block title="This site">
        <div className="stack">
          <div className="pair">
            <button
              className="ghost"
              onClick={() =>
                download(`urbgen-site-${stamp()}.json`, serialize(site), 'application/json')
              }
            >
              Save
            </button>
            <button className="ghost" onClick={() => file.current?.click()}>
              Load
            </button>
          </div>
          <div className="hint">
            The JSON carries the plot, every building and the underlay image.
          </div>
        </div>
      </Block>

      <Block title="Export">
        <div className="stack">
          <button
            className="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setNote(null)
              try {
                // Pulls in a chunk of three-stdlib; nobody pays until they click.
                const { exportSiteGltf } = await import('../io/exportGltf')
                const glb = await exportSiteGltf(build)
                download(`urbgen-site-${stamp()}.glb`, glb, 'model/gltf-binary')
              } catch {
                setNote('glTF export failed.')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Exporting…' : 'Export glTF (.glb)'}
          </button>
          <div className="hint">
            One named group per building, placed as on the plot. Triangles, not a
            building — for a model you can carry on with, use IFC.
          </div>
          <button
            className="ghost"
            onClick={() =>
              // Like the CSV and unlike the glTF: string building, no library,
              // so there is nothing to code-split.
              download(`urbgen-site-${stamp()}.ifc`, siteIfc(site, build), 'application/x-step')
            }
          >
            Export IFC (.ifc)
          </button>
          <div className="hint">
            IFC4: storeys, floor slabs, exterior walls, balcony decks and
            balustrades, loggias recessed and enclosed, and every window as a
            real opening the receiving application cuts for itself. The app
            models no thickness, so the export assumes {mm(WALL_THICKNESS)} walls
            and {mm(SLAB_THICKNESS)} slabs — anything downstream measuring those
            is measuring the assumption. Cores and the plot come next.
          </div>
          <button
            className="ghost"
            onClick={() =>
              // No lazy import here: unlike the glTF exporter this is a few
              // hundred lines of string building with no library behind it.
              download(`urbgen-metrics-${stamp()}.csv`, siteCsv(site, build), 'text/csv')
            }
          >
            Export metrics (.csv)
          </button>
          <div className="hint">
            Site totals, a row per building, and every rule with its result.
          </div>
        </div>
      </Block>

      <Block title="Start over">
        <div className="stack">
          <button className="ghost danger" onClick={reset}>
            Reset site
          </button>
        </div>
      </Block>

      {note && (
        <div className="field">
          <div className="hint">{note}</div>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
    </>
  )
}

const SECTIONS: { id: Tool; label: string; icon: () => JSX.Element }[] = [
  { id: 'site', label: 'Site', icon: IconSite },
  { id: 'placement', label: 'Placement', icon: IconPlacement },
  { id: 'massing', label: 'Massing', icon: IconMassing },
  // Between Massing and Facade because that is the order the decisions happen
  // in: floors have to exist before they can be zoned, and a floor has to know
  // what it is before it can be clothed.
  { id: 'program', label: 'Program', icon: IconProgram },
  { id: 'facade', label: 'Facade', icon: IconFacade },
  { id: 'units', label: 'Units', icon: IconUnits },
  // After Units and before Settings: drawings are what you take away once the
  // scheme is decided, and Settings is housekeeping rather than a step.
  { id: 'drawings', label: 'Drawings', icon: IconDrawings },
  { id: 'settings', label: 'Settings', icon: IconSettings },
]

export function Sidebar() {
  // The open section is store state, not local: the viewport reads it to decide
  // which handles to show and what a press means.
  const active = useStore((s) => s.tool)
  const setActive = useStore((s) => s.setTool)
  const p = useSelectedParams()
  const set = useStore((s) => s.set)
  const hasSelection = useStore((s) => s.selectedId !== null)
  const wings = PRESET_WINGS[p.preset]
  const seeded = p.balconyPattern === 'random' || p.balconyType === 'mixed'

  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]

  return (
    <div className="sidebar">
      <nav className="rail" aria-label="Sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="rail-item"
            aria-pressed={s.id === active}
            aria-label={s.label}
            title={s.label}
            onClick={() => setActive(s.id)}
          >
            <s.icon />
            <span className="rail-label">{s.label}</span>
          </button>
        ))}
      </nav>

      <div className="panel">
        <div className="panel-head">{section.label}</div>
        <div className="panel-body">
          {active === 'site' && (
            <>
              <Block title="Boundary">
                <PlotControls />
              </Block>
              <Block title="Location">
                <LocationControls />
              </Block>
              <Block title="Rules">
                <RuleControls />
              </Block>
              <Block title="Overlay image">
                <UnderlayPanel />
              </Block>
            </>
          )}

          {active === 'placement' && (
            <>
              <Block title="Buildings">
                <BuildingList />
              </Block>
              <Block title="Selected">
                <PlacementControls />
              </Block>
              <div className="field">
                <div className="hint">Roads and parking will live here too.</div>
              </div>
            </>
          )}

          {active === 'massing' &&
            (hasSelection ? (
              <>
                <Block title="Footprint">
                  <Chips value={p.preset} options={PRESETS} onChange={(v) => set({ preset: v })} />
                  <FreeformChoice />
                  {wings.includes('A') && (
                    <Slider
                      name="wingLengthA"
                      note={p.preset === 'courtyard' ? 'Outer length of the block.' : undefined}
                    />
                  )}
                  {wings.includes('B') && <Slider name="wingLengthB" />}
                  {wings.includes('C') && <Slider name="wingLengthC" />}
                  {p.preset === 'courtyard' && (
                    <Slider name="courtyardWidth" note="Clear width of the void, across the block." />
                  )}
                  {p.preset === 'stacked' && (
                    <Slider name="massOffset" note="Each mass steps back by this much." />
                  )}
                  <Slider
                    name="buildingDepth"
                    note={
                      wings.length > 1
                        ? 'Wing A, and the default for the others.'
                        : undefined
                    }
                  />
                  {wings.includes('B') && <Slider name="depthB" />}
                  {wings.includes('C') && <Slider name="depthC" />}
                </Block>
                <Block title="Height">
                  <Slider name="floors" />
                  <Slider name="floorHeight" />
                </Block>
                <Block title="Roof">
                  <Slider name="roofParapet" />
                  <Chips
                    value={p.topSetback > 0 ? 'setback' : 'flat'}
                    options={ROOF_KINDS}
                    onChange={(v) =>
                      set({ topSetback: v === 'setback' ? DEFAULT_TOP_SETBACK : 0 })
                    }
                  />
                  {p.topSetback > 0 && (
                    <>
                      <Slider name="topSetback" />
                      <Slider name="topSetbackFloors" />
                    </>
                  )}
                </Block>
                <Block title="Core">
                  <Slider
                    name="coreCount"
                    note="Massing only — no stairs, lifts or corridors."
                  />
                  {p.coreCount > 0 && (
                    <>
                      <Chips
                        value={p.corePlacement}
                        options={CORE_PLACEMENTS}
                        onChange={(v) => set({ corePlacement: v })}
                        hint="On the perimeter the shaft meets an exterior wall, and that stretch of facade loses its units."
                      />
                      <Slider name="coreWidth" />
                      <Slider name="coreDepth" />
                      <Slider name="coreOverrun" note="The only part of the shaft you can see." />
                      <CoreNote />
                    </>
                  )}
                </Block>
              </>
            ) : (
              <NoSelection />
            ))}

          {active === 'program' && (hasSelection ? <ProgramPanel /> : <NoSelection />)}

          {active === 'facade' &&
            (hasSelection ? (
              <>
                <Block title="Module">
                  <Slider name="moduleWidth" />
                  <ModuleNote />
                  <Slider name="windowsPerModule" />
                </Block>
                <Block title="Windows">
                  <Slider name="windowWidth" />
                  <Slider name="windowHeight" />
                  <Slider name="sillHeight" />
                  <Slider name="reveal" />
                </Block>
                <Block title="Balconies">
                  <Chips
                    value={p.balconyType}
                    options={BALCONY_TYPES}
                    onChange={(v) => set({ balconyType: v })}
                  />
                  {p.balconyType !== 'none' && (
                    <>
                      <Select
                        label="Pattern"
                        value={p.balconyPattern}
                        options={PATTERNS}
                        onChange={(v) => set({ balconyPattern: v })}
                      />
                      <Slider name="balconyDepth" />
                      <Slider name="balconyWidthRatio" />
                      <Slider name="balconyStartFloor" note="Ground floor is 0." />
                      <Chips
                        label="Balustrade"
                        value={p.balustrade}
                        options={BALUSTRADES}
                        onChange={(v) => set({ balustrade: v })}
                      />
                      {seeded && <Slider name="randomSeed" note="Same seed, same building." />}
                    </>
                  )}
                </Block>
              </>
            ) : (
              <NoSelection />
            ))}

          {active === 'units' &&
            (hasSelection ? (
              <>
                <Block title="Estimate">
                  <Slider
                    name="modulesPerUnit"
                    note="The single divisor, used while no mix is set below."
                  />
                </Block>
                <UnitMixPanel />
                <Block title="Net area">
                  <Slider
                    name="efficiency"
                    note="NIA is GFA times this. Cores, walls and plant are not modelled, so it is a factor rather than a measurement."
                  />
                </Block>
              </>
            ) : (
              <NoSelection />
            ))}

          {active === 'drawings' && <DrawingsPanel />}

          {active === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}
