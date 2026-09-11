import { useRef, useState, type ReactNode } from 'react'
import { Slider } from './Slider'
import { Chips, Select } from './Field'
import { useSelectedParams, useStore } from '../store/store'
import { PRESET_LABELS, PRESET_WINGS } from '../store/presets'
import type { BalconyPattern, BalconyType, BalustradeKind, Preset } from '../store/params'
import { mm } from '../lib/units'
import { download, parseConfig, serialize, stamp } from '../io/config'
import { BuildingList, PlacementControls, PlotControls } from './SitePanel'
import { UnderlayPanel } from './UnderlayPanel'
import {
  IconFacade,
  IconMassing,
  IconPlacement,
  IconSettings,
  IconSite,
  IconUnits,
} from './Icons'

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

/** A labelled block inside a panel, replacing the old accordion groups. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="block">
      <h3 className="block-title">{title}</h3>
      {children}
    </section>
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

  return (
    <>
      <Block title="This site">
        <div className="stack">
          <div className="pair">
            <button
              className="ghost"
              onClick={() =>
                download(`bl0k-site-${stamp()}.json`, serialize(site), 'application/json')
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
                download(`bl0k-site-${stamp()}.glb`, glb, 'model/gltf-binary')
              } catch {
                setNote('glTF export failed.')
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Exporting…' : 'Export glTF (.glb)'}
          </button>
          <div className="hint">One named group per building, placed as on the plot.</div>
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

type SectionId = 'site' | 'placement' | 'massing' | 'facade' | 'units' | 'settings'

const SECTIONS: { id: SectionId; label: string; icon: () => JSX.Element }[] = [
  { id: 'site', label: 'Site', icon: IconSite },
  { id: 'placement', label: 'Placement', icon: IconPlacement },
  { id: 'massing', label: 'Massing', icon: IconMassing },
  { id: 'facade', label: 'Facade', icon: IconFacade },
  { id: 'units', label: 'Units', icon: IconUnits },
  { id: 'settings', label: 'Settings', icon: IconSettings },
]

export function Sidebar() {
  const [active, setActive] = useState<SectionId>('site')
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
                  <Slider name="buildingDepth" note="Uniform across wings." />
                </Block>
                <Block title="Height">
                  <Slider name="floors" />
                  <Slider name="floorHeight" />
                  <Slider name="roofParapet" />
                </Block>
              </>
            ) : (
              <NoSelection />
            ))}

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
              <Block title="Estimate">
                <Slider
                  name="modulesPerUnit"
                  note="Feeds the unit estimate only. Real counts arrive with floorplans."
                />
              </Block>
            ) : (
              <NoSelection />
            ))}

          {active === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}
