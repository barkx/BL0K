# BL0K

A browser app for early-stage urbanism. Draw a plot, place buildings on it, and
change a slider to rebuild any of them. Each building is parametric massing plus
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
| Metrics | GFA, facade area, unit estimate, footprint, coverage, plot ratio |
| Export | glTF + save/load the whole site as JSON |
| Units | Metric throughout (metres, m², internally always metres) |
| Backend | None. A static site. Anything needing a server is a scope decision |

### Explicit non-goals, for now
- Apartment floorplans, cores, corridors, stairs, lifts.
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
│  ◧ BL0K  Early-stage urbanism   [white|pbr|diagram]  ⤓   │
├───────────────┬──────────────────────────────────────────┤
│               │                                          │
│   PARAMETERS  │            3D VIEWPORT                   │
│               │                                          │
│  ▸ Massing    │        (orbit / pan / zoom)               │
│  ▸ Facade     │                                          │
│  ▸ Balconies  │                                          │
│  ▸ Appearance │   ┌────────────────────┐                 │
│               │   │ 8 floors · 24.0 m  │  ← metrics,     │
│  [Presets]    │   │ GFA    4 160 m²    │    over the      │
│               │   │ Units  52          │    viewport      │
│  Save / Load  │   │ Facade 2 890 m²    │                 │
│  Export glTF  │   │ Cover  520 m²      │                 │
└───────────────┴──────────────────────────────────────────┘
```

Sidebar ~320 px, collapsible. Under 900 px viewport width it becomes a bottom
sheet and the viewport takes the full screen.

Design notes: the building is the hero, so the chrome stays quiet. The palette
should come from the subject — drawing-office greys and blueprint ink rather
than a generic SaaS card kit. Sentence case labels, no all-caps eyebrows, no
decorative gradients. Sliders show live values; the number is the point.

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

### Next

**M11 — DXF import.** Plot boundary and context linework from CAD. Needs a DXF
parser, which would be the first real new dependency, so it wants a decision on
which one before any code.

Each milestone should end in something demoable. If one stops being demoable,
it is too big — split it.

---

## 9. Roadmap

Informed by what comparable tools in this category offer. Ordered by what the
existing architecture makes cheap, not by what sounds impressive.

### Phase A — cheap, because the groundwork is already there

1. **Metrics export** to CSV/Excel. The data exists; it is a formatter.
2. **NIA and efficiency ratio.** GFA times a per-building factor.
3. **Unit mix to target ratios.** Modules are already addressable as
   `(elevation, floor, index)` — that address was kept for exactly this.
4. **Site rules: setback, height cap, FAR and coverage limits.** Identical in
   shape to the clash and off-plot checks already running, so they land in the
   same panel with the same warning style.
5. **Sun and shadow study.** The hook in §7 is already in place; this claims it.

### Phase B — real work, high value

6. **DXF export**, then **plans, elevations and sections** — orthographic
   cameras over geometry that already exists.
7. **Geolocated context via OpenStreetMap.** Overpass needs no API key, which
   keeps the no-credentials rule intact. Gives auto site outlines and
   neighbouring footprints.
8. **Daylight factor and sun hours.** Genuine compute, but tractable on a grid.

### Phase C — decide before writing any code

9. **IFC export.** Large. Either a dependency or a schema writer.
10. **Multi-user collaboration.** This changes what the project *is*: BL0K is a
    static site with no backend. Collaboration means servers, accounts, auth and
    storage, and it collides with the privacy rules in `CLAUDE.md`.

### Deliberately not chasing

The module-driven facade — real openings, reveals, loggias, balconies,
per-elevation overrides — is the thing BL0K does that massing-and-simulation
tools do not. Do not trade it away for feature parity.

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

5. **Setbacks** — a minimum distance to the boundary and between buildings,
   checked the way clashes are?
6. **Snapping** — should dragging snap to a grid, the plot edge, or another
   building's face? Everything drags freely today.
7. **Plot subdivision** — one plot, or several with their own limits?
8. **Shared parameters** — if ten buildings should share a facade spec, does
   that want a template, or is duplicate-then-edit enough?
9. **DXF layers** — which layer carries the boundary, and does the importer ask
   or guess?
