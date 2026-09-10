import { useStore } from '../store/store'
import { int, m, m2, pct } from '../lib/units'
import { round } from '../lib/clamp'

export function MetricsPanel() {
  const b = useStore((s) => s.building)
  const p = useStore((s) => s.params)
  const k = b.metrics

  return (
    <div className="metrics">
      <div className="head">
        <span>
          {k.topLevel} floors
          <span style={{ color: 'var(--ink-faint)' }}> · </span>
          {m(k.height)}
        </span>
      </div>
      <dl>
        <dt>GFA</dt>
        <dd>
          {m2(k.gfa)}
          {k.loggiaLoss > 0.5 && <small> −{m2(k.loggiaLoss)}</small>}
        </dd>

        <dt>Units</dt>
        <dd>
          {int(k.units)} <small>est.</small>
        </dd>

        <dt>Facade</dt>
        <dd>
          {m2(k.facadeArea)} <small>{pct(k.glazedRatio)} glazed</small>
        </dd>

        <dt>Footprint</dt>
        <dd>{m2(k.footprintArea)}</dd>

        <dt>Coverage</dt>
        <dd>
          {pct(k.coverage)} <small>of {m2(p.siteArea)}</small>
        </dd>

        {k.balconyArea > 0.5 && (
          <>
            <dt>Balcony</dt>
            <dd>{m2(k.balconyArea)}</dd>
          </>
        )}
      </dl>
      <div className="foot">
        {int(k.modules)} modules · {int(k.modulesPerFloor)} on level 0 ·{' '}
        {int(b.triangles)} triangles · rebuilt in {round(b.buildMs, 1)} ms
        {b.balconies.barsCollapsed && (
          <>
            <br />
            Bar balustrades exceeded the instance budget — shown as solid infill.
          </>
        )}
      </div>
    </div>
  )
}
