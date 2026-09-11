# URBGEN

A browser app for parametric building design. Draw a plot, place buildings on
it, and change a slider to rebuild any of them. Each building is parametric massing plus
a module-driven facade; real apartment floorplans come later.

**This is the single spec of record.** It is a working document — keep it
current as the app changes, and record any deviation in `README.md`.

---

## 1. Decisions locked in

| Area | Decision |
|---|---|
| 3D stack | React Three Fiber (three.js) |
| App shell | Vite + React 18 + TypeScript |
| State | Zustand store: a site holding many placed buildings |
| Controls | Custom sidebar with sliders (no leva) |
| Site | A plot polygon, drawn on the ground; many buildings placed on it |
| Placement | Free rotation about Y, dragged or typed |
| Underlay | A map or site plan image, scaled from two known points |
| Footprints | L / U / T, courtyard, stacked & offset masses |
| Facade fidelity | Windows + balconies |
| Window rhythm | Driven by apartment module width |
| Balconies | Projecting slabs, recessed loggias, and per-elevation config |
| Render modes | Toggle: white model / PBR / diagram |
| Metrics | GFA, NIA, facade area, unit estimate, footprint, coverage, plot ratio |
| Site rules | Setback, separation, height cap, FAR and coverage limits; zero is off |
| Interaction | A tab is a tool: it scopes the viewport's handles and drags. Selection is always live |
| Core | A rectangular shaft on the perimeter or the spine, draggable along its track. Massing only |
| Export | glTF, metrics as CSV, save/load the whole site as JSON |
| Units | Metric throughout (metres, m², internally always metres) |
| Backend | None. A static site. Anything needing a server is a scope decision |

### Explicit non-goals, for now
- Apartment floorplans, corridors, stairs, lifts. **Cores were taken on in
  M12** — as a massing shaft only, the volume those things would occupy. The
  things themselves stay out.
- Terrain, slope, cut and fill. The ground is flat.
- Neighbouring building volumes as 3D context.
- Differentiated ground-floor plinth (retail).
- Cost estimation.
- Multi-user collaboration — it needs a backend, and this has none.

These are deferred, not rejected. The data model should not make them painful
to add — see §7. Items that have since been taken on are in §9.

---

## 2. Core concept

### A site is a plot and a list of placed buildings

```
Site
 ├── plot: Vec2[]              // plan polygon, metres
 ├── underlay: image | null    // a map or plan to trace over
 ├── rules: SiteRules          // planning limits; 0 means a rule is off
 └── buildings: Placement[]
      ├── position { x, z }    // where the building's local origin sits
      ├── rotation             // degrees about Y, free
      └── params               // a full parameter set, per building
```

**The constraint that keeps this cheap.** `buildBuilding()` generates in the
building's *own local frame*, and every geometry builder relies on masses being
axis-aligned there. That holds inside a building, so placement lives one level
up and the transform is applied at the scene level. Nothing in `geometry/` knows
about rotation. **Keep it that way** — a feature that wants to rotate masses
within a building needs its own answer, not a change to this contract.

### A building is a list of masses

A single box cannot express L/U/T, courtyards, or offset stacks. So the building
is an array of **masses**. Each mass is an extruded rectangle with its own
footprint, base level, and floor count. Presets compose masses; the user can
then tweak them.

```
Building
 └── masses: Mass[]
      ├── id
      ├── origin      { x, z }      // metres, building-local
      ├── size        { length, depth }
      ├── rotation    0 | 90 | 180 | 270  (v1: orthogonal only)
      ├── baseFloor   int           // enables stacked/offset masses
      ├── floors      int
      └── facadeOverrides?          // per-elevation balcony/window settings
```

**Presets** (a preset is a function `(params) => Mass[]`):

- `bar` — one mass. The sanity-check case.
- `L` — two masses meeting at a corner.
- `T` — two masses, one centred against the other.
- `U` — three masses, open on one side.
- `courtyard` — four masses forming a closed ring around a void.
- `stacked` — 2–3 masses with different `baseFloor` and offset origins.

Overlap at junctions is expected. Corner double-counting must be resolved for
both geometry (avoid z-fighting on coincident faces) and metrics (§5).

