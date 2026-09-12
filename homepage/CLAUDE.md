# CLAUDE.md — homepage

This folder is a **separate project that happens to share a repo** with the app
above it. `project.md` §8 asked for this file so the boundary is stated rather
than assumed.

## 1. The boundary

- The reciprocal rule now exists: the app's own `CLAUDE.md` §0 tells an agent
  working there to leave this folder alone, and lists the couplings that run
  the other way. Both halves of the boundary are written down.
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
- **Copy pass, 12 September 2026.** Three sections rewritten against what the
  app actually does. The facade section now lists the *options* with their real
  ranges, taken from `project.md` §3 rather than from the screenshot, because
  the screenshot shows one set of values and the ranges are the point. Metrics
  are marked-up rows instead of a picture of rows — the figures are one real
  scheme, checked to be internally consistent (1 040 × 8 = 8 320;
  8 320 ÷ 9 900 = 0.84; (8 320 − 338) × 0.90 = 7 184). "What it does not do"
  became "What is being built next"; see `project.md` §4.6 for why, and note
  that §5's ban on roadmap-as-promise still holds — the section carries no
  dates and says so.
- Checked after: no heading-level jumps, the metrics table has a caption and
  real row headers, no overflow at 320 px or 1280 px, and every `<picture>`
  paired with the right heading and caption. The reveal animation's range now
  ends at `entry 100%` so content fully on screen is never left half-faded on a
  tall display.
- **Known redundancy:** `shot-hero` and `shot-site` are byte-identical, because
  the app opens on the Site tab and the hero shot is taken before any tab is
  clicked. Harmless — a visitor fetches one or the other, never both — but the
  capture script could skip one.
- **Section menu, 12 September 2026.** Seven anchor links in the sticky bar, no
  script — `block.js` had about 170 bytes of the 5 KB budget left, so a
  JavaScript menu was never an option. Checked: all seven targets exist, every
  anchor lands its heading 76 px down and clear of the 57 px bar, and at 320 px
  the bar is two rows with the link strip scrolling inside itself while
  `documentElement.scrollWidth` stays at 320. One bug caught in my own CSS:
  `.sheet:target` can never match, because the ids are on the `h2` elements and
  not on the sections.
- **Watch the budget.** HTML and CSS are now 37.9 KB against §7's 40 KB. The
  next addition to either needs the budget revisited rather than quietly
  exceeded.

---

## 7. The content plan

**Measured first, 12 September 2026.** Nine blocks, 1 494 words, seven numbered
chapters. "facade" appears in five sections, "module" in five, "metrics" in
five, "plot" in six, "export" in four. The page explains itself repeatedly.

**Target: five chapters, about 1 000 words, and every section carrying exactly
one claim** — which is what `project.md` §4 always asked for and the page
stopped doing.

| # | Part | Status |
|---|---|---|
| 1 | Delete **How it works** | **done** |
| 2 | Its three steps became the hero workflow line | **done** |
| 3 | **Why it is different** cut to its two non-duplicate claims | **done** |
| 4 | Those two moved into the hero; chapter retired | **done** |
| 5 | Facade de-duplicated — one chapter, not two | **done** |
| 6 | Export told once; FAQ defers to the roadmap section | **done** |
| 7 | Metrics prose halved; the table carries it | **done** |
| 8 | One-claim audit: the site row stopped pre-empting metrics | **done** |
| 9 | Nav trimmed to five live targets; §4 rewritten | **done** |
| 10 | Re-measured and re-checked | **done** |

### What must survive the cut

Cutting chapters is not licence to cut claims `project.md` §5 requires. After
this, the page must still say: free, no account, nothing uploaded; that the
unit count is an estimate; that it runs in the browser and keeps working
offline once loaded; and that IFC export does not exist. If a cut would take
one of those with it, the claim moves — it does not disappear.

**Result, 12 September 2026.** Seven chapters to five. 1 494 words to 1 224.
HTML and CSS 37.9 KB to 35.2 KB, which buys back the headroom the section menu
had eaten. Two dead nav links (`#why`, `#how`) were caught and removed in the
same pass — deleting a section silently breaks the menu that points at it.

## 8. Design pass, 12 September 2026

Ten improvements, proposed from measurement rather than impression and then
applied. What moved:

- **The hero block fills its frame.** Its viewBox was fixed for the tallest
  scheme a reader never sees, so a short block floated in dead space — 48% of
  the panel used. The box is still a constant size, so scale stays honest
  between schemes, but it is now centred on what is drawn. Fill is 58–86%
  depending on scheme; all four verified to fit 108×94 by solving the extents,
  not by eye.
