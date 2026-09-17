import { footprint, levels, topLevel, type Mass } from '../geometry/masses'
import type { Elevation } from '../geometry/elevations'
import type { FacadeModel, ModuleSlot, Opening } from '../geometry/facade'
import {
  loggiaHeadEdge,
  RAIL_CAP,
  RAIL_HEIGHT,
  SLAB_THICKNESS as BALCONY_SLAB,
} from '../geometry/balcony'
import type { Params } from '../store/params'
import type { SiteBuild } from '../site/build'
import type { Site } from '../site/types'
import { compoundAngle } from '../geo/project'

/**
 * The site as an IFC4 STEP physical file.
 *
 * Written by hand rather than through a library, which keeps the
 * no-dependency, offline rules intact — an IFC file is text, and the awkward
 * part was never the encoding. The whole file is one pass of string building
 * with no three.js and no scene access, so it runs under node and can be
 * checked there.
 *
 * **Why IFC rather than more glTF.** glTF carries triangles; nobody continues a
 * project from triangles. IFC carries a *building*: storeys you can list, walls
 * you can schedule, openings a receiving application resolves itself. And the
 * app's model is already closer to IFC's shape than to glTF's — `buildWalls`
 * assembles panels around a void because there is no CSG here, but IFC wants
 * the un-perforated wall plus an `IfcOpeningElement` that voids it, which is
 * exactly the pair the facade model already holds.
 *
 * ## Two dimensions the app does not model
 *
 * A massing tool has surfaces where a BIM model has thicknesses. Neither of
 * these exists anywhere in `geometry/`, so the export has to invent them, and
 * an invented number must be visible rather than buried:
 *
 * - `WALL_THICKNESS` — facades are zero-thickness panels in the app.
 * - `SLAB_THICKNESS` — floors are not built at all; only levels exist.
 *
 * They are stated here, quoted in the UI next to the button, and recorded in
 * README § Deviations. Anything downstream that measures a wall or a slab is
 * measuring this assumption, not a result.
 */

/** Metres. Export-only assumptions — see the note above. */
export const WALL_THICKNESS = 0.3
export const SLAB_THICKNESS = 0.25
/** A pane has to have some depth to be a solid at all. */
export const GLAZING_THICKNESS = 0.05

/**
 * A balustrade's panel thickness.
 *
 * The app can draw a balustrade as vertical bars, and does — but bars are a
 * viewport affordance, not a thing to write out: one scheme's 60 000 bars would
 * be 60 000 rooted IFC elements for no information gain. Every variant exports
 * as one panel per run, which is what a receiving application needs in order to
 * know a guard is there and how thick it is.
 */
const railThickness = (kind: Params['balustrade']) =>
  kind === 'solid' ? 0.16 : GLAZING_THICKNESS

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

/**
 * The app is Y-up with the plan in XZ; IFC is Z-up with the plan in XY.
 *
 * The map is `(x, y, z) -> (x, y_ifc = -z, z_ifc = y)`. Negating z rather than
 * keeping it is what preserves handedness — its determinant is +1, so a
 * building does not come out mirrored, which is the classic way to get this
 * wrong and not notice until someone reads the plan.
 */
const plan = (x: number, z: number): [number, number] => [x, -z]

/**
 * A point authored the way the facade is: `u` along an elevation, `out` in
 * front of its face, `z` above the hosting storey — delivered in IFC's frame.
 *
 * Every wall, window, recess and balustrade is positioned this way, so the one
 * place the app's XZ meets IFC's XY is here.
 */
function at3(
  e: Elevation,
  u: number,
  out: number,
  z: number,
): [number, number, number] {
  const [x, y] = plan(
    e.origin.x + e.uDir.x * u + e.normal.x * out,
    e.origin.z + e.uDir.z * u + e.normal.z * out,
  )
  return [x, y, z]
}

/**
 * A rotation of `deg` about the app's Y axis is the same rotation about IFC's
 * Z, counter-clockwise, so the reference direction is just (cos, sin).
 * Worked through from `place()` in `lib/poly.ts` rather than guessed.
 */
const refDirection = (deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180
  return [Math.cos(r), Math.sin(r)]
}

