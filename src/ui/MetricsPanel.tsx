import { useStore } from '../store/store'
import { int, m, m2, pct } from '../lib/units'
import { round } from '../lib/clamp'
import { RULE_KIND, RULE_LABEL, RULE_SENSE, type Breach } from '../site/rules'
import { PUBLIC_USES, USE_LABEL } from '../store/program'
import { UNIT_LABEL, UNIT_TYPES, type UnitType } from '../store/unitMix'

/**
 * A line per public programme, and none at all when the scheme is all housing.
 *
 * Silence is the right default here: a row reading "Retail 0 m2" on every
 * scheme would be noise on the many and no more informative on the few.
 */
function ProgrammeRows({ gfaByUse }: { gfaByUse: Record<string, number> }) {
  const rows = PUBLIC_USES.filter((use) => gfaByUse[use] > 0.5)
  if (rows.length === 0) return null
  return (
    <>
      {rows.map((use) => (
        <ProgrammeRow key={use} label={USE_LABEL[use]} area={gfaByUse[use]} />
      ))}
    </>
  )
}

/**
 * The mix under the total, and nothing at all when no building carries one.
 *
 * `untyped` only appears when some blocks have a mix and others do not, which
 * is the one case where the breakdown would otherwise fail to add up to the
 * number above it.
 */
function MixRows({
  byType,
  untyped,
  total,
}: {
  byType: Record<UnitType, number>
  untyped: number
  total: number
}) {
  const rows = UNIT_TYPES.filter((t) => byType[t] > 0)
  if (rows.length === 0) return null
  return (
    <>
      {rows.map((t) => (
        <span key={t} style={{ display: 'contents' }}>
          <dt>{UNIT_LABEL[t]}</dt>
          <dd>
            {int(byType[t])} <small>{pct(total > 0 ? byType[t] / total : 0)}</small>
          </dd>
        </span>
      ))}
      {untyped > 0 && (
        <>
          <dt>No mix set</dt>
          <dd>
            {int(untyped)} <small>units</small>
          </dd>
        </>
      )}
    </>
  )
}

function ProgrammeRow({ label, area }: { label: string; area: number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {m2(area)} <small>of GFA</small>
      </dd>
    </>
  )
}

/** A breach in one line: what the scheme does, against what the rule allows. */
function breachLine(b: Breach): string {
  const kind = RULE_KIND[b.rule]
  const show = (v: number) =>
    kind === 'length' ? m(v) : kind === 'share' ? pct(v) : round(v, 2).toFixed(2)
  const who = b.names.length ? `${b.names.join(' and ')}: ` : ''
  const verb = RULE_SENSE[b.rule] === 'minimum' ? 'needs' : 'allows'
  return `${who}${RULE_LABEL[b.rule].toLowerCase()} ${show(b.actual)}, ${verb} ${show(b.limit)}`
}

/**
 * Site totals first — the numbers a scheme is judged on — then the selected
 * building. Coverage and FAR are only meaningful against the plot, so they
 * live here rather than on any one building.
 */
export function MetricsPanel() {
  const build = useStore((s) => s.build)
  const selected = useStore((s) =>
    s.build.placed.find((p) => p.placement.id === s.selectedId),
  )
  const k = build.metrics
  const invalid =
    k.clashes.length > 0 || k.offPlot.length > 0 || !k.plotSimple || k.breaches.length > 0

  return (
    <div className="metrics">
      <div className="head">
        <span>
          {int(k.buildings)} building{k.buildings === 1 ? '' : 's'}
          <span style={{ color: 'var(--ink-faint)' }}> · </span>
          {m2(k.plotArea)} plot
        </span>
      </div>
      <dl>
        <dt>GFA</dt>
        <dd>
          {m2(k.gfa)}
          {k.loggiaLoss > 0.5 && <small> −{m2(k.loggiaLoss)}</small>}
        </dd>

        <ProgrammeRows gfaByUse={k.gfaByUse} />

        <dt>Plot ratio</dt>
        <dd>
          {round(k.far, 2).toFixed(2)} <small>FAR</small>
        </dd>

        <dt>Coverage</dt>
        <dd>
          {pct(k.coverage)} <small>{m2(k.footprint)}</small>
        </dd>

        <dt>NIA</dt>
        <dd>
          {m2(k.nia)} <small>{pct(k.gfa > 0 ? k.nia / k.gfa : 0)}</small>
        </dd>

        {k.coreArea > 0.5 && (
          <>
            <dt>Core</dt>
            <dd>
              {m2(k.coreArea)} <small>{pct(k.gfa > 0 ? k.coreArea / k.gfa : 0)} of GFA</small>
            </dd>
          </>
        )}

        <dt>Units</dt>
        <dd>
          {int(k.units)} <small>est.</small>
        </dd>

        <MixRows byType={k.unitsByType} untyped={k.unitsUntyped} total={k.units} />

        <dt>Tallest</dt>
        <dd>{m(k.maxHeight)}</dd>
      </dl>

      {selected && (
        <>
          <div className="head" style={{ marginTop: 9 }}>
            <span>{selected.placement.name}</span>
          </div>
          <dl>
            <dt>Floors</dt>
            <dd>
              {selected.building.metrics.topLevel} <small>{m(selected.building.metrics.height)}</small>
            </dd>
            <dt>GFA</dt>
            <dd>
              {m2(selected.building.metrics.gfa)}{' '}
              <small>{m2(selected.building.metrics.nia)} net</small>
            </dd>
            <dt>Facade</dt>
            <dd>
              {m2(selected.building.metrics.facadeArea)}{' '}
              <small>{pct(selected.building.metrics.glazedRatio)} glazed</small>
            </dd>
          </dl>
        </>
      )}

      {invalid && (
        <div className="foot warn-block">
          {k.clashes.map(([a, b]) => (
            <div key={`${a}-${b}`}>{a} overlaps {b}</div>
          ))}
          {k.offPlot.length > 0 && <div>Outside the plot: {k.offPlot.join(', ')}</div>}
          {!k.plotSimple && <div>The plot boundary crosses itself — its area is meaningless.</div>}
          {k.breaches.map((b) => (
            <div key={`${b.rule}-${b.names.join('-')}`}>{breachLine(b)}</div>
          ))}
          {(k.clashes.length > 0 || k.offPlot.length > 0) && (
            <div>Coverage and plot ratio assume no overlap.</div>
          )}
        </div>
      )}

      <div className="foot">
        {int(build.triangles)} triangles · rebuilt in {round(build.buildMs, 1)} ms
      </div>
    </div>
  )
}
