import { round } from './clamp'

/** Formatting lives at the display edge. Internals are always metres. */

const group = (v: number) =>
  v.toLocaleString('en-GB', { useGrouping: true }).replace(/,/g, '\u2009')

/** Area, whole square metres. */
export const m2 = (v: number) => `${group(round(v))} m²`

/** Length, one decimal place. */
export const m = (v: number) => `${round(v, 1).toFixed(1)} m`

/** Length, two decimals — for facade dimensions where 10 mm matters. */
export const mm = (v: number) => `${round(v, 2).toFixed(2)} m`

export const int = (v: number) => group(Math.round(v))

export const pct = (v: number) => `${round(v * 100, 1).toFixed(1)}%`
