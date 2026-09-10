import { useStore } from '../store/store'
import { Select } from './Field'
import type { BalconyPattern, BalconyType, Dir } from '../store/params'
import { m2, mm } from '../lib/units'

const DIR_NAMES: Record<Dir, string> = {
  N: 'North',
  E: 'East',
  S: 'South',
  W: 'West',
}

const INHERIT = '__inherit__'

/**
 * Per-elevation overrides for the selected building. Click a face in the
 * viewport; the rest of the building keeps the global setting.
 */
export function SelectionPanel() {
  const key = useStore((s) => s.selectedElevation)
  const selectElevation = useStore((s) => s.selectElevation)
  const setOverride = useStore((s) => s.setOverride)
  const building = useStore((s) => s.site.buildings.find((b) => b.id === s.selectedId))
  const placed = useStore((s) => s.build.placed.find((p) => p.placement.id === s.selectedId))

  if (!key || !building || !placed) return null

  const elevation = placed.building.elevations.find((e) => e.key === key)
  if (!elevation) return null

  const fit = placed.building.facade.fit[key]
  const ov = building.raw.overrides[key] ?? {}
  const hasOverride = Object.keys(ov).length > 0

  return (
    <div className="selection">
      <div className="head">
        <span>
          {DIR_NAMES[elevation.dir]} · {building.name}
        </span>
        <button onClick={() => selectElevation(null)} title="Close">
          ×
        </button>
      </div>
      <div className="sub">
        mass {elevation.massId} · {mm(elevation.length)} long ·{' '}
        {fit ? `${fit.count} modules at ${mm(fit.actual)}` : 'no modules'} ·{' '}
        {m2(elevation.exteriorArea)} exterior
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
          setOverride(key, { balconyType: v === INHERIT ? undefined : (v as BalconyType) })
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
          setOverride(key, {
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
          setOverride(key, { windowsPerModule: v === INHERIT ? undefined : Number(v) })
        }
      />

      <div className="stack">
        <button className="ghost" disabled={!hasOverride} onClick={() => setOverride(key, null)}>
          Clear override
        </button>
      </div>
    </div>
  )
}
