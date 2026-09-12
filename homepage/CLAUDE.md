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

---

## 5. The improvement plan

Ten parts, ordered by how much each changes the page for a visitor. **Keep the
status column current** — this table is the record, and a part is not done
until the line says so and says how it was verified.

| # | Part | Owner | Status |
|---|---|---|---|
| 1 | Self-host a variable font | Claude | **done** — approved; §1 row changed to match |
| 2 | Real app screenshots, replacing the six drawings | Claude | **done** — four of six; headless Chrome over CDP |
| 3 | Open Graph image, 1200×630 | Claude | **done** |
| 4 | Contrast and accessibility re-audit against the new design | Claude | **done** |
| 5 | Give the hero block a ground plane so it does not float | Claude | **done** |
| 6 | `urbgen.com` primary, `www` redirecting to it | user | **blocked** — Vercel dashboard, and the 308 is cached |
| 7 | The IFC sentence — "not yet" or silence | Claude | **done** — states the absence, promises nothing, per §5 |
| 8 | Footer repo link and licence | needs a decision | **blocked** — §10.4 |
| 9 | Attribution, or stay unattributed | user | **done** — unattributed, decided 12 Sep |
| 10 | Re-measure the budget and record it | Claude | **done** — 205 KB, 12 requests |

### What "blocked" means here

Two remain. **6** is a Vercel dashboard setting only the account holder can
make. **8** needs the repo to be public under a named licence before the footer
can link to it — inventing a link that 404s is worse than the missing link.

7 and 9 were closed without new input, and it is worth being honest about how.
9 was answered on 12 September: unattributed. 7 was resolved to the only option
§5 permits — the page states that IFC export does not exist and promises
nothing, because "coming" is a date this project does not have. If either
should go the other way, they are a sentence each.

### Rules while working through it

- **One part per commit** where the parts are separable, so any of them can be
  reverted without taking the others with it.
- **Verify, then write down how.** "Looks right" is not a status. The entries
  below name the check.
- Re-run the budget after anything that changes bytes. `block.js` has about
  400 bytes of headroom against §7's 5 KB, so it is the one to watch.
- Nothing in this plan may break: the page complete with JavaScript off, zero
  third-party requests, no cookies, and no claim of AI.

## 6. Work log

Newest last. One line per part, naming the check that settled it.

- *(started 12 September 2026)*
- **4 — audit. Done.** 18 colour pairs computed against WCAG AA at the sizes
  they render; all pass, tightest 5.82:1 against a 4.5 requirement. Structure
  checked in the browser: one `h1`, no heading-level jumps, four landmarks,
  every image with alt text and explicit dimensions, every `aria-labelledby`
  resolving, skip-link target present.
- **3 — Open Graph card. Done.** Generated as `og.svg` by the illustrations
  script, rasterised to 1200×630 with local headless Chrome, checked by eye,
  and wired up with `og:image`, its dimensions, alt text, and
  `twitter:card: summary_large_image`. Verified the PNG header really is
  1200×630.