// ---------------------------------------------------------------------------
// STEP encoding
// ---------------------------------------------------------------------------

/** IFC reals always carry a point: `7` is not valid where `7.` is. */
function num(v: number): string {
  // Six places, then trailing zeros trimmed. Rounding here rather than letting
  // float noise through is also what keeps two exports of one scheme identical.
  const r = Math.round(v * 1e6) / 1e6
  if (Number.isInteger(r)) return `${r}.`
  return String(r)
}

const str = (s: string) =>
  // STEP escapes a single quote by doubling it; anything outside the basic set
  // would need \X2\ encoding, so non-ASCII is transliterated away instead.
  `'${s.replace(/'/g, "''").replace(/[^\x20-\x7e]/g, '?')}'`

/** FNV-1a, four times with different offsets, for 128 deterministic bits. */
function bits128(key: string): bigint {
  let out = 0n
  for (const offset of [0x811c9dc5, 0x01000193, 0x7fffffff, 0x9e3779b9]) {
    let h = offset >>> 0
    for (let i = 0; i < key.length; i++) {
      h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0
    }
    out = (out << 32n) | BigInt(h)
  }
  return out
}

const GUID64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'

/**
 * An IFC GlobalId: 128 bits in 22 characters of IFC's own base-64.
 *
 * Derived from a stable key rather than randomly, so exporting the same scheme
 * twice gives the same file. Determinism is a claim this project makes
 * everywhere else; an export full of fresh GUIDs would quietly break it, and
 * would also make every re-export look like a wholly new model to anything
 * downstream that tracks elements by id.
 */
export function ifcGuid(key: string): string {
  let v = bits128(key)
  const out: string[] = new Array(22)
  // The leading character holds 2 bits; the remaining 21 hold 6 each.
  for (let i = 21; i >= 1; i--) {
    out[i] = GUID64[Number(v & 63n)]
    v >>= 6n
  }
  out[0] = GUID64[Number(v & 3n)]
  return out.join('')
}

/**
 * Accumulates numbered STEP entities.
 *
 * `shared` deduplicates value-like entities — points, directions, profiles. A
 * thirty-floor courtyard emits the same `IFCDIRECTION((0.,0.,1.))` thousands of
 * times, and folding those into one line is most of the difference between a
 * file that opens briskly and one that does not. Rooted entities carry a
 * GlobalId and must stay unique, so they go through `add`.
 */
class Step {
  private lines: string[] = []
  private pool = new Map<string, number>()
  private next = 1

  add(body: string): number {
    const id = this.next++
    this.lines.push(`#${id}=${body};`)
    return id
  }

  shared(body: string): number {
    const hit = this.pool.get(body)
    if (hit !== undefined) return hit
    const id = this.add(body)
    this.pool.set(body, id)
    return id
  }

  get count() {
    return this.next - 1
  }

  body(): string {
    return this.lines.join('\n')
  }
}

// --- geometry primitives, all shared ---------------------------------------

const point3 = (s: Step, x: number, y: number, z: number) =>
  s.shared(`IFCCARTESIANPOINT((${num(x)},${num(y)},${num(z)}))`)

const point2 = (s: Step, x: number, y: number) =>
  s.shared(`IFCCARTESIANPOINT((${num(x)},${num(y)}))`)

const direction3 = (s: Step, x: number, y: number, z: number) =>
  s.shared(`IFCDIRECTION((${num(x)},${num(y)},${num(z)}))`)

const direction2 = (s: Step, x: number, y: number) =>
  s.shared(`IFCDIRECTION((${num(x)},${num(y)}))`)

