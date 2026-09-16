# CLAUDE.md

**This file is for the app.** `homepage/` is a different project with a
different agent — see §0 before touching anything inside it.

## 0. Scope: this repo holds two projects

| | This project | `homepage/` |
|---|---|---|
| What | the URBGEN app | the marketing site |
| Domain | `app.urbgen.com` | `urbgen.com` |
| Spec | [`project.md`](project.md) | [`homepage/project.md`](homepage/project.md) |
| Agent instructions | this file | [`homepage/CLAUDE.md`](homepage/CLAUDE.md) |
| Vercel project | its own, root directory = repo root | its own, root directory = `homepage/` |
| Stack | Vite + React + R3F | hand-written HTML and CSS, no build step |

**Do not edit anything inside `homepage/` from here.** If a change is needed
there, say so and stop — it is work for an agent started in that folder, under
that folder's rules. The boundary is a convention, not a sandbox: sharing one
repo means crossing it is merely disallowed, not impossible.

### Three couplings run outward from this repo

They are invisible from inside `src/`, and each one goes stale silently.

1. **The mark and the palette are copied, not imported.** `homepage/` holds its
   own copy of the shape in `src/ui/Logo.tsx` and the colour variables in
   `src/ui/styles.css`. Change either and the homepage keeps the old brand
   until someone updates it. Say so when you change them.
2. **The homepage carries screenshots of this app**, captured by
   `homepage/tools/capture-screenshots.mjs`. A UI change here is not finished
   until those are retaken — which is homepage work, so flag it rather than do
   it.
3. **The homepage quotes facts and figures from this app** — parameter ranges,
   and a real scheme's metrics written into its markup. Changing a default or a
   clamp can make the homepage state something untrue. Flag it.

### Do not tidy these away

- The `ignoreCommand` in [`vercel.json`](vercel.json) excludes `homepage/` so a
  homepage-only push does not rebuild and redeploy the app. It looks like noise
  and is not.
- `homepage/.vercelignore`, `homepage/vercel.json` and the `homepage/tools/`
  scripts belong to that project. §1's "keep GitHub to what Vercel needs to
  build" is about *this* project's files, and does not make `homepage/` cruft.

## 1. Hard Rules

### Code
- Metres internally, everywhere. Format only at the display edge (`src/lib/units.ts`).
- Geometry is derived, never stored. Params in, `BufferGeometry` out.
- Geometry builders stay pure: no scene access, no side effects, no React.
- Never `Math.random()` in geometry. Seeded only, via `src/lib/rng.ts`.
- Clamp in exactly one place per kind of data: `resolveParams()` in
  `src/store/params.ts` for building params, `resolveRules()` in
  `src/site/types.ts` for site rules. Never clamp at an input.
- No CSG. Openings and loggias are built as panels around the void.
- Rebuild geometry at most once per frame. Never once per pixel of a drag.
- Instance repeated boxes; merge static walls. Do not regress to per-element meshes.
- Docker locating lives only in `scripts/docker.mjs`. Do not duplicate it.
- Buildings are generated in their **own local frame** with axis-aligned masses.
  Placement (position, rotation) belongs to the site layer, never inside
  `geometry/`. Do not rotate masses within a building.
- Site area comes from the plot polygon. Render mode is store state. Neither is
  a per-building parameter.
- **A tab is a tool.** `store.tool` scopes what the viewport does: handles and
  drags belong to their section, while selection and the camera stay live
  everywhere. Add a new viewport gesture by gating it on `tool`, never by
  stacking another condition onto an existing pointer handler.
- **Clicking drills in.** Ground and a first click go to Placement, a second to
  Massing, a click on a vertical face to Facade; the plot boundary goes to Site
  and a core to Massing. The rung is read from the current `tool`, so there is
  no separate counter to keep in step. The press that selects a building records
  `wasSelected`, because its release must not also count as the next rung.
- A press on a building always calls `stopPropagation()`, in every tab. The
  ground behind it clears the selection on a press, so letting one through
  deselects the very building being clicked. It does not reach the native event,
  so orbit still works when no tool claims the drag.