### Elevations
Every mass exposes 4 elevations, tagged `N | E | S | W` after rotation. An
elevation is either **exterior** (gets a facade) or **internal/abutting**
(blank, hidden at a junction). Junction detection: if an elevation is
coincident-and-overlapping with another mass's elevation, mark it abutting.

---

## 3. Parameters

Sidebar is grouped. Every param has min/max/step and a numeric input beside the
slider so exact values can be typed.

### Massing
| Param | Range | Default | Notes |
|---|---|---|---|
| `preset` | enum | `L` | Regenerates masses |
| `floors` | 2–30 | 8 | Global; per-mass override allowed |
| `floorHeight` | 2.6–4.0 m | 3.0 | Floor-to-floor |
| `buildingDepth` | 9–24 m | 13 | Wing depth |
| `wingLengthA/B/C` | 12–90 m | 40 | Per-preset, only relevant wings shown |
| `courtyardWidth` | 12–60 m | 25 | Courtyard preset only |
| `massOffset` | 0–20 m | 0 | Stacked preset only |
| `roofParapet` | 0–1.5 m | 0.9 | Simple parapet, flat roof only in v1 |

### Facade — module driven
This is the heart of the facade. `moduleWidth` is the width of one apartment
module; the facade grid derives from it.

| Param | Range | Default | Notes |
|---|---|---|---|
| `moduleWidth` | 3.0–9.0 m | 6.0 | One apartment module |
| `windowsPerModule` | 1–3 | 2 | Openings inside a module |
| `windowWidth` | 0.6–3.5 m | 1.6 | Clamped to fit the module |
| `windowHeight` | 1.2–2.8 m | 2.1 | Clamped to floorHeight − sill − head |
| `sillHeight` | 0.0–1.2 m | 0.9 | 0 = floor-to-ceiling glazing |
| `reveal` | 0–0.4 m | 0.1 | Window inset from wall face |

**Module fitting.** `moduleCount = round(elevationLength / moduleWidth)`, then
the *actual* module width becomes `elevationLength / moduleCount` so modules
always divide the elevation evenly. Show both requested and actual width in the
UI so the user understands the snap. Never leave a ragged remainder bay.

### Balconies
| Param | Options / range | Default |
|---|---|---|
| `balconyType` | `none` \| `projecting` \| `loggia` \| `mixed` | `projecting` |
| `balconyDepth` | 1.2–2.5 m | 1.8 |
| `balconyWidthRatio` | 0.4–1.0 of module | 0.8 |
| `balconyPattern` | `every module` \| `alternate` \| `checkerboard` \| `random` | `every module` |
| `balconyStartFloor` | 0–n | 1 |
| `balustrade` | `glass` \| `solid` \| `vertical bars` | `glass` |
| `randomSeed` | int | 1 |

- **Projecting** — slab cantilevers past the wall face, with balustrade on 3 sides.
- **Loggia** — recess cut into the mass; the window sits at the back of the recess.
  Note this *removes* floor area, so it must feed back into metrics.
- **Mixed** — chosen per module by the seeded RNG. Same seed → same building, always.

Per-elevation override panel: select an elevation in the viewport, override
`balconyType`, `balconyPattern`, and `windowsPerModule` for that face only.

### Appearance
`renderMode`: `white` | `pbr` | `diagram`.

- **white** — untextured matte white, soft ambient occlusion, thin dark edge
  lines. The classic architectural study model.
- **pbr** — real materials: concrete/render wall, glass with reflection,
  metal balustrade. One env map (HDRI) via drei's `Environment`.
- **diagram** — flat fills, no shadows, clear line work; masses tinted by level
  so stacking reads clearly. Made for screenshots in a report.

The three modes swap materials on the *same* geometry. No geometry rebuild on
mode change.

---

## 4. UI layout

```
┌──────────────────────────────────────────────────────────┐
│  ◧ URBGEN  Parametric building design                    │
├────┬─────────────┬───────────────────────────────────────┤
│ ◇  │  SITE       │                                       │
│Site│             │           3D VIEWPORT                 │
│ ▣  │ Boundary    │                                       │
│Plce│  ...        │        (orbit / pan / zoom)            │
│ ◲  │ Overlay     │                                       │
│Mass│  ...        │   ┌────────────────────┐              │
│ ▦  │             │   │ 1 building · 9900m²│  ← metrics,  │
│Fcde│             │   │ GFA    8 320 m²    │    over the   │
│ ▤  │             │   │ FAR    0.84        │    viewport   │
│Unit│             │   │ Cover  10.5%       │              │
│ ⚙  │             │   └────────────────────┘              │
│Set │             │                                       │
└────┴─────────────┴───────────────────────────────────────┘
```