/** `axis` and `refDirection` left as `$` mean IFC's defaults: +Z and +X. */
function axis3(s: Step, at: [number, number, number], ref?: [number, number]): number {
  const p = point3(s, at[0], at[1], at[2])
  const d = ref ? direction3(s, ref[0], ref[1], 0) : null
  return s.shared(`IFCAXIS2PLACEMENT3D(#${p},$,${d ? `#${d}` : '$'})`)
}

const axis2 = (s: Step, at: [number, number]) =>
  s.shared(`IFCAXIS2PLACEMENT2D(#${point2(s, at[0], at[1])},$)`)

const localPlacement = (s: Step, parent: number | null, relative: number) =>
  s.shared(`IFCLOCALPLACEMENT(${parent ? `#${parent}` : '$'},#${relative})`)

/**
 * A box: a rectangular profile centred on `at`, extruded up by `height`.
 *
 * `IfcRectangleProfileDef` is centred on its own origin, which is why every
 * caller passes a centre rather than a corner — a mistake worth making once.
 */
function boxSolid(
  s: Step,
  xDim: number,
  yDim: number,
  height: number,
  at: [number, number, number],
  ref?: [number, number],
): number {
  const profile = s.shared(
    `IFCRECTANGLEPROFILEDEF(.AREA.,$,#${axis2(s, [0, 0])},${num(xDim)},${num(yDim)})`,
  )
  const position = axis3(s, at, ref)
  const up = direction3(s, 0, 0, 1)
  return s.shared(
    `IFCEXTRUDEDAREASOLID(#${profile},#${position},#${up},${num(height)})`,
  )
}

/** Several solids under one representation, for an element built of parts. */
const shapeOfAll = (s: Step, body: number, solids: number[]) => {
  const items = solids.map((id) => `#${id}`).join(',')
  const rep = s.add(`IFCSHAPEREPRESENTATION(#${body},'Body','SweptSolid',(${items}))`)
  return s.add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${rep}))`)
}

const shapeOf = (s: Step, body: number, solid: number) => shapeOfAll(s, body, [solid])

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

interface Context {
  s: Step
  owner: number
  body: number
  /** Guarded so two buildings of the same name cannot collide on a GlobalId. */
  guid: (...parts: (string | number)[]) => string
}

/** Floor plates and a roof, one per level the mass occupies. */
function slabsFor(
  ctx: Context,
  mass: Mass,
  storeyPlacement: Map<number, number>,
  floorHeight: number,
  key: string,
): { id: number; level: number }[] {
  const { s, owner, body } = ctx
  const r = footprint(mass)
  const [cx, cy] = plan((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2)
  const xDim = r.x1 - r.x0
  const yDim = Math.abs(r.z1 - r.z0)

  const out: { id: number; level: number }[] = []
  const top = mass.baseFloor + mass.floors
  for (let level = mass.baseFloor; level <= top; level++) {
    const parent = storeyPlacement.get(Math.min(level, top - 1))
    if (parent === undefined) continue
    // A slab hangs below the level it belongs to, so its top is the floor you
    // stand on. The roof slab is the one at the mass's top.
    const roof = level === top
    const zLocal = (level - Math.min(level, top - 1)) * floorHeight - SLAB_THICKNESS
    const solid = boxSolid(s, xDim, yDim, SLAB_THICKNESS, [cx, cy, zLocal])
    const shape = shapeOf(s, body, solid)
    const id = s.add(
      `IFCSLAB(${str(ctx.guid(key, 'slab', mass.id, level))},#${owner},` +
        `${str(roof ? `Roof ${mass.id}` : `Slab ${mass.id} L${level}`)},$,$,` +
        `#${localPlacement(s, parent, axis3(s, [0, 0, 0]))},#${shape},$,` +
        `${roof ? '.ROOF.' : '.FLOOR.'})`,
    )
    out.push({ id, level: Math.min(level, top - 1) })
  }
  return out
}

/**
 * One wall per exterior run, per floor.
 *
 * `openByFloor` has already removed whatever a junction buries, so each span is
 * a real stretch of outside wall. Blanked stretches — where a core meets the
 * facade — stay walls here: they are solid masonry, and only the windows were
 * taken out.
 */
/**
 * Windows, as IFC wants them: a void through the wall and a panel filling it.
 *
 * This is the stage that carries the thing the app is actually for. `buildWalls`
 * assembles bands and piers around each opening because there is no CSG here —
 * but IFC asks for the opposite and easier thing, a whole wall plus an
 * `IfcOpeningElement` that voids it, and leaves the subtraction to whatever
 * opens the file. The app already holds both halves of that pair.
 *
 * A window's `setback` is how far behind the facade plane its wall stands: zero
 * on open facade, a loggia's depth at the back of a recess. The caller decides
 * which wall hosts it and the setback puts it in that wall — which is why this
 * had to wait for the recess to be cut. Punching a loggia window through the
 * facade plane, as a version of this that ignored `setback` would, puts a hole
 * in a wall it does not belong to, and looks entirely right while doing it.
 */
