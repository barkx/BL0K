export interface Option<T extends string> {
  value: T
  label: string
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  hint?: string
}) {
  return (
    <div className="field">
      <div className="row">
        <label>{label}</label>
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}

export function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label?: string
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
  hint?: string
}) {
  return (
    <div className="field">
      {label && (
        <div className="row">
          <label>{label}</label>
        </div>
      )}
      <div className="chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}
