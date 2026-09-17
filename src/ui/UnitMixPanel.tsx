import { useSelectedParams, useSelectedRaw, useStore } from '../store/store'
import { RANGE } from '../store/params'
import {
  mixIsSet,
  NO_MIX,
  UNIT_LABEL,
  UNIT_TYPES,
  type UnitType,
  type UnitTypeSpec,
} from '../store/unitMix'
import { Block } from './Field'
import { m2, pct } from '../lib/units'
import { round } from '../lib/clamp'

/**
 * The target mix, and what the building could actually take.
 *
 * Both halves matter. A target nobody can meet is a wish, and a result with no
 * target beside it is a number you cannot argue with — so the achieved share
 * sits next to the one that was asked for, and the gap is left visible rather
 * than rounded away.
 */
export function UnitMixPanel() {
  const raw = useSelectedRaw()
  const p = useSelectedParams()
  const set = useStore((s) => s.set)
  const metrics = useStore((s) => {
    const placed = s.build.placed.find((b) => b.placement.id === s.selectedId)
    return placed?.building.metrics
  })

  const mix = raw.unitMix
  const on = mixIsSet(p.unitMix)
  const patch = (t: UnitType, change: Partial<UnitTypeSpec>) =>
    set({ unitMix: { ...mix, [t]: { ...mix[t], ...change } } })

  const typed = UNIT_TYPES.filter((t) => p.unitMix[t].share > 0)
  const totalShare = typed.reduce((s, t) => s + p.unitMix[t].share, 0)
  const r = RANGE.modulesPerUnit

  return (
    <>
      <Block title="Target mix">
        <div className="field">
          <div className="hint">
            A share of the unit count per type, and how many modules one flat of
            that type spans. Zero is a type the scheme does not have.
          </div>
        </div>

        {UNIT_TYPES.map((t) => (
          <div className="field" key={t}>
            <div className="row">
              <label htmlFor={`mix-${t}`}>{UNIT_LABEL[t]}</label>
              <span className="value">
                <input
                  id={`mix-${t}`}
                  className="narrow"
                  type="number"
                  aria-label={`${UNIT_LABEL[t]} share`}
                  min={0}
                  max={100}
                  step={1}
                  value={round(mix[t].share, 0)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) patch(t, { share: v })
                  }}
                />
                <span className="unit">%</span>
                <input
                  className="narrow"
                  type="number"
                  aria-label={`${UNIT_LABEL[t]} modules`}
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={round(mix[t].modules, 2)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) patch(t, { modules: v })
                  }}
                />
                <span className="unit">mod</span>
              </span>
            </div>
            <input
              type="range"
              aria-label={`${UNIT_LABEL[t]} share slider`}
              min={0}
              max={100}
              step={1}
              value={mix[t].share}
              onChange={(e) => patch(t, { share: Number(e.target.value) })}
            />
          </div>
        ))}

        {on && Math.abs(totalShare - 100) > 0.5 && (
          <div className="field">
            <div className="hint snap">
              Shares add up to {round(totalShare, 0)}% — they are normalised, so
              the proportions between them are what counts.
            </div>
          </div>
        )}

        {on && (
          <div className="stack">
            <button className="ghost" onClick={() => set({ unitMix: NO_MIX })}>
              Clear the mix
            </button>
          </div>
        )}
      </Block>

      {on && metrics?.mix && (
        <Block title="What fits">
          <div className="field">
            <table className="mix">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Units</th>
                  <th>Share</th>
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {typed.map((t) => {
                  const row = metrics.mix!.byType[t]
                  return (
                    <tr key={t}>
                      <td>{UNIT_LABEL[t]}</td>
                      <td>{row.units}</td>
                      <td>
                        {pct(row.achieved)}
                        <small> of {pct(row.target)}</small>
                      </td>
                      <td>{m2(row.averageArea)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="field">
            <div className="hint">
              {metrics.mix.modulesSpare > 0.01
                ? `${round(metrics.mix.modulesSpare, 2)} modules left over — too few for another flat of any type in the mix. `
                : 'Every residential module is spoken for. '}
              Area is shared out in proportion to the modules each type took, not
              typed in per flat.
            </div>
          </div>
        </Block>
      )}
    </>
  )
}