function openingsIn(
  ctx: Context,
  e: Elevation,
  wall: number,
  ops: Opening[],
  span: { a: number; b: number },
  level: number,
  floorHeight: number,
  parent: number,
  ref: [number, number],
  key: string,
): { id: number; level: number }[] {
  const { s, owner, body } = ctx
  const windows: { id: number; level: number }[] = []

  for (const o of ops) {
    if (o.u0 < span.a - 1e-6 || o.u1 > span.b + 1e-6) continue

    const width = o.u1 - o.u0
    const height = o.y1 - o.y0
    if (width <= 1e-6 || height <= 1e-6) continue

    const u = (o.u0 + o.u1) / 2
    const centre = at3(
      e,
      u,
      -(o.setback + WALL_THICKNESS / 2),
      // The wall's placement is the storey's, so heights here are relative to it.
      o.y0 - level * floorHeight,
    )
    const [px, py, zLocal] = centre

    const voidSolid = boxSolid(s, width, WALL_THICKNESS, height, [px, py, zLocal], ref)
    const opening = s.add(
      `IFCOPENINGELEMENT(${str(ctx.guid(key, 'opening', e.key, level, o.moduleIndex, o.u0))},` +
        `#${owner},${str('Opening')},$,$,#${localPlacement(s, parent, axis3(s, [0, 0, 0]))},` +
        `#${shapeOf(s, body, voidSolid)},$,.OPENING.)`,
    )
    // An opening is not contained in a storey; it belongs to the wall it cuts.
    s.add(
      `IFCRELVOIDSELEMENT(${str(ctx.guid(key, 'voids', e.key, level, o.moduleIndex, o.u0))},` +
        `#${owner},$,$,#${wall},#${opening})`,
    )

    const pane = boxSolid(s, width, GLAZING_THICKNESS, height, [px, py, zLocal], ref)
    const window = s.add(
      `IFCWINDOW(${str(ctx.guid(key, 'window', e.key, level, o.moduleIndex, o.u0))},#${owner},` +
        `${str(`Window ${e.key} L${level}`)},$,$,` +
        `#${localPlacement(s, parent, axis3(s, [0, 0, 0]))},#${shapeOf(s, body, pane)},$,` +
        `${num(height)},${num(width)},.WINDOW.,.SINGLE_PANEL.,$)`,
    )
    s.add(
      `IFCRELFILLSELEMENT(${str(ctx.guid(key, 'fills', e.key, level, o.moduleIndex, o.u0))},` +
        `#${owner},$,$,#${opening},#${window})`,
    )
    // The filling element *is* contained in the storey, so it shows up in a
    // model tree and a schedule rather than only hanging off the opening.
    windows.push({ id: window, level })
  }
  return windows
}

/**
 * A loggia: the recess cut into the facade, the wall closing the back of it,
 * and the two returns closing its sides.
 *
 * The app builds a loggia as panels around a void, because it has no CSG. IFC
 * wants the recess stated as a void, so the facade wall stays one whole wall
 * and an `IfcOpeningElement` takes the slot out of it — the same trade the
 * windows already make, one scale up.
 *
 * The three walls are what actually encloses the room behind. Without them the
 * loggia is a hole into the neighbouring flats, and every downstream area,
 * volume and energy calculation reads the building as open to the weather.
 *
 * The head band survives: the recess stops short of the floor above by the same
 * `loggiaHeadEdge` the viewport cuts to, so a stack of loggias reads as a stack
 * rather than one continuous slot.
 */
