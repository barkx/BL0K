# Apartment Block Generator

Parametric 3D apartment building in the browser. Move a slider, the building
rebuilds. v1 is massing + facade; floorplans come later.

Built against [`project.md`](project.md), which remains the spec of record.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle
```

## How it fits together

The whole app is one pure derivation plus a thin scene on top:

```
params  ──resolveParams──▶  masses  ──▶  elevations  ──▶  facade model
                                                              │
                        ┌─────────────────┬───────────────────┤
                        ▼                 ▼                   ▼
                  walls + glass      balconies            metrics
                  roof + parapet     (instances)
                  edge lines
```

`buildBuilding(params)` in [`src/geometry/build.ts`](src/geometry/build.ts) runs
that whole chain. Nothing in it touches the three.js scene, so every builder is
a pure function you can call from a test or a script — which is how the glTF
export and the headless checks work.

Geometry is derived, never stored. The store keeps `params`; the previous pass's
buffers are disposed the moment a new one lands.

| Directory | What lives there |
|---|---|
| `store/` | Params, ranges, `resolveParams`, presets, the Zustand store |
| `geometry/` | Masses, elevation frames, facade model, walls, roof, balconies, edges |
| `metrics/` | Area and unit-count derivation |
| `scene/` | R3F components, material sets per render mode, lighting |
| `ui/` | Sidebar, sliders, metrics panel, per-elevation override panel |
| `io/` | glTF export, config save/load with migration |
| `lib/` | Clamping, seeded RNG, rectangle/span algebra, the mesh builder |

## Decisions worth knowing

**Presets butt-joint rather than overlap.** Wings meet at a shared face instead
of interpenetrating. That removes coincident coplanar faces — and the
z-fighting they cause — by construction, and reduces junction handling to a 1D
interval problem on the shared elevation. Masses at *different* levels may still
overlap in plan (that is what `stacked` is for), so metrics still take a
per-level union.

**Junctions blank intervals, not whole faces.** An L-shape's long elevation is
only covered for the 13 m where the other wing lands; the remaining 27 m keeps
its facade. Elevations therefore carry per-floor open spans, not a boolean.

**Module rhythm is continuous across a junction.** Modules tile the full
elevation length, and a module that straddles a junction is dropped rather than
squeezed. The leftover sliver between the junction and the first whole module is
built as blank wall.

**No CSG.** Window openings and loggia recesses are built as panels — a band
under the sill, a band over the head, piers between openings, plus reveal jambs.
A loggia adds two cheeks, a soffit, a floor and a glazed back wall.

**Walls and glass are merged; balconies are instanced.** The spec asks for
instanced windows; a merged static buffer achieves the same goal (one draw call)
and is cheaper still, since there are no per-instance matrices to upload. Boxes
that genuinely repeat — balcony slabs, balustrade panels, handrails, bars — are
`InstancedMesh`.

**Seeded randomness is address-based.** `hash01(seed, mass, elevation, floor,
module)` gives a module's random choice from its own coordinates, so it cannot
depend on the order modules happen to be visited in. Same seed, same building.

**One clamping point.** `resolveParams` takes raw slider values and returns a
mutually consistent set. Sliders keep the value you asked for; where the
building had to be built from something else, the slider says so underneath.

## Deviations from the spec

- **`sillHeight` default is 0.65 m, not 0.9 m.** The spec's facade defaults
  cannot all hold at once: a 0.9 m sill under a 2.1 m window fills a 3.0 m
  floor-to-floor exactly, leaving nothing for the slab and window head. Keeping
  the spec's `floorHeight` and `windowHeight` and lowering the sill gives a
  conventional window and no clamp warning on first load. `HEAD_MIN` (0.25 m) is
  the head allowance that forces the issue.
- **Windows are merged rather than instanced.** See "Walls and glass are
  merged" above — same draw-call count, less per-frame work.

## Open questions from §9, as built

These were answered to keep moving; all are cheap to revisit.

1. **Roof** — flat + parapet only, as the spec's default. No setback top floor.
2. **Modules per unit** — a parameter (default 1), and the unit count is
   labelled an estimate in the UI. The mapping still wants defining before the
   number is trusted.
3. **Corner condition** — resolved by geometry rather than a rule: the abutted
   interval is blanked, and the other wing runs its full length past the
   junction. No wing "wraps" the corner.
4. **Depth** — uniform across wings. The parameter is scalar; per-wing depth
   would mean widening it to an array, not restructuring anything.
5. **Site** — a plain `siteArea` number, no boundary shape.

## Designed for later

- **Floorplans.** A module is addressable as `(elevation, floor, index)` and
  that address is carried on `ModuleSlot`, not baked into geometry.
- **Plinth.** `floorHeight` is still scalar, but nothing outside
  `resolveParams` assumes it — the geometry reads a per-floor `yBase`.
- **Sun study.** The directional light is positioned from
  `sunPosition(azimuth, altitude, distance)`. A date/time control drives two
  numbers.
- **Config versioning.** Saved JSON is `{ version, app, params }`. The loader
  migrates: a v1 file with params at the top level still loads, missing keys
  take defaults, and a file from a newer build loads with unknown keys dropped
  and a note in the UI.

## Performance

Geometry rebuilds at most once per frame — params resolve synchronously so the
readouts never lag a drag, but the rebuild is scheduled on `requestAnimationFrame`.

The worst case in the parameter space is a 30-floor courtyard block: 1 200
facade modules and 36 240 triangles. Measured on the machine this was developed
on:

| | Rebuild |
|---|---|
| 30-floor courtyard, warm | 24–28 ms |
| 30-floor courtyard, first build after a preset change | ~100 ms |
| 8-floor L (the default), warm | 5–7 ms |
| Metrics alone, at 30 floors | 0.4 ms |

So the default building rebuilds inside a frame, and only the extreme end of the
parameter space drops to ~40 fps *while a slider is actively moving*. Between
changes the geometry is static and renders at full rate. Metrics sit well inside
the spec's 5 ms budget.

The mesh builder is where the cost lives, and it is written accordingly: scalars
written straight into pre-sized typed arrays, no per-vertex vector objects, no
spread pushes, and views rather than copies handed to `BufferAttribute`. That
took the original implementation down by roughly 3.5x.

Vertical bar balustrades are costed before they are built; past a 60 000
instance budget they fall back to solid infill and the metrics panel says so.
