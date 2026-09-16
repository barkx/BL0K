# URBGEN

**Parametric building design, in the browser.** Draw a plot, place buildings on it,
and change a slider to rebuild any of them. Each building is parametric massing
plus a module-driven facade; floorplans come later.

[`project.md`](project.md) is the spec — decisions, milestones, roadmap and
open questions. Working rules for contributors are in [`CLAUDE.md`](CLAUDE.md).

- **[Chapter 1 — Running, coding, publishing](#chapter-1--running-coding-publishing)**
- **[Chapter 2 — The app](#chapter-2--the-app)**

---

# Chapter 1 — Running, coding, publishing

## Run it locally

```bash
npm install
npm run dev
```

Opens on http://localhost:5173. Edits hot-reload. Set `PORT` to use a different
one, which lets a second dev server run alongside the first instead of quietly
sliding to another port.

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

Vercel is linked, and every push to `main` deploys. Pushes to other branches
get preview URLs.

**Two Vercel projects build this one repo**, and the difference between them is
the root directory:

| Project | Root directory | Domain |
|---|---|---|
| the app | the repo root | `app.urbgen.com` |
| the homepage | `homepage/` | `urbgen.com` |

Both [`vercel.json`](vercel.json) files carry an `ignoreCommand` so a push that
touched only one project does not rebuild the other. Without it the deploy
history stops being useful for working out what broke. `homepage/` is a separate
project with its own spec and its own agent — see [`CLAUDE.md`](CLAUDE.md) §0.

Deployed-app secrets go in the Vercel dashboard under **Project → Settings →
Environment Variables**, never in the repo. Locally they belong in `.env.local`,
which is ignored.

## Working on the code

### Layout

| Directory | What lives there |
|---|---|
| `store/` | Params, ranges, `resolveParams`, presets, the Zustand store |
| `site/` | Plot and placed buildings, site derivation, site metrics, site rules |
| `lib/poly.ts` | Plan polygon maths: area, containment, self-intersection, overlap, distance |
| `geometry/` | Masses, elevation frames, facade model, walls, roof, balconies, edges |
| `metrics/` | Area and unit-count derivation |
| `scene/` | R3F components, material sets per render mode, lighting |
| `ui/` | Sidebar, sliders, metrics panel, per-elevation override panel |
| `io/` | glTF export, metrics CSV, config save/load with migration, underlay image loading |
| `lib/` | Clamping, seeded RNG, rectangle/span algebra, the mesh builder |

### Conventions

- Metres internally, everywhere. Format only at the display edge (`lib/units.ts`).
- Geometry is derived, never stored. Params in, `BufferGeometry` out.
- Geometry builders are pure: no scene access, no side effects, no React.
- Seeded randomness only, via `lib/rng.ts`. Never `Math.random()` in geometry.
- Clamp in exactly one place per kind of data: `resolveParams()` in
  `store/params.ts` for building parameters, `resolveRules()` in
  `site/types.ts` for the site rules. See Deviations.
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

## Getting around

**A tab is also a tool.** The open section decides what the viewport does, which
is the only way the same click can mean four different things without becoming a
guessing game. Three layers:

- **Always live, in every tab** — orbit, pan, zoom, double-click to frame, and
  selecting a building. These are navigation, not editing, so nothing gates
  them. Pick a block in any tab, then go and change it.
- **Tab-scoped** — the handles and the drags. Plot corners and the underlay
  belong to Site, moving a block to Placement, dragging a core to Massing, face
  overrides to Facade. Elsewhere those gestures simply are not there, and a
  press that no tool claims falls through to orbit.
- **Clicking drills in** — each click on the same building goes one level
  deeper, at the scale you would work at next:

  | | |
  |---|---|
  | Click the ground | Deselects, and returns to **Placement** — the site scale |
  | Click a building | Selects it, and opens **Placement** — where you put it |
  | Click it again | **Massing** — where you shape it |
  | Click a face | **Facade** — where you detail it, with that elevation open |
  | Click another face | Stays in Facade, switching elevations |
  | Click the plot boundary | **Site** — where the boundary itself is edited |
  | Click a core | **Massing**, and the drag starts in the same gesture |

  The press that *selects* a building is the first rung, so its release is not
  also the second — one click never lands you in Massing. The Facade rung needs
  a **vertical** face, since that is the thing being overridden; a click on a
  roof or a sill has no elevation to name, and leaves you where you were.

Leaving a tab puts away what belonged to it: a half-drawn boundary is cancelled
when you leave Site, a face override closes when you leave Facade. A mode you
cannot see is exactly the failure this arrangement exists to prevent, so the
hint bar under the toolbar always names what the current tab lets you do.

What stays visible in every tab is the geometry itself — the plot outline, the
underlay, the buildings. Only the *handles* hide. Losing the boundary you are
designing against would be losing context, not clutter.

The sidebar is an icon rail with six sections, and the rest of this chapter
follows them in order:

| Section | Holds |
|---|---|
| **Site** | Plot boundary, site rules, overlay image |
| **Placement** | The list of buildings, and where the selected one sits |
| **Massing** | Footprint preset and wings; floors, floor height, parapet; core |
| **Facade** | Module, windows, balconies |
| **Units** | The unit estimate, and the net-area factor |
| **Settings** | Render mode and image, save, load, export, reset |

Under 900 px the whole sidebar becomes a bottom sheet and the rail lays out
horizontally.

## The viewport

- **Orbit** — drag with the left mouse button.
- **Pan** — drag with the right mouse button.
- **Zoom** — scroll wheel.
- **Frame the site** — double-click the ground. The camera also reframes by
  itself when you switch preset, and never mid-drag. There is no Fit button:
  the gesture is on the thing it frames.
- **Click an elevation** — selects that face and opens the override panel
  (top right). Click it again, or the ×, to deselect. Roof clicks are ignored.
- **Drag a core** — in the Massing tab, on a building that is already selected,
  press a shaft and drag it along its track. Pressing a shaft from another tab
  goes to Massing and starts the drag in the same gesture. On an unselected
  building the press just selects, so reaching for a building by its roof never
  shoves its core across the plan.
- **Clicking a horizontal facet does nothing** — roofs, and also window sills
  and reveal shelves, since they are horizontal too. Faces are picked on their
  vertical surfaces.

## Toolbar

The mark and the sidebar toggle, and nothing else. Render mode and the image
snapshot live under **Settings → View**; framing is a double-click on the
ground. A strip that holds three unrelated controls is where things accumulate,
and the viewport is worth more than the bar above it.

- **☰** — collapses the parameter sidebar to give the model the full width.

## Site

- **Underlay** — drop a map screenshot or site plan anywhere on the viewport,
  or pick one under *Underlay image*. Then **Set scale from two points**: click
  two points whose real distance you know — a street width, a building edge, a
  scale bar — and type that distance. The image rescales about the midpoint of
  the two, so what you measured stays put. Position it by dragging or by
  number, rotate it, fade it, then **Lock** it so it stops taking clicks while
  you trace. The plot fill hides itself whenever an underlay is showing.
- **Plot** — **Draw new boundary**, then click corners on the ground. Close it
  by clicking the red first corner or pressing Enter; Backspace undoes a
  corner, Esc cancels. Afterwards, drag a corner to move it, click a small
  midpoint handle to add one, right-click a corner to remove one. *Reset to
  rectangle* takes a width and depth. Area, coverage, plot ratio and the
  off-plot check all follow the polygon, concave shapes included. A boundary
  that crosses itself is flagged, because its area is meaningless.
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
- **Rules** — five planning limits for the plot: **setback** to the boundary,
  **separation** between buildings, a **height cap**, a **plot ratio cap** and a
  **coverage cap**. Zero means a rule is off, which is how a fresh site opens —
  a tool that invents limits nobody asked for would warn about a scheme that
  has no breach. Distances are measured in plan to the outside face of the
  massing, and the height cap to the top of the parapet. Breaches are listed at
  the bottom of the metrics panel with both numbers, so you can see what the
  scheme does against what the rule allows. A building already outside the plot
  does not also raise a setback breach, and two overlapping buildings are
  reported as a clash rather than as a separation breach — one mistake, one
  warning. The rules are site state: they save with the config and apply to
  every building, because a setback belongs to a boundary and a plot ratio cap
  is meaningless per block.
- **Warnings** — a red `!` beside a building means it overlaps another one or
  is not wholly inside the plot. Both are named at the bottom of the metrics
  panel. Overlap is tested with a separating-axis test on the real rotated
  footprints, so a rotated building near another is not falsely flagged.

### Core

- **Cores** 0–4 — a rectangular shaft of stairs, lift and risers. Zero is none.
  Cores are shared out between the wings by length and then spaced evenly
  within each wing, so one core lands mid-wing on the longest wing, two put one
  in each wing of an L, and four spread one to a side of a courtyard. No
  preset-specific placement table.
- **On the perimeter / In the centre** — which track the shafts sit on.
  *Perimeter* puts each shaft flush against an exterior face; *centre* straddles
  the spine of a wing, touching nothing. The track belongs to the building, not
  to the core, so widening a shaft never slides it sideways.
- **Drag a shaft to place it.** Select the building first, then press on a core
  and drag: it slides along its track rather than following the cursor, so it
  stays on the wall it is on. The cursor can be well off the building and the
  shaft still lands somewhere real. A position is stored as a fraction of the
  track, not a point in space, so resizing the block keeps the core where you
  put it relative to the wall. **Space them evenly again** hands them back to
  the automatic spread, and editing the footprint does the same by itself — an
  offset measured against one track means nothing on another.
- **Core width / depth** — along and across the wing. A perimeter shaft may use
  the wing's full depth; a centre one keeps wall on both sides. If a run is too
  short or too shallow for the size asked, the shaft is shrunk to fit and the
  panel says what was built, the same bargain the facade module makes when it
  snaps.
- **Overrun** 0–3.5 m — how far the shaft rises above the roof slab. It is the
  only part you can ever see: the rest is inside the building. At the default
  1.6 m it clears the 0.9 m parapet, which is what makes a core legible on a
  massing model at all.
- Each shaft rises to the top of the tallest mass that actually covers it, so a
  core under a stacked block's setback stops where the building above it stops.
- **A perimeter core takes the facade with it.** Where a shaft meets an
  exterior wall, that stretch loses its modules: no windows, no balconies, and
  no units counted behind a lift. The wall is still built and still counts as
  facade area — it is solid masonry, not a hole. Watch the unit count move as
  you drag: a 10 m shaft on a 6 m module grid blanks two bays when it lands on
  the grid and three when it straddles it. The test is geometric rather than a
  flag on the mode — a core blanks a face when its rectangle actually reaches
  that face's plane — so *centre* mode blanks nothing without being
  special-cased.
- **This is massing, not a floorplan.** No stairs, no lift cars, no corridors —
  `project.md` §1 still rules those out. What the shaft buys is an NIA derived
  from geometry rather than guessed at by a single factor, and a facade that
  knows where its units cannot be.

## Placement and elevation overrides

Click a face in the viewport. The panel shows that elevation's length, module
count, snapped module width and exterior area, and lets you override
**Balconies**, **Pattern** and **Windows per module** for that face alone.
`Inherit` returns a field to the global value; **Clear override** returns all of
them. Overrides are saved and loaded with the config.

## Massing

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

## Facade

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

### Balconies

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

## Units

- **Modules per unit** 1–3 — divides the module count into the unit estimate.
  Nothing else uses it. Site area is not a parameter; it comes from the plot.
- **Efficiency** 0.85–0.97, default 0.90 — the share of *core-free* GFA that is
  net, per building. Cores come off first and are derived from geometry; this
  factor covers what is still not modelled — internal walls, risers, plant. It
  is what turns GFA into NIA in the metrics panel and the CSV.

## Settings

- **White / PBR / Diagram** — render mode. All three swap materials on the same
  geometry, so switching is instant and never rebuilds.
  - *White* — matte white study model, soft contact shadow, thin ink edges.
  - *PBR* — concrete, reflective glass, metal handrails, image-based lighting.
  - *Diagram* — flat fills, no shadows, blueprint grid. Masses are tinted by
    their position in the stack, so a stepped block reads at a glance, and the
    core is darker than every mass tint. This is the mode for report screenshots.
- **Save image (.png)** — the viewport at the current canvas resolution.
- **Save site** — downloads `urbgen-site-<timestamp>.json` as `{ version, app, site }`
  with the plot, the site rules, every building and the underlay image. The image travels
  inline as a data URL so the file is self-contained, which is why anything
  over 2048 px is downscaled before it is stored.
- **Load site** — reads one back. A v1 or v2 file described a single building
  with no site, so it becomes a one-building site on a default plot; a v3 file
  predates site rules, so it loads with every rule off, which is what it meant;
  missing settings take defaults, and a file from a newer build loads with unknown keys
  dropped. You get a note under the buttons saying what happened.
- **Export site glTF (.glb)** — the whole site as one binary glTF, a named
  group per building positioned and rotated as on the plot, with balcony
  instances baked into merged meshes so any downstream tool can open it. The
  exporter is code-split, so it only downloads when you click.
- **Export IFC (.ifc)** — the site as an IFC4 Reference View file: a project,
  a site, a building per block placed and rotated as on the plot, a storey per
  level, floor and roof slabs, exterior walls, and every window as a real
  `IfcOpeningElement` with an `IfcWindow` filling it. This is the export you
  continue a project from; the glTF is for looking at.

  Written by hand rather than through a library, so it adds no dependency and
  runs offline like everything else. GlobalIds are derived from the model, not
  generated fresh, so saving a scheme and re-exporting it later updates the same
  elements downstream instead of replacing them — and renaming a building does
  not disturb them either.

  Not in it yet: balconies, loggia recesses and their windows, cores, the plot
  boundary, and property sets carrying the metrics. The app models no wall or
  slab thickness, so the file states an assumed one — see § Deviations.
- **Export metrics (.csv)** — the metrics panel as a spreadsheet: four tables in
  one file — site totals, a row per building, every rule with its limit, worst
  case and met / breach / off status, then the warnings. Numbers are plain, with
  the unit in the column heading, so a cell is something a spreadsheet can sum
  rather than a formatted string. No lazy import: unlike the glTF exporter it
  carries no library.
- **Reset site** — back to the opening state.

## Metrics

Site totals first, then the selected building.

- **Plot ratio (FAR)** — GFA over plot area. **Coverage** — summed level-0
  footprints over plot area. Both assume nothing overlaps and that the
  boundary is simple, which is why overlaps and a self-crossing plot are
  flagged rather than absorbed.
- **NIA** — summed net internal area, with the resulting site-wide efficiency
  beside it. NIA is `(GFA − core area) × efficiency`: the core is measured off
  the geometry, and the factor covers only what is not modelled — internal
  walls, risers and plant. That is why the factor's range starts at 0.85 rather
  than the 0.60 it would need if it had to swallow the core too.
- **Core** — floor area the shafts take out of every storey they pass through,
  and what share of GFA that is. Shown only when there is a core.
- **Tallest** — the highest building on the site.
- **Breaches** — any site rule the scheme breaks, each with what the scheme
  does and what the rule allows.

Per building:

- **GFA** — per-level footprint union (so an L-shape does not double-count its
  corner), minus loggia recesses. The deduction is shown when non-zero. The net
  figure beside it is GFA times this building's efficiency factor.
- **Units** — an estimate, labelled as one. Total facade modules ÷ modules per
  unit. Modules blanked by a perimeter core are not counted.
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
- **The IFC export invents a wall and a slab thickness.** The app models
  facades as zero-thickness panels and does not build floors at all — only
  levels. IFC has no way to describe a wall without one, so `exportIfc.ts`
  states `WALL_THICKNESS` and `SLAB_THICKNESS` as named constants, quotes both
  in the UI beside the button, and says so here. Anything downstream measuring
  a wall or a slab from an exported file is measuring this assumption, not a
  result the app computed. Making them real parameters is the honest fix, and
  it is a massing decision rather than an export one.
- **A second clamping function, `resolveRules()`.** The rule is one clamping
  point, `resolveParams()`. Site rules are not building parameters — they are
  site state, they never reach a geometry builder, and folding them into
  `resolveParams` would mean handing it data no building has. So they get their
  own single clamping point in `site/types.ts` rather than being clamped at
  each input. The intent of the rule — no clamping scattered across the UI —
  still holds: there are two functions, and no third place.

## Open questions from the spec, as built

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
5. **Site** — a drawn plot polygon, not a `siteArea` number. Area, coverage,
   plot ratio, the off-plot test and the setback check all read the polygon.
6. **Setbacks** — both a minimum to the boundary and a minimum between
   buildings, checked in the same pass as clashes. Still open underneath: a
   setback that varies per plot edge, since a street frontage and a party
   boundary rarely take the same number.
7. **Cores** — a rectangular shaft, shared between wings by length. Open
   underneath: whether a core should be placed by hand rather than derived,
   and whether one core per N units should drive the count instead of a
   slider.

## Designed for later

- **Floorplans.** A module is addressable as `(elevation, floor, index)` and
  that address is carried on `ModuleSlot`, not baked into geometry.
- **Plinth.** `floorHeight` is still scalar, but nothing outside
  `resolveParams` assumes it — the geometry reads a per-floor `yBase`.
- **Sun study.** The directional light is positioned from
  `sunPosition(azimuth, altitude, distance)`. A date/time control drives two
  numbers.
- **Config versioning.** Saved JSON is `{ version, app, site }`, currently
  version 5. The loader migrates rather than rejects, in three ways: a missing
  key takes its default, an unknown key is dropped, and a changed *shape* gets
  its own branch — a v1 (bare params) or v2 (`{ version, params }`) file
  becomes a one-building site on a default plot, a v3 file gets its rules key
  filled with every rule off, and a file written before cores existed loads
  with none — hand-placed core offsets travel with it, as a list of fractions
  and nulls — a missing `coreCount` means no core, not the default one, so an
  old scheme never grows a shaft its author never drew. A file from a newer build
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