function loggiaIn(
  ctx: Context,
  e: Elevation,
  wall: number,
  m: ModuleSlot,
  ops: Opening[],
  span: { a: number; b: number },
  level: number,
  p: Params,
  parent: number,
  ref: [number, number],
  key: string,
): { id: number; level: number }[] {
  const { s, owner, body } = ctx
  const out: { id: number; level: number }[] = []

  const d = p.balconyDepth
  const t = WALL_THICKNESS
  const width = m.bu1 - m.bu0
  const uc = (m.bu0 + m.bu1) / 2
  const zBase = m.yBase - level * p.floorHeight
  const edge = loggiaHeadEdge(p.floorHeight)
  const clear = p.floorHeight - edge
  const place = localPlacement(s, parent, axis3(s, [0, 0, 0]))

  // The recess, as a void right through the facade wall.
  const slot = boxSolid(s, width, t, clear, at3(e, uc, -t / 2, zBase), ref)
  const opening = s.add(
    `IFCOPENINGELEMENT(${str(ctx.guid(key, 'recess', e.key, level, m.index))},#${owner},` +
      `${str('Loggia recess')},$,$,#${place},#${shapeOf(s, body, slot)},$,.OPENING.)`,
  )
  s.add(
    `IFCRELVOIDSELEMENT(${str(ctx.guid(key, 'recess-voids', e.key, level, m.index))},` +
      `#${owner},$,$,#${wall},#${opening})`,
  )

  // The back of the recess. Full floor height: above the head it is simply the
  // wall of the room, and the facade's head band in front of it is the slab
  // edge, not a second skin.
  const back = s.add(
    `IFCWALL(${str(ctx.guid(key, 'loggia-back', e.key, level, m.index))},#${owner},` +
      `${str(`Loggia back ${e.key} L${level}`)},$,$,#${place},` +
      `#${shapeOf(s, body, boxSolid(s, width, t, p.floorHeight, at3(e, uc, -(d + t / 2), zBase), ref))},` +
      `$,.SOLIDWALL.)`,
  )
  out.push({ id: back, level })

  // The two returns, running from the facade plane back to meet it. They sit
  // outside the clear span, so the recess keeps the width the app drew.
  for (const [side, u] of [
    ['L', m.bu0 - t / 2],
    ['R', m.bu1 + t / 2],
  ] as const) {
    const solid = boxSolid(s, t, d + t, clear, at3(e, u, -(d + t) / 2, zBase), ref)
    out.push({
      id: s.add(
        `IFCWALL(${str(ctx.guid(key, 'loggia-side', e.key, level, m.index, side))},#${owner},` +
          `${str(`Loggia return ${e.key} L${level}`)},$,$,#${place},` +
          `#${shapeOf(s, body, solid)},$,.SOLIDWALL.)`,
      ),
      level,
    })
  }

  // Now the windows have a wall to sit in. Their `setback` is the recess depth,
  // so `openingsIn` lands them in the back wall rather than the facade plane.
  out.push(...openingsIn(ctx, e, back, ops, span, level, p.floorHeight, parent, ref, key))
  return out
}

/**
 * A balcony's deck and its balustrade.
 *
 * A projecting balcony gets a slab of its own and a guard on three sides; a
 * loggia stands on the building's own floor and gets a guard only across its
 * front. That is the same split `buildBalconies` makes, and for the same
 * reason — a loggia's sides are walls, not edges.
 *
 * `IfcSlabTypeEnum` has no balcony member, so the deck goes out as
 * `.USERDEFINED.` with the ObjectType saying what it is, rather than being
 * mislabelled a floor and turning up in a floor-area schedule.
 */