An icon rail selects one of six sections; the panel beside it shows that
section only. Six accordion groups in a 320 px column was too much to scan.

| Section | Holds |
|---|---|
| **Site** | Plot boundary, overlay image |
| **Placement** | The building list, and position/rotation of the selected one. Roads and parking go here |
| **Massing** | Footprint preset and wings; floors, floor height, parapet |
| **Facade** | Module, windows, balconies |
| **Units** | The unit estimate |
| **Settings** | Save, load, export, reset |

Rail ~56 px, panel ~264 px, collapsible together. Under 900 px the whole
sidebar becomes a bottom sheet and the rail lays out horizontally — six items
stacked vertically will not fit a sheet.

Design notes: the building is the hero, so the chrome stays quiet. The palette
comes from the subject — drawing-office greys and blueprint ink rather than a
generic SaaS card kit. Sentence case labels, no all-caps eyebrows except the
small block titles inside a panel, no decorative gradients. Sliders show live
values; the number is the point.

---

## 5. Metrics

### Site level

Shown first, because a scheme is judged on these.

- **GFA** — sum across buildings.
- **Plot ratio (FAR)** — GFA over plot area.
- **Coverage** — summed level-0 footprints over plot area.
- **Units**, **tallest building**.
- **Clash detection** — footprint quads tested pairwise with a separating-axis
  test, exact for the rotated rectangles a placed building produces. An AABB
  test would throw false clashes the moment a building is rotated.
- **Off-plot detection** — any ground corner outside the boundary.
- **Plot validity** — a self-intersecting boundary is flagged, because shoelace
  area cancels its lobes and every ratio above would then be nonsense.

Coverage and plot ratio assume no overlap and a simple boundary, which is why
both are *detected and named* rather than quietly absorbed.

### Per building

Recomputed from geometry on every param change (memoised, must stay under
~5 ms).

- **GFA** — Σ per-mass footprint × floors, **minus overlaps at junctions**
  (compute a union area per level, not a naive sum), minus loggia recesses.
- **Facade area** — Σ exterior elevation area, excluding abutting elevations.
  Report glazed vs solid split.
- **Estimated unit count** — `Σ modules per floor / modulesPerUnit`, where
  `modulesPerUnit` is a param (default 1). Label it clearly as an estimate;
  the real number arrives with floorplans.
- **Footprint / coverage** — level-0 union area; coverage % needs a
  `siteArea` input param (default 2 000 m²).

Every metric shows units. Round sensibly: areas to whole m², heights to 0.1 m.

---

## 6. Technical notes

### Rebuild strategy
Geometry is derived, never stored. `masses` and facade params → pure builder
functions → `BufferGeometry`. Key rules:

- Use **instanced meshes** for windows, balcony slabs, and balustrades. A
  30-floor courtyard block is thousands of repeated elements; individual meshes
  will not hold 60 fps.
- Merge static wall geometry per mass into one buffer.
- Loggias need real boolean subtraction, or — cheaper and preferred — build the
  wall as a set of panels around the recess rather than CSG. Avoid CSG in v1.
- Debounce slider input to one rebuild per frame; never rebuild per pixel of
  drag.

### File structure
```
src/
  App.tsx
  store/            params.ts, presets.ts
  geometry/         masses.ts, elevations.ts, facade.ts, balcony.ts, roof.ts
  metrics/          area.ts, units.ts
  scene/            Scene.tsx, Building.tsx, Mass.tsx, Facade.tsx,
                    Balconies.tsx, materials.ts, Lighting.tsx
  ui/               Sidebar.tsx, Slider.tsx, Group.tsx, MetricsPanel.tsx,
                    Toolbar.tsx
  io/               exportGltf.ts, config.ts
  lib/              rng.ts, clamp.ts, units.ts
```

### Conventions
- Metres everywhere internally. Format only at the display edge.
- Geometry builders are pure: `(params) => geometry`. No three.js scene access,
  no side effects. This keeps them unit-testable and swappable.
