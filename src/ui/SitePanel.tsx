import { useState } from 'react'
import { useStore } from '../store/store'
import { bounds, polygonArea } from '../lib/poly'
import { m, m2 } from '../lib/units'
import { round } from '../lib/clamp'
import { anyRuleSet } from '../site/rules'
import { DEFAULT_RADIUS, RADIUS_CHOICES, parseLatLon } from '../geo/project'
import { fetchContext, summarise, OverpassError } from '../geo/overpass'
import { OSM_ATTRIBUTION } from '../geo/tiles'
import { LocationPicker } from './LocationPicker'
import type { SiteRules } from '../site/types'

/** The list of buildings on the plot: select, add, duplicate, remove, rename. */
export function BuildingList() {
  const buildings = useStore((s) => s.site.buildings)
  const selectedId = useStore((s) => s.selectedId)
  const selectBuilding = useStore((s) => s.selectBuilding)
  const addBuilding = useStore((s) => s.addBuilding)
  const duplicateBuilding = useStore((s) => s.duplicateBuilding)
  const removeBuilding = useStore((s) => s.removeBuilding)
  const rename = useStore((s) => s.rename)
  const build = useStore((s) => s.build)

  const clashNames = new Set(build.metrics.clashes.flat())
  const offPlot = new Set(build.metrics.offPlot)

  return (
    <>
      <ul className="buildings">
        {buildings.map((b) => {
          const placed = build.placed.find((p) => p.placement.id === b.id)
          const warn = clashNames.has(b.name) || offPlot.has(b.name)
          return (
            <li key={b.id} className={b.id === selectedId ? 'selected' : undefined}>
              <button className="pick" onClick={() => selectBuilding(b.id)}>
                <span className="name">
                  {b.name}
                  {warn && (
                    <span
                      className="warn"
                      title={
                        clashNames.has(b.name)
                          ? 'Overlaps another building'
                          : 'Not entirely inside the plot'
                      }
                    >
                      !
                    </span>
                  )}
                </span>
                <span className="meta num">
                  {placed ? `${placed.building.metrics.topLevel}f · ${m2(placed.building.metrics.gfa)}` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="stack">
        <div className="pair">
          <button className="ghost" onClick={addBuilding}>
            Add
          </button>
          <button
            className="ghost"
            disabled={!selectedId}
            onClick={() => selectedId && duplicateBuilding(selectedId)}
          >
            Duplicate
          </button>
        </div>
        <button
          className="ghost"
          disabled={!selectedId || buildings.length <= 1}
          onClick={() => selectedId && removeBuilding(selectedId)}
        >
          Remove selected
        </button>
      </div>

      {selectedId && (
        <div className="field">
          <div className="row">
            <label htmlFor="b-name">Name</label>
          </div>
          <input
            id="b-name"
            className="text"
            type="text"
            value={buildings.find((b) => b.id === selectedId)?.name ?? ''}
            onChange={(e) => rename(selectedId, e.target.value)}
          />
        </div>
      )}
    </>
  )
}

/** Position and rotation of the selected building. */
export function PlacementControls() {
  const selectedId = useStore((s) => s.selectedId)
  const building = useStore((s) => s.site.buildings.find((b) => b.id === s.selectedId))
  const move = useStore((s) => s.move)
  const rotate = useStore((s) => s.rotate)

  if (!selectedId || !building) {
    return (
      <div className="field">
        <div className="hint">Select a building to place it.</div>
      </div>
    )
  }

  const { position, rotation } = building

  return (
    <>
      <div className="field">
        <div className="row">
          <label>Position</label>
          <span className="value">
            <input
              type="number"
              step={0.5}
              value={round(position.x, 1)}
              aria-label="Position X"
              onChange={(e) =>
                Number.isFinite(Number(e.target.value)) &&
                move(selectedId, { ...position, x: Number(e.target.value) })
              }
            />
            <input
              type="number"
              step={0.5}
              value={round(position.z, 1)}
              aria-label="Position Z"
              onChange={(e) =>
                Number.isFinite(Number(e.target.value)) &&
                move(selectedId, { ...position, z: Number(e.target.value) })
              }
            />
            <span className="unit">m</span>
          </span>
        </div>
        <div className="hint">Or drag the building across the ground.</div>
      </div>

      <div className="field">
        <div className="row">
          <label htmlFor="b-rot">Rotation</label>
          <span className="value">
            <input
              id="b-rot"
              type="number"
              step={1}
              value={round(rotation, 1)}
              onChange={(e) =>
                Number.isFinite(Number(e.target.value)) && rotate(selectedId, Number(e.target.value))
              }
            />
            <span className="unit">°</span>
          </span>
        </div>
        <input
          type="range"
          aria-label="Rotation"
          min={-180}
          max={180}
          step={0.5}
          value={rotation}
          onChange={(e) => rotate(selectedId, Number(e.target.value))}
        />
        <div className="chips" style={{ marginTop: 6 }}>
          {[0, 45, 90, 135].map((a) => (
            <button key={a} type="button" onClick={() => rotate(selectedId, a)}>
              {a}°
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/** Draw a boundary, edit its corners, or reset it to a rectangle. */
export function PlotControls() {
  const plot = useStore((s) => s.site.plot)
  const setPlotRect = useStore((s) => s.setPlotRect)
  const plotMode = useStore((s) => s.plotMode)
  const plotDraft = useStore((s) => s.plotDraft)
  const startPlotDraw = useStore((s) => s.startPlotDraw)
  const finishPlotDraw = useStore((s) => s.finishPlotDraw)
  const cancelPlotDraw = useStore((s) => s.cancelPlotDraw)
  const undoDraftPoint = useStore((s) => s.undoDraftPoint)
  const simple = useStore((s) => s.build.metrics.plotSimple)

  const b = bounds(plot)
  const width = b.x1 - b.x0
  const depth = b.z1 - b.z0
  const area = polygonArea(plot)
  const rectangular = plot.length === 4 && Math.abs(area - width * depth) < 0.01

  if (plotMode === 'draw') {
    return (
      <>
        <div className="field">
          <div className="hint snap">
            Click the ground to place corners. Click the red first corner, or
            press Enter, to close the boundary.
          </div>
          <div className="hint">
            {plotDraft.length} corner{plotDraft.length === 1 ? '' : 's'} placed
            {plotDraft.length >= 3 ? ` · ${m2(polygonArea(plotDraft))}` : ''}
          </div>
        </div>
        <div className="stack">
          <div className="pair">
            <button className="ghost" disabled={plotDraft.length < 3} onClick={finishPlotDraw}>
              Finish
            </button>
            <button className="ghost" disabled={plotDraft.length === 0} onClick={undoDraftPoint}>
              Undo point
            </button>
          </div>
          <button className="ghost" onClick={cancelPlotDraw}>
            Cancel
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="field">
        <div className="row">
          <label>Plot</label>
          <span className="value num" style={{ fontSize: 12 }}>
            {m2(area)}
          </span>
        </div>
        <div className="hint">
          {plot.length} corners · {m(width)} × {m(depth)} envelope
          {rectangular ? ' · rectangular' : ''}
        </div>
        {!simple && (
          <div className="hint error">
            The boundary crosses itself, so the area is meaningless. Move a
            corner, or reset to a rectangle.
          </div>
        )}
      </div>

      <div className="stack">
        <button className="ghost" onClick={startPlotDraw}>
          Draw new boundary
        </button>
      </div>

      <div className="field">
        <div className="row">
          <label>Reset to rectangle</label>
          <span className="value">
            <input
              type="number"
              step={1}
              min={5}
              aria-label="Plot width"
              value={round(width, 1)}
              onChange={(e) =>
                Number(e.target.value) > 0 && setPlotRect(Number(e.target.value), depth)
              }
            />
            <input
              type="number"
              step={1}
              min={5}
              aria-label="Plot depth"
              value={round(depth, 1)}
              onChange={(e) =>
                Number(e.target.value) > 0 && setPlotRect(width, Number(e.target.value))
              }
            />
            <span className="unit">m</span>
          </span>
        </div>
        <div className="hint">
          Drag a corner to move it, click a small handle to add one, right-click
          a corner to remove it.
        </div>
      </div>
    </>
  )
}

interface RuleFieldProps {
  id: keyof SiteRules
  label: string
  unit: string
  step: number
  /** What a value of zero means, spelled out rather than left blank. */
  hint: string
  value: number
  onChange: (v: number) => void
}

function RuleField({ id, label, unit, step, hint, value, onChange }: RuleFieldProps) {
  return (
    <div className="field">
      <div className="row">
        <label htmlFor={`rule-${id}`}>{label}</label>
        <span className="value">
          <input
            id={`rule-${id}`}
            type="number"
            min={0}
            step={step}
            value={round(value, 2)}
            onChange={(e) => Number.isFinite(Number(e.target.value)) && onChange(Number(e.target.value))}
          />
          <span className="unit">{unit}</span>
        </span>
      </div>
      <div className="hint">{value > 0 ? hint : 'Off'}</div>
    </div>
  )
}

/**
 * The plot's planning limits. Every rule is off at zero, so a fresh site shows
 * no warnings it did not earn; what each one checks is spelled out because a
 * number alone does not say whether it is measured in plan or in section.
 */
export function RuleControls() {
  const rules = useStore((s) => s.site.rules)
  const setRules = useStore((s) => s.setRules)
  const breaches = useStore((s) => s.build.metrics.breaches)
  const armed = anyRuleSet(rules)

  return (
    <>
      <RuleField
        id="setback"
        label="Setback"
        unit="m"
        step={0.5}
        hint="Nearest face to the boundary, in plan."
        value={rules.setback}
        onChange={(setback) => setRules({ setback })}
      />
      <RuleField
        id="separation"
        label="Separation"
        unit="m"
        step={0.5}
        hint="Clear gap between any two buildings."
        value={rules.separation}
        onChange={(separation) => setRules({ separation })}
      />
      <RuleField
        id="heightCap"
        label="Height cap"
        unit="m"
        step={1}
        hint="Ground to the top of the parapet."
        value={rules.heightCap}
        onChange={(heightCap) => setRules({ heightCap })}
      />
      <RuleField
        id="farCap"
        label="Plot ratio cap"
        unit="FAR"
        step={0.1}
        hint="GFA over plot area."
        value={rules.farCap}
        onChange={(farCap) => setRules({ farCap })}
      />
      <RuleField
        id="coverageCap"
        label="Coverage cap"
        unit="%"
        step={5}
        hint="Ground-floor footprint over plot area."
        value={rules.coverageCap * 100}
        onChange={(v) => setRules({ coverageCap: v / 100 })}
      />

      <div className="field">
        <div className="hint">
          {!armed
            ? 'No limits set. Zero means a rule is off.'
            : breaches.length === 0
              ? 'The scheme meets every limit set.'
              : `${breaches.length} breach${breaches.length === 1 ? '' : 'es'} — see the metrics panel.`}
        </div>
      </div>
    </>
  )
}

/**
 * Where the project is, in the world.
 *
 * Stage one of the OSM work and useful on its own: an anchor makes every export
 * georeferenced, so a model lands where it belongs in a receiving application
 * instead of at that application's origin. Nothing here touches the network —
 * the map picker and the OSM context come next, and both build on this.
 */
export function LocationControls() {
  const geo = useStore((s) => s.site.geo)
  const setGeo = useStore((s) => s.setGeo)
  const [draft, setDraft] = useState('')
  const [bad, setBad] = useState(false)
  const [picking, setPicking] = useState(false)
  const context = useStore((st) => st.site.context)
  const setContext = useStore((st) => st.setContext)
  const [importing, setImporting] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  /**
   * `anchor` is passed in rather than read from the store because the store has
   * not finished updating when a freshly picked location wants importing, and
   * the closure would still hold the old one.
   */
  const runImport = async (anchor = geo) => {
    if (!anchor) return
    setImporting(true)
    setNote(null)
    try {
      const fetched = await fetchContext(anchor)
      setContext(fetched)
      const { buildings, withHeight, roads } = summarise(fetched)
      setNote(
        `${buildings} building${buildings === 1 ? '' : 's'} (${withHeight} with heights), ` +
          `${roads} road${roads === 1 ? '' : 's'}.`,
      )
    } catch (e) {
      setNote(e instanceof OverpassError ? e.message : 'The import failed.')
    } finally {
      setImporting(false)
    }
  }

  const picker = picking ? (
    <LocationPicker
      initial={geo}
      onClose={() => setPicking(false)}
      onPick={({ lat, lon, radius }) => {
        // Keep whatever north was already set: the map says where, not which
        // way round the drawing is.
        const anchor = { lat, lon, radius, trueNorth: geo?.trueNorth ?? 0 }
        setGeo(anchor)
        setPicking(false)
        // Choosing a place is the explicit act; a second press to fetch what
        // you just chose is ceremony. The rule that matters is unchanged —
        // nothing reaches the network without someone asking for it.
        void runImport(anchor)
      }}
    />
  ) : null

  if (!geo) {
    return (
      <>
        {picker}
        <div className="stack">
          <button className="ghost" onClick={() => setPicking(true)}>
            Pick on a map
          </button>
        </div>
        <div className="field">
          <div className="row">
            <label htmlFor="geo-paste">Coordinates</label>
          </div>
          <input
            id="geo-paste"
            className="text"
            type="text"
            placeholder="46.0569, 14.5058"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setBad(false)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const parsed = parseLatLon(draft)
              if (parsed) {
                const anchor = { ...parsed, trueNorth: 0, radius: DEFAULT_RADIUS }
                setGeo(anchor)
                void runImport(anchor)
              }
              else setBad(true)
            }}
          />
          <div className={bad ? 'hint error' : 'hint'}>
            {bad
              ? 'That is not a latitude and longitude.'
              : 'Or paste a latitude and longitude and press Enter — right-click a point in Google Maps and the first line is what you want.'}
          </div>
        </div>
        <div className="field">
          <div className="hint">
            Without one the site is still a site — it just has no position, and
            exports say so rather than inventing one.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {picker}
      <div className="field">
        <div className="row">
          <label>Position</label>
          <span className="value num" style={{ fontSize: 12 }}>
            {geo.lat.toFixed(5)}, {geo.lon.toFixed(5)}
          </span>
        </div>
        <div className="hint">
          Written into the IFC, so the model lands here rather than at the
          origin.
        </div>
      </div>

      <div className="field">
        <div className="row">
          <label htmlFor="geo-north">True north</label>
          <span className="value">
            <input
              id="geo-north"
              type="number"
              step={1}
              min={-180}
              max={180}
              value={round(geo.trueNorth, 1)}
              onChange={(e) =>
                Number.isFinite(Number(e.target.value)) &&
                setGeo({ ...geo, trueNorth: Number(e.target.value) })
              }
            />
            <span className="unit">°</span>
          </span>
        </div>
        <input
          type="range"
          aria-label="True north"
          min={-180}
          max={180}
          step={1}
          value={geo.trueNorth}
          onChange={(e) => setGeo({ ...geo, trueNorth: Number(e.target.value) })}
        />
        <div className="hint">
          Clockwise from the way the plot was drawn. Zero means the drawing is
          already oriented with north up.
        </div>
      </div>

      <div className="field">
        <div className="row">
          <label>Import area</label>
          <span className="value num" style={{ fontSize: 12 }}>
            {geo.radius * 2} × {geo.radius * 2} m
          </span>
        </div>
        <div className="chips">
          {RADIUS_CHOICES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === geo.radius}
              onClick={() => setGeo({ ...geo, radius: r })}
            >
              {r} m
            </button>
          ))}
        </div>
        <div className="hint">How much surrounding map an import will pull in.</div>
      </div>

      <div className="stack">
        <button className="ghost" disabled={importing} onClick={() => void runImport()}>
          {importing
            ? 'Importing…'
            : context
              ? 'Import surroundings again'
              : 'Import surroundings'}
        </button>
        {note && <div className="hint">{note}</div>}
        {context ? (
          <>
            <div className="hint">
              {summarise(context).total} features drawn, at true scale and true
              north. Trace the plot straight over them — no calibration.
            </div>
            <div className="hint">
              Context only: never measured, never exported. {OSM_ATTRIBUTION}.
            </div>
            <button className="ghost" onClick={() => setContext(null)}>
              Remove the surroundings
            </button>
          </>
        ) : (
          <div className="hint">
            Buildings, roads and water from OpenStreetMap, drawn around the
            position as flat linework to trace over. Imported automatically when
            you pick a place; this is for fetching it again.
          </div>
        )}
      </div>

      <div className="stack">
        <div className="pair">
          <button className="ghost" onClick={() => setPicking(true)}>
            Move on a map
          </button>
          <button className="ghost" onClick={() => setGeo(null)}>
            Clear
          </button>
        </div>
      </div>
    </>
  )
}