function balconyFor(
  ctx: Context,
  e: Elevation,
  m: ModuleSlot,
  level: number,
  p: Params,
  parent: number,
  ref: [number, number],
  key: string,
): { id: number; level: number }[] {
  const { s, owner, body } = ctx
  const out: { id: number; level: number }[] = []
  if (m.balcony === 'none') return out

  const d = p.balconyDepth
  const width = m.bu1 - m.bu0
  const uc = (m.bu0 + m.bu1) / 2
  const zBase = m.yBase - level * p.floorHeight
  const place = localPlacement(s, parent, axis3(s, [0, 0, 0]))
  const projecting = m.balcony === 'projecting'

  if (projecting) {
    // The deck hangs below the level it serves, so you step out onto it level
    // with the floor inside.
    const solid = boxSolid(
      s,
      width,
      d,
      BALCONY_SLAB,
      at3(e, uc, d / 2, zBase - BALCONY_SLAB),
      ref,
    )
    out.push({
      id: s.add(
        `IFCSLAB(${str(ctx.guid(key, 'balcony', e.key, level, m.index))},#${owner},` +
          `${str(`Balcony ${e.key} L${level}`)},$,${str('Balcony')},#${place},` +
          `#${shapeOf(s, body, solid)},$,.USERDEFINED.)`,
      ),
      level,
    })
  }

  const rt = railThickness(p.balustrade)
  const height = RAIL_HEIGHT + RAIL_CAP
  const front = projecting ? d : 0
  const runs = [boxSolid(s, width, rt, height, at3(e, uc, front - rt / 2, zBase), ref)]
  if (projecting) {
    // Cheeks, only where the deck actually cantilevers.
    runs.push(boxSolid(s, rt, d, height, at3(e, m.bu0 + rt / 2, d / 2, zBase), ref))
    runs.push(boxSolid(s, rt, d, height, at3(e, m.bu1 - rt / 2, d / 2, zBase), ref))
  }
  out.push({
    id: s.add(
      `IFCRAILING(${str(ctx.guid(key, 'railing', e.key, level, m.index))},#${owner},` +
        `${str(`Balustrade ${e.key} L${level}`)},$,$,#${place},` +
        `#${shapeOfAll(s, body, runs)},$,.BALUSTRADE.)`,
    ),
    level,
  })
  return out
}

function wallsFor(
  ctx: Context,
  e: Elevation,
  facade: FacadeModel,
  storeyPlacement: Map<number, number>,
  p: Params,
  key: string,
): { id: number; level: number }[] {
  const { s, owner, body } = ctx
  const made: { id: number; level: number }[] = []
  if (e.abutting) return made

  const floorHeight = p.floorHeight
  const ref = plan(e.uDir.x, e.uDir.z)
  for (let i = 0; i < e.floors; i++) {
    const level = e.baseFloor + i
    const parent = storeyPlacement.get(level)
    if (parent === undefined) continue

    const ops = facade.openings.filter((o) => o.elevKey === e.key && o.floor === level)
    const mods = facade.modules.filter((m) => m.elevKey === e.key && m.floor === level)
    // A loggia's windows belong to its own back wall, so they must not also be
    // offered to the facade wall covering the same stretch.
    const loggias = new Set(
      mods.filter((m) => m.balcony === 'loggia').map((m) => m.index),
    )
    const facadeOps = ops.filter((o) => !loggias.has(o.moduleIndex))

    for (let k = 0; k < e.openByFloor[i].length; k++) {
      const span = e.openByFloor[i][k]
      const length = span.b - span.a
      if (length <= 1e-6) continue

      // Centre of the run, pushed half a thickness inward so the outer face
      // lands on the elevation plane the app drew.
      const u = (span.a + span.b) / 2
      const [px, py, pz] = at3(e, u, -WALL_THICKNESS / 2, 0)

      const solid = boxSolid(s, length, WALL_THICKNESS, floorHeight, [px, py, pz], ref)
      const shape = shapeOf(s, body, solid)
      const wall = s.add(
        `IFCWALL(${str(ctx.guid(key, 'wall', e.key, level, k))},#${owner},` +
          `${str(`Wall ${e.key} L${level}`)},$,$,` +
          `#${localPlacement(s, parent, axis3(s, [0, 0, 0]))},#${shape},$,.SOLIDWALL.)`,
      )
      made.push({ id: wall, level })
      made.push(
        ...openingsIn(ctx, e, wall, facadeOps, span, level, floorHeight, parent, ref, key),
      )

      const inSpan = mods.filter(
        (m) => m.u0 >= span.a - 1e-6 && m.u1 <= span.b + 1e-6,
      )
      for (const m of inSpan) {
        if (m.balcony === 'loggia') {
          const mine = ops.filter((o) => o.moduleIndex === m.index)
          made.push(
            ...loggiaIn(ctx, e, wall, m, mine, span, level, p, parent, ref, key),
          )
        }
        made.push(...balconyFor(ctx, e, m, level, p, parent, ref, key))
      }
    }
  }
  return made
}