- Clamp in one place: a `resolveParams()` step that takes raw slider values and
  returns a valid, mutually-consistent set. UI shows the resolved value.
- Seeded RNG only (`rng.ts`). Never `Math.random()` in geometry — a building
  that changes when you look away is a bug.

---

## 7. Designed-for-later hooks

Do these cheaply now so the deferred features are not rewrites:

- **Floorplans.** Modules already exist as data (`elevation × moduleIndex ×
  floor`). Keep that addressable so a plan can later attach to a module range.
  Since M12 the core gives that plan somewhere to start: a corridor would run
  from a shaft whose position is already known, derived or placed by hand, and
  the facade already knows which modules that shaft takes out.
- **Plinth.** Let `floorHeight` become a per-level array rather than a scalar,
  even if v1 only ever fills it with one repeated value.
- **Sun study.** The directional light is positioned from
  `sunPosition(azimuth, altitude, distance)`, not a hardcoded offset. A
  date/time control drives two numbers. *Still to be claimed.*
- **Config versioning.** Saved JSON is `{ version, app, site }`, currently
  version 3. The loader migrates rather than rejects, three ways: a missing key
  takes its default, an unknown key is dropped, a changed shape gets its own
  branch. It detects the shape rather than switching on the number, so a file
  with a missing version still loads. *Working.*
- **Ground interaction.** Anything draggable in plan projects through
  `useGroundProjector` and runs on window listeners, because a drag must
  survive the cursor leaving the mesh it started on.

---

## 8. Milestones

### Done

| | |
|---|---|
| **M1 Skeleton** | Vite + R3F + TS, orbit controls, one slider that rebuilds |
| **M2 Masses** | Six presets, per-floor junction detection, GFA with overlap resolution |
| **M3 Facade** | Module fitting, real openings with reveal and sill, parapet and flat roof |
| **M4 Balconies** | Projecting, loggia, mixed; patterns, seeded RNG, balustrade variants |
| **M5 Modes & metrics** | White / PBR / diagram over one geometry; metrics panel |
| **M6 I/O** | glTF export, config save/load with migration |
| **M7 Polish** | Bottom sheet under 900 px, per-elevation overrides, reduced motion, 30-floor pass |
| **M8 Site** | Many placed buildings, free rotation, drag on the ground, site metrics, clash and off-plot detection, config v3, whole-site glTF |
| **M9 Plot** | Draw a boundary, drag / insert / remove corners, concave supported, self-intersection flagged |
| **M10 Underlay** | Drop a map or plan, set true scale from two known points, position / rotate / fade / lock |
| **M11 Rules & reporting** | Site rules (setback, separation, height cap, FAR, coverage) checked like clashes; NIA from a per-building efficiency factor; metrics as CSV; config v4 |
| **M12 Core** | A shaft of stairs, lift and risers as massing: count, size, overrun, and a perimeter or centre track it is shared along and can be dragged on. A perimeter shaft blanks the facade it meets — no windows, no units behind a lift. NIA becomes `(GFA − core) × efficiency`. Config v5. Reopens part of a §1 non-goal, by decision |

| **M13 Tabs as tools** | The open section scopes what the viewport does. Selection and camera stay live everywhere; handles and drags belong to their tab. Clicking drills in — ground and first click to Placement, again to Massing, a face to Facade — and the plot boundary opens Site |

### Next

**M14 — IFC export.** The gap in §9 that caps everything else. Decide a
dependency versus an own IFC4 writer before any code: a hand-written STEP
physical file keeps the no-dependency, offline rule intact, but "valid file" and
"opens cleanly in Revit" are different bars.

DXF import — plot boundary and context linework from CAD — sits behind it, at
its place in the §9 order. It needs a parser, which would be the first real new
dependency, so it wants the same kind of decision first.

Each milestone should end in something demoable. If one stops being demoable,
it is too big — split it.

---

## 9. Positioning and roadmap

### Deliberately a simpler tool

The competitors in this category are Autodesk **Forma** (Site Design for
massing and environment, Building Design for schematic facades, floor plans and
unit mix, then a native Revit handoff) and **Spacio** (massing, environmental
analysis, national code checks, IFC). Both are cloud products with teams behind
them; Forma is roughly EUR 1 500 a year.

