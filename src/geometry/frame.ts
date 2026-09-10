import { MeshBuilder, type V3 } from '../lib/mesh'
import type { Elevation } from './elevations'

/**
 * An elevation's local frame, resolved once per elevation. Everything the
 * facade builders draw is an axis-aligned rectangle in (u, out, y): `u` along
 * the elevation, `out` in front of the face, `y` up.
 *
 * The direction hints are cached here rather than rebuilt per quad — at 30
 * floors the builders emit tens of thousands of quads, and allocating four
 * points and a normal for each one was the single largest cost in the rebuild.
 */
export interface Frame {
  ox: number
  oz: number
  ux: number
  uz: number
  nx: number
  nz: number
  out: V3
  negOut: V3
  tan: V3
  negTan: V3
}

export const UP: V3 = [0, 1, 0]
export const DOWN: V3 = [0, -1, 0]

export function frameOf(e: Elevation): Frame {
  return {
    ox: e.origin.x,
    oz: e.origin.z,
    ux: e.uDir.x,
    uz: e.uDir.z,
    nx: e.normal.x,
    nz: e.normal.z,
    out: [e.normal.x, 0, e.normal.z],
    negOut: [-e.normal.x, 0, -e.normal.z],
    tan: [e.uDir.x, 0, e.uDir.z],
    negTan: [-e.uDir.x, 0, -e.uDir.z],
  }
}

const MIN = 1e-4

/** Rectangle on a plane parallel to the face, `out` metres in front of it. */
export function faceRect(
  b: MeshBuilder,
  f: Frame,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  out: number,
  hint: V3 = f.out,
) {
  if (u1 - u0 < MIN || y1 - y0 < MIN) return
  const ax = f.ox + f.ux * u0 + f.nx * out
  const az = f.oz + f.uz * u0 + f.nz * out
  const bx = f.ox + f.ux * u1 + f.nx * out
  const bz = f.oz + f.uz * u1 + f.nz * out
  b.quadRaw(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az, hint)
}

/** Rectangle perpendicular to the face at a fixed `u` — a jamb or a cheek. */
export function cheekRect(
  b: MeshBuilder,
  f: Frame,
  u: number,
  o0: number,
  o1: number,
  y0: number,
  y1: number,
  hint: V3,
) {
  if (Math.abs(o1 - o0) < MIN || y1 - y0 < MIN) return
  const ax = f.ox + f.ux * u + f.nx * o0
  const az = f.oz + f.uz * u + f.nz * o0
  const bx = f.ox + f.ux * u + f.nx * o1
  const bz = f.oz + f.uz * u + f.nz * o1
  b.quadRaw(ax, y0, az, ax, y1, az, bx, y1, bz, bx, y0, bz, hint)
}

/** Horizontal rectangle at a fixed `y` — a head, a sill, a soffit, a coping. */
export function shelfRect(
  b: MeshBuilder,
  f: Frame,
  u0: number,
  u1: number,
  o0: number,
  o1: number,
  y: number,
  hint: V3,
) {
  if (u1 - u0 < MIN || Math.abs(o1 - o0) < MIN) return
  const ax = f.ox + f.ux * u0 + f.nx * o0
  const az = f.oz + f.uz * u0 + f.nz * o0
  const bx = f.ox + f.ux * u1 + f.nx * o0
  const bz = f.oz + f.uz * u1 + f.nz * o0
  const cx = f.ox + f.ux * u1 + f.nx * o1
  const cz = f.oz + f.uz * u1 + f.nz * o1
  const dx = f.ox + f.ux * u0 + f.nx * o1
  const dz = f.oz + f.uz * u0 + f.nz * o1
  b.quadRaw(ax, y, az, bx, y, bz, cx, y, cz, dx, y, dz, hint)
}