/**
 * The whole site as one IFC4 file.
 *
 * `when` is a parameter because the header's timestamp is the only part of the
 * output that is not a function of the model. Pin it and two exports of one
 * scheme are byte-identical.
 */
export function siteIfc(site: Site, build: SiteBuild, when = new Date()): string {
  const s = new Step()
  const seen = new Map<string, number>()
  const guid = (...parts: (string | number)[]) => {
    const key = parts.join('/')
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    // A duplicate key would mean two elements sharing a GlobalId, which is
    // invalid and very hard to see. Salting the repeat keeps it impossible.
    return ifcGuid(n === 0 ? key : `${key}#${n}`)
  }

  // --- ownership. Deliberately impersonal: an exported file should not carry
  // whoever happened to be at the keyboard. ---
  // IfcPerson's WHERE rule wants one of Identification, FamilyName or
  // GivenName. Identification satisfies it without naming anybody.
  const person = s.add(`IFCPERSON(${str('URBGEN')},$,$,$,$,$,$,$)`)
  const org = s.add(`IFCORGANIZATION($,${str('URBGEN')},$,$,$)`)
  const pao = s.add(`IFCPERSONANDORGANIZATION(#${person},#${org},$)`)
  const app = s.add(
    `IFCAPPLICATION(#${org},${str('1.0')},${str('URBGEN')},${str('URBGEN')})`,
  )
  const stamp = Math.floor(when.getTime() / 1000)
  const owner = s.add(
    `IFCOWNERHISTORY(#${pao},#${app},$,.ADDED.,$,$,$,${stamp})`,
  )

  // --- units and contexts ---
  const units = s.add(
    `IFCUNITASSIGNMENT((` +
      [
        s.shared('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'),
        s.shared('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),
        s.shared('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'),
        s.shared('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)'),
      ]
        .map((id) => `#${id}`)
        .join(',') +
      `))`,
  )
  const world = axis3(s, [0, 0, 0])
  // TrueNorth is the direction true north points in the model's own XY plane.
  // The app measures it clockwise from the model's north, which is IFC's +Y, so
  // an angle of theta lands at (sin, cos). Left as $ when the site has no
  // position: an unstated north is honest, an assumed one is not.
  const north = site.geo ? (site.geo.trueNorth * Math.PI) / 180 : 0
  const trueNorth = site.geo
    ? `#${direction2(s, Math.sin(north), Math.cos(north))}`
    : '$'
  const model = s.add(
    `IFCGEOMETRICREPRESENTATIONCONTEXT($,${str('Model')},3,1.E-05,#${world},${trueNorth})`,
  )
  const body = s.add(
    `IFCGEOMETRICREPRESENTATIONSUBCONTEXT(${str('Body')},${str('Model')},*,*,*,*,` +
      `#${model},$,.MODEL_VIEW.,$)`,
  )

  const ctx: Context = { s, owner, body, guid }

  const project = s.add(
    `IFCPROJECT(${str(guid('project'))},#${owner},${str('URBGEN site')},$,$,$,$,` +
      `(#${model}),#${units})`,
  )
  // A georeferenced site lands where it belongs in a receiving application
  // rather than at that application's origin.
  const lat = site.geo ? `(${compoundAngle(site.geo.lat).join(',')})` : '$'
  const lon = site.geo ? `(${compoundAngle(site.geo.lon).join(',')})` : '$'
  const siteId = s.add(
    `IFCSITE(${str(guid('site'))},#${owner},${str('Site')},$,$,` +
      `#${localPlacement(s, null, axis3(s, [0, 0, 0]))},$,$,.ELEMENT.,` +
      `${lat},${lon},${site.geo ? '0.' : '$'},$,$)`,
  )

  const buildingIds: number[] = []
  const aggregates: string[] = []
  const contained: string[] = []

  for (const { placement, building } of build.placed) {
    // Keyed on the placement id alone, deliberately. Folding the name in would
    // reissue every GlobalId in a building the moment someone renamed it, and a
    // GlobalId's whole job is to say "this is the same element as last time".
    // The id survives save and load, so a scheme re-exported after a reload
    // updates its elements downstream instead of replacing them.
    const key = placement.id
    const [bx, by] = plan(placement.position.x, placement.position.z)
    const buildingPlacement = localPlacement(
      s,
      localPlacement(s, null, axis3(s, [0, 0, 0])),
      axis3(s, [bx, by, 0], refDirection(placement.rotation)),
    )
    const buildingId = s.add(
      `IFCBUILDING(${str(guid(key, 'building'))},#${owner},${str(placement.name)},$,$,` +
        `#${buildingPlacement},$,$,.ELEMENT.,$,$,$)`,
    )
    buildingIds.push(buildingId)

    const floorHeight = placement.params.floorHeight
    const storeyIds: number[] = []
    const storeyPlacement = new Map<number, number>()
    for (const level of levels(building.masses)) {
      const pl = localPlacement(
        s,
        buildingPlacement,
        axis3(s, [0, 0, level * floorHeight]),
      )
      storeyPlacement.set(level, pl)
      storeyIds.push(
        s.add(
          `IFCBUILDINGSTOREY(${str(guid(key, 'storey', level))},#${owner},` +
            `${str(`Level ${level}`)},$,$,#${pl},$,$,.ELEMENT.,` +
            `${num(level * floorHeight)})`,
        ),
      )
    }
    // `levels()` skips a level no mass occupies, so the two lists stay aligned.
    const storeyLevels = levels(building.masses)

    const byStorey = new Map<number, number[]>()
    const put = (items: { id: number; level: number }[]) => {
      for (const it of items) {
        const list = byStorey.get(it.level)
        if (list) list.push(it.id)
        else byStorey.set(it.level, [it.id])
      }
    }
    for (const mass of building.masses) {
      put(slabsFor(ctx, mass, storeyPlacement, floorHeight, key))
    }
    for (const e of building.elevations) {
      put(wallsFor(ctx, e, building.facade, storeyPlacement, placement.params, key))
    }

    aggregates.push(
      `IFCRELAGGREGATES(${str(guid(key, 'aggregate'))},#${owner},$,$,#${buildingId},` +
        `(${storeyIds.map((id) => `#${id}`).join(',')}))`,
    )
    for (let i = 0; i < storeyLevels.length; i++) {
      const items = byStorey.get(storeyLevels[i])
      if (!items || items.length === 0) continue
      contained.push(
        `IFCRELCONTAINEDINSPATIALSTRUCTURE(${str(guid(key, 'contains', storeyLevels[i]))},` +
          `#${owner},$,$,(${items.map((id) => `#${id}`).join(',')}),#${storeyIds[i]})`,
      )
    }
  }

  s.add(
    `IFCRELAGGREGATES(${str(guid('project-site'))},#${owner},$,$,#${project},(#${siteId}))`,
  )
  if (buildingIds.length > 0) {
    s.add(
      `IFCRELAGGREGATES(${str(guid('site-buildings'))},#${owner},$,$,#${siteId},` +
        `(${buildingIds.map((id) => `#${id}`).join(',')}))`,
    )
  }
  for (const line of aggregates) s.add(line)
  for (const line of contained) s.add(line)

  const iso = new Date(when.getTime()).toISOString().replace(/\.\d+Z$/, '')
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION((${str('ViewDefinition [ReferenceView_V1.2]')}),${str('2;1')});`,
    `FILE_NAME(${str('urbgen-site.ifc')},${str(iso)},(${str('')}),(${str('URBGEN')}),` +
      `${str('URBGEN')},${str('URBGEN')},${str('')});`,
    `FILE_SCHEMA((${str('IFC4')}));`,
    'ENDSEC;',
    'DATA;',
  ].join('\n')

  return `${header}\n${s.body()}\nENDSEC;\nEND-ISO-10303-21;\n`
}

/** Levels the site spans, for the export summary in the UI. */
export const siteStoreys = (build: SiteBuild) =>
  build.placed.reduce((n, p) => Math.max(n, topLevel(p.building.masses)), 0)
