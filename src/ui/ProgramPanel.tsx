import { useSelectedParams, useSelectedRaw, useStore } from '../store/store'
import { RANGE, type RangeKey } from '../store/params'
import {
  bandAt,
  defaultBand,
  PUBLIC_USES,
  USE_LABEL,
  type ProgramBand,
  type PublicUse,
} from '../store/program'
import { Block, Chips } from './Field'
import { round } from '../lib/clamp'

const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2)

const USE_OPTIONS = PUBLIC_USES.map((value) => ({ value, label: USE_LABEL[value] }))

/** "Ground floor", "Floors 0–2" — how a brief would name the band. */
function bandTitle(b: ProgramBand): string {
  if (b.from === b.to) return b.from === 0 ? 'Ground floor' : `Floor ${b.from}`
  return b.from === 0 ? `Ground to floor ${b.to}` : `Floors ${b.from}–${b.to}`
}

/**
 * The same slider the building's own windows get, pointed at one band.
 *
 * It borrows `RANGE` rather than declaring its own limits: a band's windows are
 * the same kind of thing as a facade's, and two sets of bounds for one quantity
 * would drift apart the first time either moved.
 */
function BandSlider({
  name,
  value,
  onChange,
  note,
}: {
  name: RangeKey
  value: number
  onChange: (v: number) => void
  note?: string
}) {
  const r = RANGE[name]
  const dp = decimals(r.step)
  return (
    <div className="field">
      <div className="row">
        <label>{r.label}</label>
        <span className="value">
          <input
            type="number"
            min={r.min}
            max={r.max}
            step={r.step}
            value={round(value, dp)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) onChange(v)
            }}
          />
          {r.unit && <span className="unit">{r.unit}</span>}
        </span>
      </div>
      <input
        type="range"
        aria-label={r.label}
        min={r.min}
        max={r.max}
        step={r.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {note && <div className="hint">{note}</div>}
    </div>
  )
}

/**
 * Which floors are not housing.
 *
 * The panel edits the raw list and lets `resolveParams` settle it, which is why
 * a band you drag past the top of the building springs back rather than being
 * refused: the clamp is one function and it is not this one.
 */
export function ProgramPanel() {
  const raw = useSelectedRaw()
  const p = useSelectedParams()
  const set = useStore((s) => s.set)

  const bands = raw.program
  const top = Math.max(0, p.floors - 1)

  const write = (next: ProgramBand[]) => set({ program: next })
  const patch = (i: number, change: Partial<ProgramBand>) =>
    write(bands.map((b, n) => (n === i ? { ...b, ...change } : b)))

  const addBand = () => {
    // The lowest floor nobody has claimed, which for an empty building is the
    // ground — where a public programme almost always goes.
    let level = 0
    while (level <= top && bandAt(p.program, level)) level++
    if (level > top) return
    write([...bands, defaultBand('retail', level, level, p.floorHeight)])
  }

  return (
    <>
      <Block title="Floors">
        {p.program.length === 0 ? (
          <div className="field">
            <div className="hint">
              Every floor is residential. Add a band to give one over to
              something else — a shop, an office, a community room.
            </div>
          </div>
        ) : (
          <div className="field">
            <div className="hint">
              Levels not covered by a band stay residential. Floors run 0 to{' '}
              {top}, ground first.
            </div>
          </div>
        )}
        <div className="stack">
          <button className="ghost" onClick={addBand} disabled={p.program.length > top}>
            Add a band
          </button>
        </div>
      </Block>

      {bands.map((b, i) => (
        <Block key={i} title={bandTitle(p.program[i] ?? b)}>
          <Chips
            value={b.use}
            options={USE_OPTIONS}
            onChange={(v: PublicUse) => patch(i, { use: v })}
          />
          <div className="field">
            <div className="row">
              <label>Floors</label>
              <span className="value">
                <input
                  type="number"
                  aria-label="First floor of the band"
                  min={0}
                  max={top}
                  step={1}
                  value={b.from}
                  onChange={(e) => patch(i, { from: Number(e.target.value) })}
                />
                <input
                  type="number"
                  aria-label="Last floor of the band"
                  min={0}
                  max={top}
                  step={1}
                  value={b.to}
                  onChange={(e) => patch(i, { to: Number(e.target.value) })}
                />
              </span>
            </div>
            <div className="hint">
              Both ends included. Ground floor is 0.
            </div>
          </div>

          <BandSlider
            name="windowWidth"
            value={b.windowWidth}
            onChange={(v) => patch(i, { windowWidth: v })}
            note="A shopfront is wider than a window, and fits the same module."
          />
          <BandSlider
            name="windowHeight"
            value={b.windowHeight}
            onChange={(v) => patch(i, { windowHeight: v })}
          />
          <BandSlider
            name="sillHeight"
            value={b.sillHeight}
            onChange={(v) => patch(i, { sillHeight: v })}
            note="Low enough to read as a kerb upstand rather than a windowsill."
          />
          <BandSlider
            name="windowsPerModule"
            value={b.windowsPerModule}
            onChange={(v) => patch(i, { windowsPerModule: v })}
            note="One opening per module is what makes a shopfront a shopfront."
          />
          <div className="stack">
            <button className="ghost" onClick={() => write(bands.filter((_, n) => n !== i))}>
              Remove this band
            </button>
          </div>
        </Block>
      ))}

      <Block title="What a band does">
        <div className="field">
          <div className="hint">
            A public floor takes its own glazing and never gets a balcony. The
            massing does not change — floor height is uniform and the footprint
            is the same, so this is a programme and a facade, not a plinth.
          </div>
        </div>
      </Block>
    </>
  )
}