- **The screenshots are legible.** A 1600 px app window shown at ~560 px put
  the sidebar text at 3–4 px — texture, not information. Rows now stack, the
  figure takes the full column and bleeds into the rail, and the capture is
  cropped to rail, panel, model and metrics. That text now reads at about 11 px.
- **The hero column reads as one argument.** The workflow line repeated the
  lead's own opening clause and is gone; the two claims sit side by side under
  the button instead of stacking beneath it.
- Type scale: `h3` was 19.2 px against 16 px body, a ratio of 1.2 that barely
  registered as a level. Now ~22 px with tighter tracking.
- The sheet number sat ~90 px from its heading. Rail narrowed to 76 px and the
  number carries a rule toward the heading, so it reads as a label.
- Pace varies: the two table-heavy chapters keep the full measure, the roadmap
  and FAQ tighten.
- `Window width and height — 0.6 – 3.5 m · 1.2 – 2.8 m` never said which range
  was which. Two rows now.
- "None of it is cut out of a solid" was the section's best line, orphaned under
  a long table. Promoted to a marked statement under the lead.
- The hero panel's 14 px radius and gradient belonged to a different page than
  the hairline rules used everywhere else. Flat panel, hairline frame.

**Caught while checking:** the browser pane was serving a cached `block.js`, so
the fitting looked broken when it was not — confirmed by fetching the file and
re-running it, which moved the viewBox from `-49 -70 118 130` to
`-47.9 -33.5 108 94`. Worth remembering before debugging something that is
already fixed on disk.

**And a note on the earlier mobile scare:** headless captures at 390–430 px
show text clipped at the right edge. That is Windows enforcing a minimum window
width, not page overflow. Verified directly at 320, 390 and 430:
`scrollWidth === clientWidth` at all three.

## 9. Graphics pass, 12 September 2026

**Back to drawn.** Four figures were app screenshots; now one is, and it is
captioned as such. The rest are drawings. Reasons, in order: the drawings carry
the brand, they read at any width where a 1600 px desktop UI does not, they cost
a fraction of the bytes, and they do not rot when the app's UI moves — which is
the hazard `project.md` §6 names.

- Three chapters had no image at all. The facade chapter now opens with a
  dimensioned elevation — one module and one floor ticked off, the reveal drawn
  as the shadow line, loggias labelled with a leader. The metrics chapter shows
  the overlap correction its table describes.
- **Drawings paint no background.** They multiply onto the page, so a paper
  rect just darkened whatever section they sat in — which showed as a grey box
  on the tinted facade chapter. `render()` now defaults to a transparent
  ground; only `og.svg` keeps its paper, because it is rasterised on its own.
- The footer is a title block: four labelled fields on a ruled grid, in the
  same micro-type the metrics caption and the spec legend already use.
- A faint sheet grid sits behind the hero block. Drawing paper, not a card.

**A tool worth keeping in mind.** Capturing one element of a long page needs
CDP, not a window-size trick: `Page.captureScreenshot`'s `clip` is in **page**
coordinates, so a viewport-relative rect silently captures the top of the
document instead. Fragment URLs (`/#facade`) render blank in headless and are
not worth debugging — scroll, wait, then clip.

## 10. Depth-sort fix, 12 September 2026

The courtyard rendered wrong in both the hero and the massing drawing: a false
step across the front, because the near south wing was being painted over.

**Cause.** Both renderers sorted masses back-to-front by the *centre* of each
footprint. That is only right when masses are similar in extent. A courtyard's
east wing is short but sits at high `x`, so its centre outranks the long south
wing that is genuinely nearer, and it painted over it.

**Fix.** For axis-aligned boxes in this projection, A is behind B when A ends
before B begins on either axis — `a.x1 <= b.x0 || a.z1 <= b.z0`. Repeatedly take
whichever mass has nothing left that must precede it. Applied in `block.js` and
in `tools/build-illustrations.mjs`, which had the same bug independently.

**What made this safe to change.** Before touching either file, both orderings
were run over all four presets: the result differs *only* for the courtyard.
L, U and bar come out identical, so the fix could not regress the three that
looked right. Worth doing that comparison first whenever a sort is replaced.

`block.js` is 6.1 KB against the 6 KB target, so the comment was trimmed rather
than the budget moved a second time.
