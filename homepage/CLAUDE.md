# CLAUDE.md — homepage

This folder is a **separate project that happens to share a repo** with the app
above it. `project.md` §8 asked for this file so the boundary is stated rather
than assumed.

## 1. The boundary

- Work started in `homepage/` **stays in `homepage/`**. Do not edit anything in
  the parent repo from here — not `src/`, not the root `project.md`, not the
  root `vercel.json`, not `README.md` at the root. If a change up there is
  needed, say so and stop.
- Nothing here imports from the app, and nothing in the app reaches in here.
  There is no build step, so an import is not even possible without acquiring
  one — do not acquire one.
- The mark and the palette are **copied** from `src/ui/Logo.tsx` and
  `src/ui/styles.css`. Copied, deliberately. See `project.md` §6.
- Facts about the app on this page are **checked against the app's
  `project.md` and `README.md`, never remembered**. The app moves faster than
  this page will.

## 2. Hard rules

- Hand-written static HTML and CSS. No framework, no bundler, no npm
  dependency, no build step. Astro is the escape hatch and it is not open — see
  `project.md` §10.1.
- The page must be complete with JavaScript disabled. Today there is no
  JavaScript at all.
- No third-party requests of any kind: no fonts, no analytics, no embeds, no
  CDN. The privacy claim in the copy has to stay true.
- No cookies. The site must never need a consent banner.
- **Never claim AI.** Not "generative", not "AI-powered", not "smart", not
  "learns". `project.md` §5 is the full list and it is not negotiable.
- No invented social proof, no unmeasured performance numbers, no comparisons
  naming a competitor, no roadmap stated as a promise.
- Every image carries explicit `width` and `height`.
- `project.md` is the single spec. Keep it current, and record any deviation in
  `README.md` § Deviations with the reason.

## 3. Stop and ask

- Anything that would add a dependency, a build step, or a script tag.
- Anything that answers an open question in `project.md` §10 — the repo link,
  attribution, analytics, a second page, a gallery.
- Publishing anything, or changing a Vercel or domain setting.
- A change to the app, for any reason.

## 4. Checking

No test runner, nothing to typecheck. Serve the folder and look at it:

```bash
npx serve homepage
```

Then: JavaScript off, 320 px wide, tab through it, and check the network panel
shows this origin only.
