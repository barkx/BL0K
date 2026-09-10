# Apartment Block Generator

A browser app that generates a parametric 3D apartment building. Change a slider,
the building rebuilds. v1 is about **massing + facade**; real apartment
floorplans come later.

---

## 1. Decisions locked in

| Area | Decision |
|---|---|
| 3D stack | React Three Fiber (three.js) |
| App shell | Vite + React 18 + TypeScript |
| State | Zustand store, single flat params object |
| Controls | Custom sidebar with sliders (no leva) |
| Footprints | L / U / T, courtyard, stacked & offset masses |
| Facade fidelity | Windows + balconies |
| Window rhythm | Driven by apartment module width |
| Balconies | Projecting slabs, recessed loggias, and per-elevation config |
| Render modes | Toggle: white model / PBR / diagram |
| Metrics | Floor area, facade area, estimated unit count, footprint & site coverage |
| Export | glTF + save/load config as JSON |
| Units | Metric throughout (metres, m², internally always metres) |

### Explicit non-goals for v1
- Apartment floorplans, cores, corridors, stairs, lifts.
- Sun/shadow study.
- Differentiated ground-floor plinth (retail).
- Site context, neighbouring buildings, terrain.
- Cost estimation, code compliance checking.

These are deferred, not rejected. The data model should not make them painful
to add — see §7.

---

## 2. Core concept: the building is a list of masses

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
│  Apartment Block Generator      [white|pbr|diagram]  ⤓   │
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
- **Sun study.** Keep one directional light with a real `position`, not a
  hardcoded offset, so a date/time control can drive it.
- **Config versioning.** Every saved JSON carries `{ version, params }`. Write
  the loader to migrate unknown-but-older versions rather than reject them.

---

## 8. Milestones

**M1 — Skeleton.** Vite + R3F + TS. Grey box, orbit controls, one working
slider (`floors`) that rebuilds it. Proves the loop.

**M2 — Masses.** All six presets. Junction detection, abutting elevations
blanked. Correct GFA with overlap resolution.

**M3 — Facade.** Module fitting, windows with reveal and sill, instanced.
Parapet and flat roof.

**M4 — Balconies.** Projecting, loggia, mixed. Patterns, seeded RNG,
balustrade variants.

**M5 — Modes & metrics.** Three render modes. Full metrics panel.

**M6 — I/O.** glTF export, config save/load, versioning.

**M7 — Polish.** Mobile bottom sheet, per-elevation overrides, keyboard focus,
reduced-motion respect, performance pass at 30 floors.

Each milestone should end in something demoable. If a milestone stops being
demoable, it is too big — split it.

---

## 9. Open questions

1. **Roof** — flat + parapet only in v1, or do we want a setback top floor?
2. **Modules per unit** — is a 1-bed one module and a 3-bed two? Worth defining
   the mapping before the unit-count metric gets trusted.
3. **Corner condition** — at an L junction, do modules wrap the corner or does
   one wing take priority? Affects both facade and unit counting.
4. **Depth** — uniform for all wings, or per-wing?
5. **Site** — do we want a real site boundary shape for coverage, or is a plain
   `siteArea` number enough?
