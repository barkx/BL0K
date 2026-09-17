import { round } from '../lib/clamp'
import { RULE_KIND, RULE_LABEL, RULE_ORDER, RULE_SENSE, type RuleKey } from '../site/rules'
import type { SiteBuild } from '../site/build'
import { PUBLIC_USES, USE_LABEL, type Use } from '../store/program'
import type { Site } from '../site/types'

/**
 * The metrics panel as a spreadsheet.
 *
 * Deliberately *not* formatted the way the UI formats: a cell has to be a
 * number a spreadsheet can sum, so no thin-space grouping, no "m²" suffix and
 * no percent signs. The unit lives in the column heading instead, which is why
 * `lib/units.ts` is not imported here.
 *
 * Four tables in one file, separated by blank lines. Excel, Numbers and
 * LibreOffice all cope, and it reads as a report rather than as a dump.
 */

const CRLF = '\r\n'

/** Quote a field only when it needs it — a plain name should stay plain. */
function cell(value: string | number): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    // Four places, not two: a coverage of 0.10505 rounded to 0.11 would report
    // a whole percentage point of the plot that is not there. Areas are
    // unaffected — they never carry that many decimals.
    return String(round(value, 4))
  }
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

const row = (values: (string | number)[]) => values.map(cell).join(',')

/** A rule's numbers read differently: metres, a share of the plot, or a ratio. */
function ruleUnit(rule: RuleKey): string {
  const kind = RULE_KIND[rule]
  return kind === 'length' ? 'm' : kind === 'share' ? 'fraction of plot' : 'ratio'
}

export function siteCsv(site: Site, build: SiteBuild, when = new Date()): string {
  const k = build.metrics
  const lines: string[] = []

  lines.push(row(['URBGEN site metrics', when.toISOString()]))
  lines.push('')

  lines.push('Site')
  lines.push(row(['Plot area (m2)', k.plotArea]))
  lines.push(row(['Plot corners', site.plot.length]))
  lines.push(row(['Buildings', k.buildings]))
  lines.push(row(['Footprint (m2)', k.footprint]))
  lines.push(row(['Coverage (fraction)', k.coverage]))
  lines.push(row(['GFA (m2)', k.gfa]))
  // Always written, zeros included: a spreadsheet column that appears only on
  // some schemes cannot be compared across them.
  for (const use of ['residential', ...PUBLIC_USES] as Use[]) {
    lines.push(row([`GFA ${USE_LABEL[use].toLowerCase()} (m2)`, k.gfaByUse[use]]))
  }
  lines.push(row(['Core area (m2)', k.coreArea]))
  lines.push(row(['NIA (m2)', k.nia]))
  lines.push(row(['Efficiency (fraction)', k.gfa > 0 ? k.nia / k.gfa : 0]))
  lines.push(row(['Plot ratio (FAR)', k.far]))
  lines.push(row(['Facade area (m2)', k.facadeArea]))
  lines.push(row(['Balcony area (m2)', k.balconyArea]))
  lines.push(row(['Loggia deduction (m2)', k.loggiaLoss]))
  lines.push(row(['Units (estimate)', k.units]))
  lines.push(row(['Tallest (m)', k.maxHeight]))
  lines.push('')

  lines.push('Buildings')
  lines.push(
    row([
      'Name',
      'Preset',
      'X (m)',
      'Z (m)',
      'Rotation (deg)',
      'Floors',
      'Height (m)',
      'Footprint (m2)',
      'GFA (m2)',
      'Cores',
      'Core placement',
      'Core area (m2)',
      'NIA (m2)',
      'Efficiency (fraction)',
      'Facade (m2)',
      'Glazed (m2)',
      'Glazed ratio',
      'Balcony (m2)',
      'Loggia deduction (m2)',
      'Modules',
      'Units (estimate)',
    ]),
  )
  for (const { placement, building } of build.placed) {
    const m = building.metrics
    lines.push(
      row([
        placement.name,
        placement.params.preset,
        placement.position.x,
        placement.position.z,
        placement.rotation,
        m.topLevel,
        m.height,
        m.footprintArea,
        m.gfa,
        building.cores.cores.length,
        placement.params.coreCount > 0 ? placement.params.corePlacement : '',
        m.coreArea,
        m.nia,
        placement.params.efficiency,
        m.facadeArea,
        m.glazedArea,
        m.glazedRatio,
        m.balconyArea,
        m.loggiaLoss,
        m.modules,
        m.units,
      ]),
    )
  }
  lines.push('')

  // Rules that are off are still listed, so the file says what was checked
  // rather than leaving the reader to guess.
  lines.push('Rules')
  lines.push(row(['Rule', 'Unit', 'Limit', 'Worst in scheme', 'Status', 'Buildings']))
  for (const rule of RULE_ORDER) {
    const limit = site.rules[rule]
    const hits = k.breaches.filter((b) => b.rule === rule)
    if (limit <= 0) {
      lines.push(row([RULE_LABEL[rule], ruleUnit(rule), '', '', 'off', '']))
      continue
    }
    // Worst means furthest the wrong way: least clearance, or highest overrun.
    const actuals = hits.map((b) => b.actual)
    const worst = actuals.length
      ? RULE_SENSE[rule] === 'minimum'
        ? Math.min(...actuals)
        : Math.max(...actuals)
      : null
    lines.push(
      row([
        RULE_LABEL[rule],
        ruleUnit(rule),
        limit,
        worst ?? '',
        hits.length ? 'breach' : 'met',
        hits.flatMap((b) => b.names).join(' / '),
      ]),
    )
  }
  lines.push('')

  lines.push('Warnings')
  lines.push(row(['Kind', 'Detail']))
  for (const [a, b] of k.clashes) lines.push(row(['clash', `${a} overlaps ${b}`]))
  for (const name of k.offPlot) lines.push(row(['off plot', name]))
  if (!k.plotSimple) lines.push(row(['boundary', 'The plot boundary crosses itself']))

  return lines.join(CRLF) + CRLF
}
