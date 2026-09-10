# Apartment Block Generator

Parametric urbanism builder in the browser. Draw a plot, place buildings on it,
and change a slider to rebuild any of them. Each building is massing + facade;
floorplans come later.

[`project.md`](project.md) is the spec of record for a building;
[`project-v2.md`](project-v2.md) covers the site layer. Working rules for
contributors are in [`CLAUDE.md`](CLAUDE.md).

- **[Chapter 1 — Running, coding, publishing](#chapter-1--running-coding-publishing)**
- **[Chapter 2 — The app](#chapter-2--the-app)**

---

# Chapter 1 — Running, coding, publishing

## Run it locally

```bash
npm install
npm run dev
```

Opens on http://localhost:5173. Edits hot-reload.

```bash
npm run build
```

Typechecks (`tsc --noEmit`) then bundles to `dist/`. This is the same command
Vercel runs, so if it fails locally the deploy will fail too. `npm run preview`
serves `dist/` if you want to check the built output without Docker.

Node 20 or newer.

## Run it in Docker

Same commands on any OS:

| Command | What you get | Port |
|---|---|---|
| `npm run docker:prod` | Production bundle served by nginx — closest thing to Vercel | http://localhost:8080 |
| `npm run docker:dev` | Vite dev server in a container, hot reload | http://localhost:5173 |
| `npm run docker:stop` | Stops and removes both containers | — |
| `npm run docker:logs` | Follows container output | — |

On Windows, `run.bat` is the same thing but double-clickable from Explorer, and
it opens the browser for you: `run.bat`, `run.bat dev`, `run.bat stop`,
`run.bat logs`.

Both targets live in one [`Dockerfile`](Dockerfile);
[`docker-compose.yml`](docker-compose.yml) picks between them and **owns the
host ports** — the ports above are what it currently maps. `scripts/docker.mjs`
reads them back with `docker compose config`, so changing a port in compose is
the only edit needed and the printed URL follows.

`dev` and `prod` can run at the same time on their two ports. If the engine is
not running, the script starts Docker Desktop and waits up to three minutes.

Docker is never involved in a Vercel deploy. It is for local production parity,
and for running the app on a machine with no Node toolchain.

### Finding Docker

[`scripts/docker.mjs`](scripts/docker.mjs) resolves Docker in this order:

1. **`docker` on PATH.** A normal install, CI, and anyone else cloning the repo
   land here, and nothing else runs.
2. **Known install locations** for the current platform, if PATH has nothing.
   Windows: the per-user `%LOCALAPPDATA%\Programs\DockerDesktop`, then
   `Program Files`, then `ProgramData`. macOS: `/usr/local/bin`, Homebrew, and
   `Docker.app`. Linux: `/usr/bin`, `/usr/local/bin`, `~/.docker/bin`.

It prints which route it used, and lists every path it tried when it finds
nothing.

Docker Desktop on the machine this was developed on is a **per-user** install
that never put itself on PATH, which is why the fallback exists. When Docker is
found off PATH, its folder is prepended to PATH **for that child process only** —
the credential helper and the compose plugin live next to `docker.exe`, and
image pulls fail with `docker-credential-desktop: executable file not found`
without them. Nothing outside the process is changed.

To put it on PATH permanently instead — optional, not required:

```powershell
[Environment]::SetEnvironmentVariable('Path',
  [Environment]::GetEnvironmentVariable('Path','User') + ';' +
  "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin", 'User')
```

### Container notes

- `dev` keeps `node_modules` inside the image (an anonymous volume hides the
  host's), so Windows-built binaries never leak into the Linux container. Both
  commands pass `--build`, so a new dependency is picked up on the next run.
- Hot reload in a container relies on polling (`VITE_POLLING=1`), because bind
  mounts on Windows do not deliver filesystem events.
- The lockfile carries the Linux musl native binaries for rollup and esbuild,
  so `npm ci` works on Alpine.

## Publish it (GitHub + Vercel)

The repo is `https://github.com/barkx/BL0K`, branch `main`.

```bat
push.bat
```

Prompts for a commit message (Enter gives a timestamp), then
`git add . && git commit && git push`. Run `npm run build` first — `push.bat`
does not typecheck for you. `setup-git.bat` was the one-time bootstrap and does
not need running again.

Both `.bat` files are interactive, so they stall in a non-interactive shell. Run
the equivalent git commands directly in that case.

To link Vercel (once):

1. vercel.com → **Add New** → **Project** → **Import Git Repository**
2. Pick `barkx/BL0K`. The framework preset should read **Vite**.
3. Leave build command and output directory alone — [`vercel.json`](vercel.json)
   already pins `npm run build` and `dist`.
4. Deploy. From then on every push to `main` deploys automatically, and pushes
   to other branches get preview URLs.

Deployed-app secrets go in the Vercel dashboard under **Project → Settings →
Environment Variables**, never in the repo. Locally they belong in `.env.local`,
which is ignored.

## Working on the code

### Layout

| Directory | What lives there |
|---|---|
| `store/` | Params, ranges, `resolveParams`, presets, the Zustand store |
| `site/` | Plot and placed buildings, site derivation, site metrics |
| `geometry/` | Masses, elevation frames, facade model, walls, roof, balconies, edges |
| `metrics/` | Area and unit-count derivation |
| `scene/` | R3F components, material sets per render mode, lighting |
| `ui/` | Sidebar, sliders, metrics panel, per-elevation override panel |
| `io/` | glTF export, config save/load with migration |
| `lib/` | Clamping, seeded RNG, rectangle/span algebra, the mesh builder |

### Conventions

- Metres internally, everywhere. Format only at the display edge (`lib/units.ts`).
- Geometry is derived, never stored. Params in, `BufferGeometry` out.
- Geometry builders are pure: no scene access, no side effects, no React.
- Seeded randomness only, via `lib/rng.ts`. Never `Math.random()` in geometry.
- Clamp in exactly one place: `resolveParams()` in `store/params.ts`.
- No CSG. Openings and loggias are built as panels around the void.
- Buildings stay axis-aligned in their own frame; placement is the site layer's
  job. `geometry/` must never learn about rotation.

### Verifying a change

There is no test runner. Verify with `npm run build`, then the app in a browser.
For logic changes, bundle a throwaway entry and run it under Node:

```bash
npx esbuild scratch.ts --bundle --platform=node --format=esm --outfile=out.mjs
node out.mjs
```

Because every builder is pure, this works without a browser — it is how the
glTF output and a 480-case parameter sweep were checked. Delete the scratch
file afterwards. Check numbers against a hand calculation, not against the
previous screenshot.

### What the repo carries

`src/`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`,
`vite.config.ts`, `vercel.json`, the Docker files, `scripts/`, the `.bat`
scripts and the Markdown. `.gitignore` keeps out `node_modules/`, `dist/`,
`.vite/`, `.vercel/`, env files, keys and logs — Vercel rebuilds all of it from
source. Never `git add -f` past it.

---

# Chapter 2 — The app

## What it does

Two layers. A **building** is an array of masses — each an extruded rectangle
with its own footprint, base level and floor count, because a single box cannot
express an L, a courtyard or an offset stack. Presets compose them, and the
facade is driven by one apartment module width, from which every window,
balcony and metric follows.

A **site** is a plot polygon plus a list of placed buildings, each with its own
full parameter set, position and free rotation. Buildings are generated in
their own local frame and placed with a transform, so the whole building
pipeline stays axis-aligned and untouched by the site layer.

## The site

- **Plot** — set width and depth under *Site*; the area, coverage and plot
  ratio all derive from it. Drawing an arbitrary polygon is M9.
- **Buildings** — the list under *Site* selects one. **Add** starts a new
  building clear of the last, **Duplicate** copies the selected one,
  **Remove selected** deletes it (never the last one). Rename it in the field
  below.
- **Placement** — type a position and rotation, use the rotation slider, or the
  0 / 45 / 90 / 135° chips. Or just **drag the building across the ground**.
  Dragging suspends orbit; a press that does not travel stays a click.
- **Selecting** — click a building to select it. Click a face of the *already
  selected* building to open its elevation override, so a face override never
  happens by accident on a building you were only trying to reach. Click bare
  ground to deselect.
- **Warnings** — a red `!` beside a building means it overlaps another one or
  is not wholly inside the plot. Both are named at the bottom of the metrics
  panel. Overlap is tested with a separating-axis test on the real rotated
  footprints, so a rotated building near another is not falsely flagged.

## The viewport

- **Orbit** — drag with the left mouse button.
- **Pan** — drag with the right mouse button.
- **Zoom** — scroll wheel.
- **Fit** — toolbar button. Reframes the whole building. The camera also
  reframes by itself when you switch preset, and never mid-drag.
- **Click an elevation** — selects that face and opens the override panel
  (top right). Click it again, or the ×, to deselect. Roof clicks are ignored.

## Toolbar

- **☰** — collapses the parameter sidebar to give the model the full width.
- **White / PBR / Diagram** — render mode. All three swap materials on the same
  geometry, so switching is instant and never rebuilds.
  - *White* — matte white study model, soft contact shadow, thin ink edges.
  - *PBR* — concrete, reflective glass, metal handrails, image-based lighting.
  - *Diagram* — flat fills, no shadows, blueprint grid. Masses are tinted by
    their position in the stack, so a stepped block reads at a glance. This is
    the mode for report screenshots.
- **Fit** — see above.
- **⤓ Image** — saves the viewport as a PNG at the current canvas resolution.

## Parameters — Massing

- **Preset** — `Bar`, `L-shape`, `T-shape`, `U-shape`, `Courtyard`, `Stacked`.
  Changing it regenerates the masses and reframes the camera. Only the wing
  sliders a preset actually reads are shown.
- **Floors** 2–30 — global floor count. `Stacked` splits it across three masses
  (roughly 40 / 35 / 25 %).
- **Floor height** 2.6–4.0 m — floor to floor, not clear ceiling.
- **Wing depth** 9–24 m — uniform across all wings in v1.
- **Wing A / B / C** 12–90 m — wing lengths. For `Courtyard`, Wing A is the
  outer length of the whole block.
- **Courtyard width** 12–60 m (`Courtyard` only) — clear width of the void.
  Wing A is forced up to `2 × depth + 8` so the ring can close.
- **Mass offset** 0–20 m (`Stacked` only) — how far each mass steps back.
- **Parapet** 0–1.5 m — upstand around exposed roof edges only, so a mass with
  another sitting on it does not get a parapet buried in the wall above.

## Parameters — Facade

- **Module width** 3.0–9.0 m — the width of one apartment module, and the thing
  the whole window rhythm derives from. Modules always divide an elevation
  evenly, so the built width is `length / round(length / requested)`. The blue
  line under the slider shows what you actually got — a range when different
  elevations snapped differently.
- **Windows per module** 1–3.
- **Window width** 0.6–3.5 m — clamped so `n` windows plus `n+1` piers of at
  least 0.3 m fit the module.
- **Window height** 1.2–2.8 m — clamped to `floorHeight − sill − 0.25 m` head.
- **Sill height** 0–1.2 m — 0 gives floor-to-ceiling glazing. If the sill and
  window cannot both fit, the sill gives way first.
- **Reveal** 0–0.4 m — how far the glass is inset from the wall face. Non-zero
  builds real jambs, a head and a sill inside the opening.

Any slider that had to be overruled says **"Built at …"** underneath. The handle
keeps the value you asked for; the building uses the resolved one.

## Parameters — Balconies

- **Type** — `None`, `Projecting`, `Loggia`, `Mixed`.
  - *Projecting* — a slab cantilevers past the wall, balustrade on three sides.
  - *Loggia* — a recess cut into the mass, glazing at the back, balustrade at
    the face. This **removes floor area**, and the metrics panel shows the
    deduction next to GFA.
  - *Mixed* — projecting or loggia chosen per module by the seed.
- **Pattern** — `Every module`, `Alternate modules`, `Checkerboard`,
  `Random (seeded)`.
- **Balcony depth** 1.2–2.5 m — capped at `depth / 2 − 1` so a loggia cannot
  eat more than half the wing.
- **Balcony width** 0.4–1.0 — share of the module, centred.
- **Start floor** — ground floor is 0. Floors below this get plain windows.
- **Balustrade** — `Glass`, `Solid`, `Bars`. Bars are costed before they are
  built; past 60 000 instances they fall back to solid infill and the metrics
  panel tells you.
- **Seed** — shown when the pattern or type needs randomness. The same seed
  always gives the same building.

## Parameters — Site and units

- **Site area** 200–20 000 m² — denominator for the coverage figure only.
- **Modules per unit** 1–3 — divides the module count into the unit estimate.
  Nothing else uses it.

## Config

- **Save site** — downloads `site-<timestamp>.json` as `{ version, app, site }`
  with the plot and every building.
- **Load site** — reads one back. A v1 or v2 file described a single building
  with no site, so it becomes a one-building site on a default plot; missing
  settings take defaults, and a file from a newer build loads with unknown keys
  dropped. You get a note under the buttons saying what happened.
- **Export site glTF (.glb)** — the whole site as one binary glTF, a named
  group per building positioned and rotated as on the plot, with balcony
  instances baked into merged meshes so any downstream tool can open it. The
  exporter is code-split, so it only downloads when you click.
- **Reset site** — back to the opening state.

## Elevation overrides

Click a face in the viewport. The panel shows that elevation's length, module
count, snapped module width and exterior area, and lets you override
**Balconies**, **Pattern** and **Windows per module** for that face alone.
`Inherit` returns a field to the global value; **Clear override** returns all of
them. Overrides are saved and loaded with the config.

## Metrics

Site totals first, then the selected building.

- **Plot ratio (FAR)** — GFA over plot area. **Coverage** — summed level-0
  footprints over plot area. Both assume nothing overlaps, which is why
  overlaps are flagged rather than absorbed.
- **Tallest** — the highest building on the site.

Per building:

- **GFA** — per-level footprint union (so an L-shape does not double-count its
  corner), minus loggia recesses. The deduction is shown when non-zero.
- **Units** — an estimate, labelled as one. Total facade modules ÷ modules per unit.
- **Facade** — exterior elevation area, excluding faces hidden at a junction,
  with the glazed percentage.
- **Footprint** — level-0 union area. **Coverage** — that over site area.
- **Balcony** — usable outdoor area of projecting balconies.
- The grey line at the bottom is the engineering readout: module count,
  triangles, and how long the last rebuild took. Hidden on narrow screens.

Under 900 px the sidebar becomes a bottom sheet, the viewport takes the full
width, and the metrics panel drops its diagnostic line.

## How it is built

One pure derivation, plus a thin scene on top:

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
a pure function you can call from a test or a script. The store keeps `params`;
the previous pass's buffers are disposed the moment a new one lands.

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
- **Config versioning.** Saved JSON is `{ version, app, site }`, currently
  version 3. The loader migrates rather than rejects, in three ways: a missing
  key takes its default, an unknown key is dropped, and a changed *shape* gets
  its own branch — a v1 (bare params) or v2 (`{ version, params }`) file
  becomes a one-building site on a default plot. A file from a newer build
  loads with what it does not recognise discarded. The UI says what happened.
  Note the loader detects the shape rather than switching on the number, so a
  file with a missing or wrong `version` still loads.

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

If the extreme end needs to be faster, the next lever is building geometry in a
worker.
