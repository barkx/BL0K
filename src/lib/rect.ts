import { EPS } from './clamp'

/** Axis-aligned rectangle in plan (metres, building-local). */
export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

/** A 1D interval along an elevation. */
export interface Span {
  a: number
  b: number
}

export const rectArea = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.z1 - r.z0)

export const overlaps = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) - Math.max(a0, b0) > EPS

export const contains = (r: Rect, x: number, z: number) =>
  x > r.x0 - EPS && x < r.x1 + EPS && z > r.z0 - EPS && z < r.z1 + EPS

/** What is left of `base` after removing `cuts`. Used for open facade spans. */
export function subtractSpans(base: Span, cuts: Span[]): Span[] {
  const clipped = cuts
    .map((c) => ({ a: Math.max(c.a, base.a), b: Math.min(c.b, base.b) }))
    .filter((c) => c.b - c.a > EPS)
    .sort((p, q) => p.a - q.a)

  const out: Span[] = []
  let cursor = base.a
  for (const c of clipped) {
    if (c.a - cursor > EPS) out.push({ a: cursor, b: c.a })
    cursor = Math.max(cursor, c.b)
  }
  if (base.b - cursor > EPS) out.push({ a: cursor, b: base.b })
  return out
}

const uniqueSorted = (vals: number[]) => {
  const s = [...vals].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of s) if (out.length === 0 || v - out[out.length - 1] > EPS) out.push(v)
  return out
}

/**
 * Exact union area of axis-aligned rectangles, by coordinate compression.
 * This is what stops an L-shape double-counting its corner.
 */
export function unionArea(rects: Rect[]): number {
  if (rects.length === 0) return 0
  if (rects.length === 1) return rectArea(rects[0])

  const xs = uniqueSorted(rects.flatMap((r) => [r.x0, r.x1]))
  const zs = uniqueSorted(rects.flatMap((r) => [r.z0, r.z1]))

  let area = 0
  for (let i = 0; i < xs.length - 1; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2
    for (let j = 0; j < zs.length - 1; j++) {
      const cz = (zs[j] + zs[j + 1]) / 2
      if (rects.some((r) => contains(r, cx, cz))) {
        area += (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j])
      }
    }
  }
  return area
}

/**
 * `base` minus `cuts`, as a small set of rectangles. Used to cap a roof around
 * the mass that sits on top of it — cheaper and more robust than CSG.
 */
export function subtractRects(base: Rect, cuts: Rect[]): Rect[] {
  const live = cuts.filter((c) => overlaps(c.x0, c.x1, base.x0, base.x1) && overlaps(c.z0, c.z1, base.z0, base.z1))
  if (live.length === 0) return [base]

  const xs = uniqueSorted([
    base.x0,
    base.x1,
    ...live.flatMap((c) => [c.x0, c.x1]).filter((v) => v > base.x0 + EPS && v < base.x1 - EPS),
  ])
  const zs = uniqueSorted([
    base.z0,
    base.z1,
    ...live.flatMap((c) => [c.z0, c.z1]).filter((v) => v > base.z0 + EPS && v < base.z1 - EPS),
  ])

  // Row by row, merge surviving cells along x, then merge identical rows along z.
  const rows: Rect[][] = []
  for (let j = 0; j < zs.length - 1; j++) {
    const cz = (zs[j] + zs[j + 1]) / 2
    const row: Rect[] = []
    for (let i = 0; i < xs.length - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2
      if (live.some((c) => contains(c, cx, cz))) continue
      const last = row[row.length - 1]
      if (last && Math.abs(last.x1 - xs[i]) < EPS) last.x1 = xs[i + 1]
      else row.push({ x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] })
    }
    rows.push(row)
  }

  const out: Rect[] = []
  for (const row of rows) {
    for (const cell of row) {
      const mate = out.find(
        (o) => Math.abs(o.x0 - cell.x0) < EPS && Math.abs(o.x1 - cell.x1) < EPS && Math.abs(o.z1 - cell.z0) < EPS,
      )
      if (mate) mate.z1 = cell.z1
      else out.push({ ...cell })
    }
  }
  return out
}

/** Overlapping parts of two span sets. */
export function intersectSpans(a: Span[], b: Span[]): Span[] {
  const out: Span[] = []
  for (const p of a) {
    for (const q of b) {
      const lo = Math.max(p.a, q.a)
      const hi = Math.min(p.b, q.b)
      if (hi - lo > EPS) out.push({ a: lo, b: hi })
    }
  }
  return out.sort((p, q) => p.a - q.a)
}
