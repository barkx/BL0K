import { useStore } from '../store/store'
import { int, m, m2, pct } from '../lib/units'
import { round } from '../lib/clamp'
import { RULE_KIND, RULE_LABEL, RULE_SENSE, type Breach } from '../site/rules'

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
