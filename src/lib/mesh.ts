import { BufferAttribute, BufferGeometry } from 'three'

export type V3 = [number, number, number]

/**
 * Accumulates flat-shaded quads into one non-indexed buffer.
 *
 * `quad` takes an optional outward-normal hint and reverses the winding if the
 * quad came out facing the wrong way — cheaper than reasoning about handedness
 * at every call site, and it makes the intent readable.
 *
 * This is the hot loop of the whole app: a 30-floor courtyard block emits tens
 * of thousands of quads on every rebuild. So it writes scalars straight into
 * growable typed arrays — no per-vertex vector objects, no spread pushes, and
 * no array-to-Float32Array copy at the end.
 */
export class MeshBuilder {
  private pos: Float32Array
  private nrm: Float32Array
  private uv: Float32Array
  /** Vertices written so far. */
  private count = 0

  constructor(expectedQuads = 512) {
    const verts = Math.max(24, expectedQuads * 6)
    this.pos = new Float32Array(verts * 3)
    this.nrm = new Float32Array(verts * 3)
    this.uv = new Float32Array(verts * 2)
  }

  get triangles() {
    return this.count / 3
  }

  get isEmpty() {
    return this.count === 0
  }

  private grow() {
    const verts = (this.pos.length / 3) * 2
    const pos = new Float32Array(verts * 3)
    const nrm = new Float32Array(verts * 3)
    const uv = new Float32Array(verts * 2)
    pos.set(this.pos)
    nrm.set(this.nrm)
    uv.set(this.uv)
    this.pos = pos
    this.nrm = nrm
    this.uv = uv
  }

  quad(a: V3, b: V3, c: V3, d: V3, hint?: V3) {
    this.quadRaw(
      a[0], a[1], a[2],
      b[0], b[1], b[2],
      c[0], c[1], c[2],
      d[0], d[1], d[2],
      hint,
    )
  }

  quadRaw(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    hint?: V3,
  ) {
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az
    let nx = e1y * e2z - e1z * e2y
    let ny = e1z * e2x - e1x * e2z
    let nz = e1x * e2y - e1y * e2x
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (l < 1e-9) return
    nx /= l
    ny /= l
    nz /= l

    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      // Reverse the winding by swapping b and d, and flip the normal with it.
      let t = bx; bx = dx; dx = t
      t = by; by = dy; dy = t
      t = bz; bz = dz; dz = t
      nx = -nx
      ny = -ny
      nz = -nz
    }

    if ((this.count + 6) * 3 > this.pos.length) this.grow()

    // Metre-scaled UVs so PBR textures tile at a believable size.
    const w = Math.hypot(bx - ax, by - ay, bz - az)
    const h = Math.hypot(dx - ax, dy - ay, dz - az)

    const pos = this.pos
    const nrm = this.nrm
    const uv = this.uv
    let p = this.count * 3
    const t = this.count * 2

    pos[p] = ax; pos[p + 1] = ay; pos[p + 2] = az
    pos[p + 3] = bx; pos[p + 4] = by; pos[p + 5] = bz
    pos[p + 6] = cx; pos[p + 7] = cy; pos[p + 8] = cz
    pos[p + 9] = ax; pos[p + 10] = ay; pos[p + 11] = az
    pos[p + 12] = cx; pos[p + 13] = cy; pos[p + 14] = cz
    pos[p + 15] = dx; pos[p + 16] = dy; pos[p + 17] = dz

    for (let i = 0; i < 6; i++, p += 3) {
      nrm[p] = nx
      nrm[p + 1] = ny
      nrm[p + 2] = nz
    }

    uv[t] = 0; uv[t + 1] = 0
    uv[t + 2] = w; uv[t + 3] = 0
    uv[t + 4] = w; uv[t + 5] = h
    uv[t + 6] = 0; uv[t + 7] = 0
    uv[t + 8] = w; uv[t + 9] = h
    uv[t + 10] = 0; uv[t + 11] = h

    this.count += 6
  }

  /**
   * A single triangle. Quads cover almost everything this app builds, but a
   * triangulated cap — an OSM building's roof, say — has no fourth corner to
   * invent, and folding one in would emit a degenerate half.
   */
  tri(a: V3, b: V3, c: V3, hint?: V3) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2]
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2]
    let nx = e1y * e2z - e1z * e2y
    let ny = e1z * e2x - e1x * e2z
    let nz = e1x * e2y - e1y * e2x
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (l < 1e-9) return
    nx /= l
    ny /= l
    nz /= l

    let [p0, p1, p2] = [a, b, c]
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      ;[p1, p2] = [p2, p1]
      nx = -nx
      ny = -ny
      nz = -nz
    }

    if ((this.count + 3) * 3 > this.pos.length) this.grow()
    let p = this.count * 3
    let t = this.count * 2
    for (const v of [p0, p1, p2]) {
      this.pos[p] = v[0]
      this.pos[p + 1] = v[1]
      this.pos[p + 2] = v[2]
      this.nrm[p] = nx
      this.nrm[p + 1] = ny
      this.nrm[p + 2] = nz
      this.uv[t] = v[0]
      this.uv[t + 1] = v[2]
      p += 3
      t += 2
    }
    this.count += 3
  }

  toGeometry(): BufferGeometry {
    const g = new BufferGeometry()
    // Views onto the accumulated buffers — no copy.
    g.setAttribute('position', new BufferAttribute(this.pos.subarray(0, this.count * 3), 3))
    g.setAttribute('normal', new BufferAttribute(this.nrm.subarray(0, this.count * 3), 3))
    g.setAttribute('uv', new BufferAttribute(this.uv.subarray(0, this.count * 2), 2))
    g.computeBoundingSphere()
    return g
  }
}

/** A horizontal rectangle at height `y`, facing up or down. */
export function horizontalQuad(
  b: MeshBuilder,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  up: boolean,
) {
  b.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], up ? [0, 1, 0] : [0, -1, 0])
}