**URBGEN is not trying to match them, and should not.** Simulation breadth — wind
CFD, microclimate, embodied carbon — and generative AI are not winnable here.
Being a worse Forma is not a position.

### What URBGEN actually has that they do not

Defend these; they are the reason to use it.

- **Facade depth.** Real openings built as panels, reveals with jambs, loggias
  with cheeks and soffits, per-elevation overrides, a module rhythm that always
  divides evenly. Spacio does not do this. Forma Building Design is the only
  close thing and it is new.
- **Determinism.** Seeded and byte-identical. For a tool whose job is comparing
  options, reproducibility is a real claim, and neither rival makes it.
- **No account, no cloud, no subscription.** A static page that works offline.
  Forma's own reviews list cloud dependency as friction. For students and small
  practices this is a position, not a limitation.
- **Metrics you can show your working on.** Union-corrected GFA, separating-axis
  clash detection, self-intersection flagging.

### ⚠ The gap that matters most: BIM handoff

**glTF is a visualisation format. Nobody continues a project from it.** Both
rivals let you carry work into Revit or ArchiCAD, which is the entire point of a
schematic tool. Until URBGEN exports **IFC**, it is a study toy rather than a step
in a real workflow.

This is the one missing feature worth treating as a blocker rather than a
backlog item. It is not cheap — either a dependency or a schema writer — but its
absence caps the tool's usefulness no matter how good everything else gets.

### Order of work

1. **IFC export.** See above. Decide dependency vs. own writer first.
2. **Sun hours and shadow.** The cheapest of the analyses and the most visible,
   and the hook in §7 is already in place waiting to be claimed.
3. **Geolocated context via OpenStreetMap.** Overpass needs no API key, so it
   keeps the no-credentials rule intact. Closes the biggest workflow gap:
   today the site arrives as a hand-calibrated image.
4. **Unit mix to target ratios.** Modules are already addressable as
   `(elevation, floor, index)` — that address was kept for exactly this. Turns
   the crude estimate into a real number.
5. ~~**Site rules: setback, height cap, FAR and coverage limits.**~~ **Done in
   M11**, and they did land in the same panel with the same warning style.
   Separation between buildings came with them, which answers §10 question 5.
6. ~~**Metrics export** to CSV.~~ **Done in M11.** Site totals, a row per
   building, every rule with its result, and the warnings.
7. ~~**NIA and efficiency ratio.**~~ **Done in M11**, then sharpened in M12:
   NIA is `(GFA − core area) × efficiency`, with the core measured off the
   geometry and the factor — now 0.85 to 0.97, default 0.90 — covering only
   what is still not modelled.
8. **DXF import**, then **DXF export**, then **plans, elevations and sections**
   — orthographic cameras over geometry that already exists.

### Not planned

- Wind, noise, microclimate, embodied carbon. Out of reach, and not the point.
- Generative or AI layout. There is no AI in this and the branding must not
  claim otherwise.
- Terrain, floor plans, parking layout.
- **Multi-user collaboration.** It would change what the project *is*: a static
  site with no backend. Servers, accounts, auth and storage, and it collides
  with the privacy rules in `CLAUDE.md`.

---

## 10. Open questions

**Building**

1. **Roof** — flat + parapet only, or a setback top floor?
2. **Modules per unit** — is a 1-bed one module and a 3-bed two? Worth defining
   before the unit count is trusted.
3. **Corner condition** — at an L junction, do modules wrap the corner? Today
   geometry decides: the abutted interval is blanked and the other wing runs
   past it.
4. **Depth** — uniform for all wings, or per-wing?

**Site**

5. ~~**Setbacks**~~ — **answered in M11.** Both: a minimum to the boundary and
   a minimum between buildings, each measured in plan to the outside face and
   checked the way clashes are. Zero means off, so no scheme inherits a limit
   nobody set. Still open underneath it: whether a setback should vary per plot
   edge — a street frontage and a party boundary rarely take the same number.
6. **Snapping** — should dragging snap to a grid, the plot edge, or another
   building's face? Everything drags freely today.
7. **Plot subdivision** — one plot, or several with their own limits?
8. **Shared parameters** — if ten buildings should share a facade spec, does
   that want a template, or is duplicate-then-edit enough?
9. **DXF layers** — which layer carries the boundary, and does the importer ask
   or guess?
