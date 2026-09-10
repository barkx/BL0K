/**
 * Seeded randomness only. A building that changes when you look away is a bug.
 *
 * Two flavours:
 *  - `makeRng(seed)` — a sequential stream, for one-shot generation.
 *  - `hash01(seed, ...address)` — a stable value for a *coordinate*. Prefer this
 *    in geometry: the value for module (mass, elevation, floor, index) must not
 *    depend on the order we happen to visit modules in.
 */

export type Rng = () => number

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic [0,1) from a seed plus an integer address of any length. */
export function hash01(seed: number, ...address: number[]): number {
  let h = (seed >>> 0) ^ 0x9e3779b9
  for (let i = 0; i < address.length; i++) {
    h ^= (address[i] | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2)
    h = h >>> 0
  }
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296
}

/** Pick one of `n` buckets, deterministically, for an address. */
export const hashPick = (n: number, seed: number, ...address: number[]) =>
  Math.floor(hash01(seed, ...address) * n) % n
