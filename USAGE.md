# Usage

Two ways to run this, and one control at a time explained.

- [Run it](#run-it) — local, Docker, Vercel
- [The app, feature by feature](#the-app-feature-by-feature)

---

## Run it

### Local (fastest loop)

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

### Docker

Works the same for everyone, on any OS:

| Command | What you get | Port |
|---|---|---|
| `npm run docker:prod` | Production bundle served by nginx - closest thing to Vercel | http://localhost:8080 |
| `npm run docker:dev` | Vite dev server in a container, hot reload | http://localhost:5173 |
| `npm run docker:stop` | Stops and removes both containers | - |
| `npm run docker:logs` | Follows container output | - |

On Windows, `run.bat` is the same thing but double-clickable from Explorer, and
it opens the browser for you: `run.bat`, `run.bat dev`, `run.bat stop`,
`run.bat logs`.

#### Finding Docker

`scripts/docker.mjs` resolves Docker in this order:

1. **`docker` on PATH.** A normal install, CI, and anyone else cloning the
   repo land here and nothing else runs.
2. **Known install locations** for the current platform, if PATH has nothing.
   Windows: the per-user `%LOCALAPPDATA%\Programs\DockerDesktop`, then
   `Program Files`, then `ProgramData`. macOS: Homebrew, `/usr/local/bin`, and
   `Docker.app`. Linux: `/usr/bin`, `/usr/local/bin`, `~/.docker/bin`.

It prints which one it used. If neither works it lists every path it tried.

Docker Desktop on this development machine is a **per-user** install that never
put itself on PATH, which is why the fallback exists. When Docker is found off
PATH, its folder is prepended to PATH **for that child process only** - the
credential helper and the compose plugin live next to `docker.exe`, and image
pulls fail with `docker-credential-desktop: executable file not found` without
them. Nothing outside the process is changed.

If you would rather have it on PATH permanently, this is yours to run - it is
not required:

```powershell
[Environment]::SetEnvironmentVariable('Path',
  [Environment]::GetEnvironmentVariable('Path','User') + ';' +
  "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin", 'User')
```

#### Notes

- Both targets live in one `Dockerfile`; `docker-compose.yml` picks between them.
- If the engine is not running, the script starts Docker Desktop and waits up
  to three minutes.
- Compose v2 (`docker compose`) is used; the script checks for it and reports
  clearly if only the legacy standalone binary is present.
- `dev` keeps `node_modules` inside the image (an anonymous volume hides the
  host's), so Windows-built binaries never leak into the Linux container. Both
  commands pass `--build`, so a new dependency is picked up on the next run.
- Hot reload in a container relies on polling (`VITE_POLLING=1`), because bind
  mounts on Windows do not deliver filesystem events. Verified working: editing
  a file on the host updates the page in the container.
- `dev` and `prod` can run at the same time, on their two ports.
- Docker is never involved in a Vercel deploy. It is for local parity and for
  running the app on a machine without a Node toolchain.

### GitHub + Vercel

First time only:

```bat
setup-git.bat
```

Initialises the repo, writes git identity if missing, sets `origin` to
`https://github.com/barkx/BL0K.git`, pushes `main`. It will not overwrite the
existing `.gitignore`.

Every time after that:

```bat
push.bat
```

Prompts for a commit message (Enter gives a timestamp), then `git add . &&
git commit && git push`. Run `npm run build` first — `push.bat` does not
typecheck for you.

To link Vercel (once):

1. vercel.com → **Add New** → **Project** → **Import Git Repository**
2. Pick `barkx/BL0K`. Framework preset should read **Vite**.
3. Leave build command and output directory alone — `vercel.json` already
   pins `npm run build` and `dist`.
4. Deploy. From then on every push to `main` deploys automatically, and
   pushes to other branches get preview URLs.

What GitHub actually holds: `src/`, `index.html`, `package.json`,
`package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vercel.json`, the
Docker files, the `.bat` scripts and the Markdown. `.gitignore` keeps out
`node_modules/`, `dist/`, `.vite/`, `.vercel/`, env files and logs — Vercel
rebuilds all of it from source.

---

## The app, feature by feature

### Viewport

- **Orbit** — drag with the left mouse button.
- **Pan** — drag with the right mouse button.
- **Zoom** — scroll wheel.
- **Fit** — toolbar button. Reframes the whole building. The camera also
  reframes by itself when you switch preset, and never mid-drag.
- **Click an elevation** — selects that face and opens the override panel
  (top right). Click it again, or the ×, to deselect. Roof clicks are ignored.

### Toolbar

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

### Sidebar — Massing

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

### Sidebar — Facade

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

### Sidebar — Balconies

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

### Sidebar — Site and units

- **Site area** 200–20 000 m² — denominator for the coverage figure only.
- **Modules per unit** 1–3 — divides the module count into the unit estimate.
  Nothing else uses it.

### Sidebar — Config

- **Save config** — downloads `block-<timestamp>.json` as
  `{ version, app, params }`.
- **Load config** — reads one back. Older files load with missing settings
  taking defaults; a file from a newer build loads with unknown keys dropped.
  Either way you get a note under the buttons saying what happened.
- **Export glTF (.glb)** — the whole building as a binary glTF: walls and roof
  per mass, glazing, and balcony instances baked into merged meshes so any
  downstream tool can open it. The exporter is code-split, so it only downloads
  when you click.
- **Reset to defaults** — back to the opening state, overrides cleared.

### Elevation override panel

Click a face in the viewport. The panel shows that elevation's length, module
count, snapped module width and exterior area, and lets you override
**Balconies**, **Pattern** and **Windows per module** for that face alone.
`Inherit` returns a field to the global value; **Clear override** returns all of
them. Overrides are saved and loaded with the config.

### Metrics panel

- **GFA** — per-level footprint union (so an L-shape does not double-count its
  corner), minus loggia recesses. The deduction is shown when non-zero.
- **Units** — an estimate, labelled as one. Total facade modules ÷ modules
  per unit.
- **Facade** — exterior elevation area, excluding faces hidden at a junction,
  with the glazed percentage.
- **Footprint** — level-0 union area. **Coverage** — that over site area.
- **Balcony** — usable outdoor area of projecting balconies.
- The grey line at the bottom is the engineering readout: module count,
  triangles, and how long the last rebuild took. Hidden on narrow screens.

### Narrow screens

Under 900 px the sidebar becomes a bottom sheet, the viewport takes the full
width, and the metrics panel drops its diagnostic line.