- Anything draggable in plan projects through `useGroundProjector` and runs on
  window listeners. A drag must survive the cursor leaving the mesh it started
  on, so never handle one with mesh-local pointermove. Buildings, plot corners
  and cores all go through it; a core is additionally constrained to its track
  rather than following the cursor.
- Two passes over the elevations, in this order: cores need the exterior faces
  to sit on, and the facade needs to know which stretches the cores took. Do not
  collapse `buildElevations` then `buildCores` then `blankForCores` into one.

### Secrets and privacy
- Never commit credentials. Not in code, `vercel.json`, `Dockerfile`,
  `docker-compose.yml`, `.bat` files, or commit messages.
- `.gitignore` blocks `.env*`, `.vercel/`, `*.pem`, `*.key`, `.npmrc`, `.netrc`,
  `*.token`, `secrets.json`. Verified clean: no secrets in any tracked file or
  anywhere in history.
- Never `git add -f` to push past `.gitignore`.
- Secrets for the deployed app go in the Vercel dashboard (Project → Settings →
  Environment Variables). Locally they go in `.env.local`, which is ignored.
- Vercel tokens, GitHub tokens and Docker credentials live in those tools' own
  credential stores. Never read them into the repo, a file, or terminal output.
- Claude must never type the user's passwords, tokens or payment details
  anywhere. Sign-ins are the user's to do.
- Commits publish an author name and email. Not a credential, but it is public —
  identity here is repo-local (see §6), so it does not leak from other projects.
- If a secret is ever committed: **rotate it first**, then rewrite history. The
  push is already public, so rotation is what actually protects you.

### Process
- `npm run build` must pass before every commit. It typechecks first.
- Never commit `node_modules/`, `dist/`, `.vite/`, `.vercel/`.
- `project.md` is the single spec for this project. Keep it current as the app
  changes. It does not govern `homepage/`, which has its own — see §0.
- Record any deviation from `project.md` in `README.md` § Deviations, with the reason.
- Do not add a dependency without naming the reason in the commit message.
- Keep GitHub to what Vercel needs to build, plus Docker files, scripts and docs.
- Docker is local only. It is never part of a Vercel deploy.

## 2. Authority & Links

- Single spec **for the app**: [`project.md`](project.md) — decisions §1,
  non-goals §1, milestones §8, roadmap §9, open questions §10. The homepage has
  its own, [`homepage/project.md`](homepage/project.md); neither governs the
  other.
- [`README.md`](README.md) — the one doc. Chapter 1: running, coding,
  publishing. Chapter 2: the app, its features, design and performance.
- GitHub: `https://github.com/barkx/BL0K` — branch `main`. The repo keeps its
  old name on purpose; only the app was rebranded. Do not rename it.
- Vercel: linked, and builds `main` on push; config in `vercel.json`. A second
  Vercel project builds `homepage/` from the same branch, which is why both
  `vercel.json` files carry an `ignoreCommand`.
- Git scripts: `setup-git.bat` (already run — do not run again), `push.bat`
- Container: `Dockerfile` (targets `dev`, `prod`), `docker-compose.yml`,
  `scripts/docker.mjs` (locator), `run.bat` (Windows double-click wrapper)

## 3. Setup / Test

- Node >= 20. `npm install`.
- No test runner is configured. Do not claim tests pass.
- Verify with `npm run build`, then the app in a browser.
- For logic changes, bundle a throwaway entry with `npx esbuild --bundle
  --platform=node --format=esm` and run it under `node`. Delete it afterwards.
- Check numbers against a hand calculation, not against the previous screenshot.

## 4. Workflow

```bash
npm run dev            # local dev, http://localhost:5173
npm run build          # typecheck + bundle — must pass before committing
npm run docker:prod    # production container, http://localhost:8080
npm run docker:dev     # dev container, hot reload
```

```bat
push.bat               :: commit + push to main -> Vercel deploys
```

- `run.bat [dev|stop|logs]` is the same as the docker scripts, double-clickable.
- `npm run docker:stop` / `docker:logs` for teardown and output.
- `push.bat` prompts for a message; it does **not** typecheck, so build first.
- Vercel needs no command. Push to `main` and it deploys. To link it the first
  time, see README.md ch.1 § Publish it.

