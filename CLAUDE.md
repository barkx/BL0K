# CLAUDE.md

## 1. Hard Rules

- Metres internally, everywhere. Format only at the display edge (`src/lib/units.ts`).
- Geometry is derived, never stored. Params in, `BufferGeometry` out.
- Geometry builders stay pure: no scene access, no side effects, no React.
- Never `Math.random()` in geometry. Seeded only, via `src/lib/rng.ts`.
- Clamp in exactly one place: `resolveParams()` in `src/store/params.ts`.
- No CSG. Openings and loggias are built as panels around the void.
- `npm run build` must pass before every commit. It typechecks first.
- Never commit `node_modules/`, `dist/`, `.vite/`, `.vercel/`, `.env*`.
- Do not edit `project.md`. It is the spec of record, not a working doc.
- Record any deviation from `project.md` in `README.md` § Deviations, with the reason.
- Do not add a dependency without naming the reason in the commit message.
- Keep GitHub to what Vercel needs to build, plus Docker files and docs.
- Docker is local only. It is never part of a Vercel deploy.
- Docker Desktop here is a per-user install and is NOT on PATH. Use `run.bat`,
  not bare `docker` or `npm run docker:*`.
- Rebuild geometry at most once per frame. Never once per pixel of a drag.
- Instance repeated boxes; merge static walls. Do not regress to per-element meshes.

## 2. Authority & Links

- Spec of record: [`project.md`](project.md) — locked decisions §1, non-goals §1, milestones §8
- Architecture, decisions, deviations, measured performance: [`README.md`](README.md)
- Every feature, both delivery paths, Vercel linking: [`USAGE.md`](USAGE.md)
- GitHub: `https://github.com/barkx/BL0K` — branch `main`
- Vercel: builds `main` on push once linked; config in `vercel.json`
- Git scripts: `setup-git.bat` (first time only), `push.bat` (every time after)
- Container: `Dockerfile` (targets `dev`, `prod`), `docker-compose.yml`, `run.bat`

## 3. Setup / Test

- Node >= 20. `npm install`.
- No test runner is configured. Do not claim tests pass.
- Verify with: `npm run build`, then the app in a browser.
- For logic changes, bundle a throwaway entry with `npx esbuild --bundle
  --platform=node --format=esm` and run it under `node`. Delete it afterwards.
- Check numbers against a hand calculation, not against the previous screenshot.

## 4. Workflow

```bash
npm run dev            # local dev, http://localhost:5173
npm run build          # typecheck + bundle — must pass before committing
```

```bat
run.bat                :: production container, http://localhost:8080
run.bat dev            :: dev container, hot reload, http://localhost:5173
run.bat stop           :: tear both down
push.bat               :: commit + push to main -> Vercel deploys
```

## 5. Stop Conditions

Ask before proceeding:

- A change touches a locked decision in `project.md` §1.
- A change implements anything in `project.md` §1 non-goals (floorplans, cores,
  sun study, plinth, site context, cost, code compliance).
- One of the open questions in `project.md` §9 would have to be answered
  differently from `README.md` § Open questions.
- A new runtime dependency, or a three.js / R3F / drei major version bump.
- The spec is ambiguous in a way that changes geometry or metrics.
- Anything would be published outside a push to `main`.

Refuse:

- `git push --force`, history rewrites, or committing over `.gitignore`.
- Committing while `npm run build` fails.
- Reporting a performance number that was not measured warm, on this machine.
