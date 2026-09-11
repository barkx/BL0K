# CLAUDE.md

## 1. Hard Rules

### Code
- Metres internally, everywhere. Format only at the display edge (`src/lib/units.ts`).
- Geometry is derived, never stored. Params in, `BufferGeometry` out.
- Geometry builders stay pure: no scene access, no side effects, no React.
- Never `Math.random()` in geometry. Seeded only, via `src/lib/rng.ts`.
- Clamp in exactly one place: `resolveParams()` in `src/store/params.ts`.
- No CSG. Openings and loggias are built as panels around the void.
- Rebuild geometry at most once per frame. Never once per pixel of a drag.
- Instance repeated boxes; merge static walls. Do not regress to per-element meshes.
- Docker locating lives only in `scripts/docker.mjs`. Do not duplicate it.
- Buildings are generated in their **own local frame** with axis-aligned masses.
  Placement (position, rotation) belongs to the site layer, never inside
  `geometry/`. Do not rotate masses within a building.
- Site area comes from the plot polygon. Render mode is store state. Neither is
  a per-building parameter.
- Anything draggable in plan projects through `useGroundProjector` and runs on
  window listeners. A drag must survive the cursor leaving the mesh it started
  on, so never handle one with mesh-local pointermove.

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
- `project.md` is the single spec. Keep it current as the app changes.
- Record any deviation from `project.md` in `README.md` § Deviations, with the reason.
- Do not add a dependency without naming the reason in the commit message.
- Keep GitHub to what Vercel needs to build, plus Docker files, scripts and docs.
- Docker is local only. It is never part of a Vercel deploy.

## 2. Authority & Links

- Single spec: [`project.md`](project.md) — decisions §1, non-goals §1,
  milestones §8, roadmap §9, open questions §10.
- [`README.md`](README.md) — the one doc. Chapter 1: running, coding,
  publishing. Chapter 2: the app, its features, design and performance.
- GitHub: `https://github.com/barkx/BL0K` — branch `main`
- Vercel: builds `main` on push **once linked**; config in `vercel.json`
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
- A change implements a `project.md` §1 non-goal (floorplans, cores, terrain,
  neighbour volumes, plinth, cost, collaboration).
- A change needs a backend. There is none, by decision.
- An open question in `project.md` §10 would be answered differently from
  `README.md`.
- A new runtime dependency, or a three.js / R3F / drei major version bump.
- The spec is ambiguous in a way that changes geometry or metrics.
- Anything would be published outside a push to `main`.
- A command would install to, or modify, global/user config outside this repo.

Refuse:

- `git push --force`, history rewrites, or `git add -f` over `.gitignore`.
- Committing while `npm run build` fails.
- Committing anything matching the secret patterns in §1.
- Reporting a performance number that was not measured warm, on this machine.

## 6. Project State

- **M1–M10 complete**, see `project.md` §8.
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
- **UI**: the sidebar is an icon rail with six sections — Site, Placement,
  Massing, Facade (balconies live here), Units, Settings. Inside a panel,
  sections are flat `Block`s, not nested accordions. Roads and parking are
  intended for Placement. Horizontal rail in the bottom sheet under 900 px.
- **Brand**: BL0K, "Parametric building design". One axonometric block, three
  flat faces, no strokes — `src/ui/Logo.tsx`, same shape as the favicon. The
  palette is unchanged drawing-office greys and blueprint ink. There is no AI
  in this app and the branding must not claim otherwise.
- **Next**: M11 DXF import.
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
  v1/v2/v3 migration, site GLB with named groups, both Docker targets,
  fresh-clone build.
- **Deviations** (both in README): default `sillHeight` is 0.65 m because the
  spec's three facade defaults cannot coexist; windows are merged, not instanced.
- **Not done yet**:
  - Vercel project is **not linked** — one dashboard step, see README.md ch.1.
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