## 5. Stop Conditions

Ask before proceeding:

- A change touches a locked decision in `project.md` §1.
- A change implements a `project.md` §1 non-goal (floorplans, corridors,
  stairs, lifts, terrain, neighbour volumes, plinth, cost, collaboration).
  Cores came in at M12 as a massing shaft; the circulation inside one did not.
- A change needs a backend. There is none, by decision.
- An open question in `project.md` §10 would be answered differently from
  `README.md`.
- A new runtime dependency, or a three.js / R3F / drei major version bump.
- The spec is ambiguous in a way that changes geometry or metrics.
- Anything would be published outside a push to `main`.
- A command would install to, or modify, global/user config outside this repo.
- **A change would touch `homepage/`.** That is a different project with a
  different agent — say what is needed and stop. See §0.
- A change to the mark, the palette, the UI, or a parameter default or clamp —
  all three are copied or quoted by the homepage (§0), so say so, even when the
  change itself is entirely within this project.

Refuse:

- `git push --force`, history rewrites, or `git add -f` over `.gitignore`.
- Committing while `npm run build` fails.
- Committing anything matching the secret patterns in §1.
- Reporting a performance number that was not measured warm, on this machine.

## 6. Project State

- **M1–M13 complete**, see `project.md` §8.
  - **M1–M7, the building**: six presets with per-floor junction detection,
    module-driven facade with real openings, projecting and loggia balconies,
    three render modes, metrics, glTF export, config I/O, per-elevation
    overrides, bottom sheet under 900 px.
  - **M8, the site**: many placed buildings, free rotation, drag on the ground,
    site metrics with clash and off-plot detection, config v3, whole-site glTF.
  - **M9, the plot**: draw a boundary, drag / insert / remove corners. Concave
    supported; a self-intersecting boundary is detected and flagged.
  - **M10, the underlay**: drop a map or site plan, set its true scale from two
    points, position / rotate / fade / lock it, trace over it. The image rides
    in the config as a downscaled data URL.
  - **M11, rules and reporting**: five site rules — setback, separation, height
    cap, FAR cap, coverage cap — checked in the same pass as clashes and
    reported in the same warning block. Zero means a rule is off, so no scheme
    inherits a limit nobody set. NIA from a per-building `efficiency` factor.
    Metrics out as CSV. Config v4.
  - **M12, the core**: a rectangular shaft — count, width, depth, overrun —
    sitting on a **track**: the exterior faces (`perimeter`) or the wing spines
    (`centre`). Shared between runs by length, and draggable along the track on
    a selected building; a hand position is `coreOffsets[i]`, a fraction of the
    track, `null` meaning automatic. Editing the footprint or the mode releases
    them, because the track is rebuilt. Rises to the top of the tallest mass
    covering it; only the overrun is visible. A perimeter shaft **blanks the
    facade it meets** via `Elevation.blankByFloor` — no modules, so no windows,
    balconies or units, and `buildWalls` fills the gap with solid wall down the
    path a junction sliver already takes. The test is geometric, not
    mode-flagged. NIA is `(GFA − core area) × efficiency`, and the factor moved
    to 0.85–0.97 now it no longer has to swallow the core. Config v5: a file
    with no `coreCount` predates cores and loads with none. Reopens part of a §1
    non-goal — massing shaft only, no stairs, lifts or corridors.
  - **M13, tabs as tools**: the open section is `store.tool`, not local sidebar
    state, because the viewport reads it. Plot handles only in Site, block drag
    only in Placement, core drag only in Massing, face override only in Facade;
    selection and camera are live everywhere. Leaving a tab cancels what belongs
    to it — a half-drawn boundary, an open face override. The hint bar names the
    current tab's gestures, since an invisible mode is the failure case here.
    The plot boundary is a click target, which needs the canvas raycaster's
    `Line.threshold` widened — a one-pixel line is not something you can hit.
    Clicking drills in: ground and first click to Placement, second to Massing,
    a vertical face to Facade with that elevation open. Consequence to know
    about: a click on the ground *inside* the plot leaves the Site tab, because
    the ground is the site surface and returns you to the site scale.
