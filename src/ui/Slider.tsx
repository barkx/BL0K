import { useStore } from '../store/store'
import { RANGE, type RangeKey } from '../store/params'
import { round } from '../lib/clamp'

const decimals = (step: number) => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2)

/**
 * Slider plus a typed numeric input. The slider follows what the user asked
 * for; when `resolveParams` had to overrule it, the resolved value is shown
 * underneath rather than snapping the handle out from under the drag.
 */
export function Slider({ name, note }: { name: RangeKey; note?: string }) {
  const raw = useStore((s) => s.raw[name])
  const resolved = useStore((s) => s.params[name])
  const set = useStore((s) => s.set)

  const r = RANGE[name]
  const dp = decimals(r.step)
  const clamped = Math.abs(raw - resolved) > r.step / 2

  return (
    <div className="field">
      <div className="row">
        <label htmlFor={`p-${name}`}>{r.label}</label>
        <span className="value">
          <input
            id={`p-${name}`}
            type="number"
            min={r.min}
            max={r.max}
            step={r.step}
            value={round(raw, dp)}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) set({ [name]: v })
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
        value={raw}
        onChange={(e) => set({ [name]: Number(e.target.value) })}
      />
      {clamped ? (
        <div className="hint snap">
          Built at {resolved.toFixed(dp)}
          {r.unit ? ` ${r.unit}` : ''} — limited by the rest of the set.
        </div>
      ) : (
        (note ?? r.hint) && <div className="hint">{note ?? r.hint}</div>
      )}
    </div>
  )
}
