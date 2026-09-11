import { useStore } from '../store/store'
import { bounds, polygonArea } from '../lib/poly'
import { m, m2 } from '../lib/units'
import { round } from '../lib/clamp'

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
