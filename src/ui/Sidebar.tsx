import { useRef, useState } from 'react'
import { Group } from './Group'
import { Slider } from './Slider'
import { Chips, Select } from './Field'
import { useSelectedParams, useStore } from '../store/store'
import { PRESET_LABELS, PRESET_WINGS } from '../store/presets'
import type { BalconyPattern, BalconyType, BalustradeKind, Preset } from '../store/params'
import { mm } from '../lib/units'
import { download, parseConfig, serialize, stamp } from '../io/config'
import { BuildingList, PlacementControls, PlotControls } from './SitePanel'
import { UnderlayPanel } from './UnderlayPanel'

const PRESETS = Object.entries(PRESET_LABELS).map(([value, label]) => ({
  value: value as Preset,
  label,
}))

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

function ConfigButtons() {
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

  return (
    <>
      <div className="stack">
        <div className="pair">
          <button
            className="ghost"
            onClick={() => download(`site-${stamp()}.json`, serialize(site), 'application/json')}
          >
            Save site
          </button>
          <button className="ghost" onClick={() => file.current?.click()}>
            Load site
          </button>
        </div>
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
              download(`site-${stamp()}.glb`, glb, 'model/gltf-binary')
            } catch {
              setNote('glTF export failed.')
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Exporting…' : 'Export site glTF (.glb)'}
        </button>
        <button className="ghost" onClick={reset}>
          Reset site
        </button>
      </div>
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

export function Sidebar() {
  const p = useSelectedParams()
  const set = useStore((s) => s.set)
  const hasSelection = useStore((s) => s.selectedId !== null)
  const wings = PRESET_WINGS[p.preset]
  const seeded = p.balconyPattern === 'random' || p.balconyType === 'mixed'

  return (
    <div className="sidebar">
      <Group title="Site">
        <PlotControls />
        <BuildingList />
      </Group>

      <Group title="Underlay image" open={false}>
        <UnderlayPanel />
      </Group>

      <Group title="Placement">
        <PlacementControls />
      </Group>

      {!hasSelection ? (
        <Group title="Building">
          <div className="field">
            <div className="hint">
              No building selected. Pick one in the list, or click it in the viewport.
            </div>
          </div>
        </Group>
      ) : (
        <>
          <Group title="Massing">
            <Chips value={p.preset} options={PRESETS} onChange={(v) => set({ preset: v })} />
            <Slider name="floors" />
            <Slider name="floorHeight" />
            <Slider name="buildingDepth" note="Uniform across wings in v1." />
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
            <Slider name="roofParapet" />
          </Group>

          <Group title="Facade" open={false}>
            <Slider name="moduleWidth" />
            <ModuleNote />
            <Slider name="windowsPerModule" />
            <Slider name="windowWidth" />
            <Slider name="windowHeight" />
            <Slider name="sillHeight" />
            <Slider name="reveal" />
          </Group>

          <Group title="Balconies" open={false}>
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
          </Group>

          <Group title="Units" open={false}>
            <Slider
              name="modulesPerUnit"
              note="Feeds the unit estimate only. Real counts arrive with floorplans."
            />
          </Group>
        </>
      )}

      <Group title="Config" open={false}>
        <ConfigButtons />
      </Group>
    </div>
  )
}
