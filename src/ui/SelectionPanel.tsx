import { useStore } from '../store/store'
import { Select } from './Field'
import type { BalconyPattern, BalconyType, Dir } from '../store/params'
import { mm } from '../lib/units'
import { m2 } from '../lib/units'

const DIR_NAMES: Record<Dir, string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West',
}

const INHERIT = '__inherit__'

/**
 * Per-elevation overrides. Click a face in the viewport, change it here; the
 * rest of the building keeps the global setting.
 */
export function SelectionPanel() {
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)
  const overrides = useStore((s) => s.params.overrides)
  const setOverride = useStore((s) => s.setOverride)
  const elevation = useStore((s) => s.building.elevations.find((e) => e.key === selected))
  const fit = useStore((s) => (selected ? s.building.facade.fit[selected] : undefined))

  if (!selected || !elevation) return null

  const ov = overrides[selected] ?? {}
  const hasOverride = Object.keys(ov).length > 0

  return (
    <div className="selection">
      <div className="head">
        <span>
          {DIR_NAMES[elevation.dir]} elevation · mass {elevation.massId}
        </span>
        <button onClick={() => select(null)} title="Close">
          ×
        </button>
      </div>
      <div className="sub">
        {mm(elevation.length)} long · {fit ? `${fit.count} modules at ${mm(fit.actual)}` : 'no modules'}{' '}
        · {m2(elevation.exteriorArea)} exterior
      </div>

      <Select
        label="Balconies"
        value={(ov.balconyType ?? INHERIT) as BalconyType | typeof INHERIT}
        options={[
          { value: INHERIT, label: 'Inherit' },
          { value: 'none', label: 'None' },
          { value: 'projecting', label: 'Projecting' },
          { value: 'loggia', label: 'Loggia' },
          { value: 'mixed', label: 'Mixed' },
        ]}
        onChange={(v) =>
          setOverride(selected, { balconyType: v === INHERIT ? undefined : (v as BalconyType) })
        }
      />

      <Select
        label="Pattern"
        value={(ov.balconyPattern ?? INHERIT) as BalconyPattern | typeof INHERIT}
        options={[
          { value: INHERIT, label: 'Inherit' },
          { value: 'every', label: 'Every module' },
          { value: 'alternate', label: 'Alternate modules' },
          { value: 'checkerboard', label: 'Checkerboard' },
          { value: 'random', label: 'Random (seeded)' },
        ]}
        onChange={(v) =>
          setOverride(selected, {
            balconyPattern: v === INHERIT ? undefined : (v as BalconyPattern),
          })
        }
      />

      <Select
        label="Windows per module"
        value={ov.windowsPerModule ? String(ov.windowsPerModule) : INHERIT}
        options={[
          { value: INHERIT, label: 'Inherit' },
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
        ]}
        onChange={(v) =>
          setOverride(selected, { windowsPerModule: v === INHERIT ? undefined : Number(v) })
        }
      />

      <div className="stack">
        <button className="ghost" disabled={!hasOverride} onClick={() => setOverride(selected, null)}>
          Clear override
        </button>
      </div>
    </div>
  )
}
