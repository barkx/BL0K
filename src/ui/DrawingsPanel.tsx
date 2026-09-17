import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { Block, Chips, Select } from './Field'
import { download, stamp } from '../io/config'
import {
  elevationKeys,
  elevationSvg,
  floorPlanSvg,
  planLevels,
  sectionSvg,
  sitePlanSvg,
  typicalLevel,
  type DrawingOptions,
} from '../io/exportSvg'

type Kind = 'site' | 'plan' | 'elevation' | 'section'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'site', label: 'Site plan' },
  { value: 'plan', label: 'Floor plan' },
  { value: 'elevation', label: 'Elevation' },
  { value: 'section', label: 'Section' },
]

const CUTS: { value: 'x' | 'z'; label: string }[] = [
  { value: 'x', label: 'Looking north' },
  { value: 'z', label: 'Looking east' },
]

const SCALES = [100, 200, 500, 1000].map((v) => ({ value: String(v), label: `1:${v}` }))

/**
 * Plans and elevations, drawn from the model rather than captured from the
 * screen.
 *
 * The preview is the very same SVG string the download writes, scaled to the
 * panel. Rendering one thing and saving another is how a drawing tool loses
 * your trust, and here there is nothing to keep in step: one function, one
 * output, shown and saved.
 */
export function DrawingsPanel() {
  const site = useStore((s) => s.site)
  const build = useStore((s) => s.build)
  const selectedId = useStore((s) => s.selectedId)
  const placed = build.placed.find((b) => b.placement.id === selectedId) ?? null

  const [kind, setKind] = useState<Kind>('site')
  const [scale, setScale] = useState('200')
  const [level, setLevel] = useState<number | null>(null)
  const [elevation, setElevation] = useState<string | null>(null)
  const [cutAlong, setCutAlong] = useState<'x' | 'z'>('x')
  const [cutOffset, setCutOffset] = useState(0)

  const levelsAvailable = placed ? planLevels(placed) : []
  const elevationsAvailable = placed ? elevationKeys(placed) : []
  const activeLevel =
    level !== null && levelsAvailable.includes(level)
      ? level
      : placed
        ? typicalLevel(placed)
        : 0
  const activeElevation =
    elevation && elevationsAvailable.includes(elevation)
      ? elevation
      : (elevationsAvailable[0] ?? null)

  const svg = useMemo(() => {
    const o: DrawingOptions = { scale: Number(scale), title: 'URBGEN' }
    if (kind === 'site') return sitePlanSvg(site, build, { ...o, title: 'Site plan' })
    if (kind === 'section') {
      return sectionSvg(site, build, { along: cutAlong, offset: cutOffset }, { ...o, title: 'Section' })
    }
    if (!placed) return null
    if (kind === 'plan') {
      return floorPlanSvg(placed, activeLevel, { ...o, title: `Level ${activeLevel}` })
    }
    if (!activeElevation) return null
    return elevationSvg(placed, activeElevation, { ...o, title: 'Elevation' })
  }, [kind, scale, site, build, placed, activeLevel, activeElevation, cutAlong, cutOffset])

  const name = () => {
    if (kind === 'site') return `urbgen-site-plan-${stamp()}.svg`
    if (kind === 'section') return `urbgen-section-${cutAlong}-${stamp()}.svg`
    const who = placed?.placement.name.replace(/\s+/g, '-').toLowerCase() ?? 'building'
    if (kind === 'plan') return `urbgen-${who}-level-${activeLevel}-${stamp()}.svg`
    return `urbgen-${who}-elevation-${activeElevation}-${stamp()}.svg`
  }

  const needsBuilding = kind !== 'site' && kind !== 'section' && !placed
  // Half the site's span each way is enough to reach anything on it.
  const reach = Math.max(
    20,
    Math.round(
      (cutAlong === 'x' ? build.bounds.z1 - build.bounds.z0 : build.bounds.x1 - build.bounds.x0) / 2,
    ) + 10,
  )

  return (
    <>
      <Block title="Drawing">
        <Chips value={kind} options={KINDS} onChange={setKind} />

        {kind === 'plan' && placed && (
          <Select
            label="Level"
            value={String(activeLevel)}
            options={levelsAvailable.map((l) => ({
              value: String(l),
              label: l === 0 ? 'Ground' : `Level ${l}`,
            }))}
            onChange={(v) => setLevel(Number(v))}
            hint="A typical upper floor is chosen for you — the first clear of the ground and of any programme band."
          />
        )}

        {kind === 'elevation' && placed && activeElevation && (
          <Select
            label="Face"
            value={activeElevation}
            options={elevationsAvailable.map((k) => ({ value: k, label: k }))}
            onChange={setElevation}
          />
        )}

        {kind === 'section' && (
          <>
            <Chips value={cutAlong} options={CUTS} onChange={setCutAlong} />
            <div className="field">
              <div className="row">
                <label htmlFor="cut-offset">Offset</label>
                <span className="value">
                  <input
                    id="cut-offset"
                    type="number"
                    min={-reach}
                    max={reach}
                    step={1}
                    value={cutOffset}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      if (Number.isFinite(v)) setCutOffset(v)
                    }}
                  />
                  <span className="unit">m</span>
                </span>
              </div>
              <input
                type="range"
                aria-label="Cut offset"
                min={-reach}
                max={reach}
                step={1}
                value={cutOffset}
                onChange={(e) => setCutOffset(Number(e.target.value))}
              />
              <div className="hint">
                From the middle of the site, across the cut. Only what the line
                passes through is drawn.
              </div>
            </div>
          </>
        )}

        <Select label="Scale" value={scale} options={SCALES} onChange={setScale} />

        {needsBuilding && (
          <div className="field">
            <div className="hint">
              Pick a building under Placement, or click one in the viewport. The
              site plan draws every building; a floor plan and an elevation are
              of one.
            </div>
          </div>
        )}
      </Block>

      {svg && (
        <Block title="Preview">
          <div className="field">
            <div
              className="drawing-preview"
              /* The drawing is generated here from the model, never from
                 anything a user or a server supplied, so there is no untrusted
                 markup to sanitise. */
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
          <div className="stack">
            <button className="ghost" onClick={() => download(name(), svg, 'image/svg+xml')}>
              Download SVG
            </button>
            <div className="hint">
              Sized in millimetres and drawn at 1:{scale}, so printing at 100%
              gives a drawing you can measure. A scale bar rides along for when
              somebody resizes it.
            </div>
          </div>
        </Block>
      )}

      <Block title="What is drawn">
        <div className="field">
          <div className="hint">
            The massing: outlines, cores, the module rhythm, every opening, and
            what a cut passes through.
            Rooms, corridors and unit layouts are not modelled and are not
            implied. Imported OpenStreetMap context is left out of every
            drawing — it is there to trace over, and its licence follows it into
            anything you hand on.
          </div>
        </div>
      </Block>
    </>
  )
}
