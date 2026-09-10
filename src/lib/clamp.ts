export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

export const roundTo = (v: number, step: number) =>
  Math.round(v / step) * step

/** Round to `dp` decimal places. Display-edge only. */
export const round = (v: number, dp = 0) => {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

export const EPS = 1e-4

/** Are two metre values the same plane, within construction tolerance? */
export const same = (a: number, b: number) => Math.abs(a - b) < EPS