- **UI**: the sidebar is an icon rail with six sections — Site, Placement,
  Massing, Facade (balconies live here), Units, Settings. Rules sit in Site;
  the core sits in Massing; the efficiency factor sits in Units. The top bar is
  deliberately bare — render mode and the PNG snapshot are in Settings, and
  double-clicking the ground frames the site, so there is no Fit button. Inside
  a panel, sections are flat `Block`s, not nested accordions. Roads and parking are
  intended for Placement. Horizontal rail in the bottom sheet under 900 px.
- **Brand**: URBGEN — short for urban generator, though the tagline stays
  "Parametric building design" precisely so nothing reads as generative AI.
  Renamed from BL0K (and 3DBlock before it); the repo keeps the BL0K name.
  One axonometric block, three
  flat faces, no strokes — `src/ui/Logo.tsx`, same shape as the favicon. The
  palette is unchanged drawing-office greys and blueprint ink. There is no AI
  in this app and the branding must not claim otherwise.
- **Next**: M14 IFC export, **stages 1 and 2 landed** — see `project.md` §8.
  `src/io/exportIfc.ts` writes IFC4 Reference View by hand, no dependency:
  storeys, slabs, exterior walls, and windows as real openings. Stage 3 is
  balconies and loggias first, then cores, the plot, property sets and a detail
  switch. Two things to know before touching it: **loggia windows are skipped on
  purpose** until the recess is cut, and **GlobalIds are derived from
  `placement.id` alone** so a rename does not reissue every element's identity.
  DXF import sits behind all of it.
- **Biggest gap, by decision**: no **IFC export**. glTF is a visualisation
  format — nobody continues a project from it, so today the tool dead-ends
  rather than feeding Revit or ArchiCAD. Treated as a blocker, not a backlog
  item. See `project.md` §9.
- **Positioning**: deliberately a simpler tool than Forma or Spacio. Do not
  chase simulation breadth or generative AI. Defend facade depth, determinism,
  offline-and-free, and metrics that show their working. `project.md` §9.
- **Verified**: 480-case parameter sweep (seeded output byte-identical), site
  layer checks (metrics, SAT clash detection, buffer reuse on move), polygon
  checks (self-intersection, concave area and containment, winding), config
  v1/v2/v3/v4/v5 migration, site GLB with named groups, both Docker targets,
  fresh-clone build.
  - **M11**: 40 checks against hand values — plan distances, every rule's breach
    numbers and its met and off cases, the clamps, NIA, CSV shape and quoting,
    and a v3 file loading with every rule off.
  - **M12**: 35 checks — both tracks against hand-computed perimeter lengths,
    flush-to-wall and straddle-the-spine placement, the per-run share, facade
    blanking (module counts, glazing, and facade area unchanged), drag
    resolution onto the nearest run, clamping at a run's ends, offset list
    sizing, determinism, NIA arithmetic, and a pre-core file loading with none.
  - Checked in the browser too: every rule breaching at its hand-computed
    figure, a core dragged along a wall moving the blanked bays with it, and the
    unit count following.
- **Deviations** (all in README): default `sillHeight` is 0.65 m because the
  spec's three facade defaults cannot coexist; windows are merged, not
  instanced; site rules get a second clamping function, `resolveRules()`.
- **Not done yet**:
  - `npx plugins add vercel/vercel-plugin` was deliberately not run. User's call.
  - No test runner. `project.md` §9 answers are provisional.
  - 30-floor courtyard rebuilds in ~25 ms warm. If that needs to improve, the
    next lever is building geometry in a worker.
- **Environment quirks that will bite you**:
  - Docker Desktop is a **per-user** install and **not on PATH**. Handled by
    `scripts/docker.mjs`; bare `docker` fails in a plain shell.
  - Git identity is set **repo-local**, not global.
  - `.bat` files are CRLF via `.gitattributes`; everything else is LF.
  - npm here gates postinstall scripts — `allowScripts` in `package.json`
    approves esbuild's. A fresh `npm install` elsewhere may prompt.
  - Both `.bat` files are interactive; they stall in a non-interactive shell.
    Run the equivalent git commands directly instead.
