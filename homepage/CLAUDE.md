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

## 11. Handover from the app, 17 September 2026

The app's agent left `from-app/` — `WHATS-NEW.md`, `CORRECTIONS.md`,
`SHOT-LIST.md`, a generated `facts.json`, and four real exported drawings. It is
internal and `.vercelignore` excludes it. **Read `facts.json` before republishing
any number**: it is generated from the app's `RANGE` table and by building a
real scheme, so it is the one file in there that cannot have drifted.

**Two claims had gone from true to false without anyone touching this page.**

- *"There is no IFC export."* The app now writes IFC4 — storeys, slabs, walls,
  windows as real openings, balconies, georeferencing — and lacks only cores,
  the plot, property sets and a detail switch. It was in three places including
  the JSON-LD, which is the answer a search engine shows.
- *"Nothing it does needs a server."* Two features reach the network on an
  explicit press: Nominatim to search for a place, Overpass to import
  surroundings. A bounding box goes out, never the user's work.

Both were fixed in the visible FAQ **and** in the JSON-LD mirror, which is
exactly the failure the mirror was built to make impossible to forget.

**What was verified rather than assumed.** Every facade range on the page and
every figure in the metrics table still matches `facts.json` exactly — the
reference scheme is unchanged at 9 900 / 8 320 / 7 184 / 338 / 224. The
correction list also flagged "building depth as one value"; the page never said
that, so nothing to do.

**A new chapter, `What you get out`**, carries the four exported sheets. These
are the app's own output, so they meet the bar the drawn figures failed on 12
September. Their aspect ratios differ per sheet and **the declared dimensions
must come from each file's `viewBox`** — declaring one size for all four put
three of them at the wrong ratio, which is the layout shift §7 forbids. Same
bug as the screenshots in September; caught the same way, by reading the file.

**Sheet numbers now come from a CSS counter.** They were typed by hand and had
already drifted — the FAQ read `07` in a six-chapter page.

**Second pass the same day.** The exports chapter and the roadmap chapter were
both cut at the user's request. A table of file extensions is inventory, not a
claim, and a chapter about what is not built yet had already been rewritten once
without earning its room. Five chapters again.

`from-app/assets/ui/` arrived after the first read of the folder — twelve PNGs,
six shots as full frame and crop. **Note the crops start at y=40 and so cut the
top bar**, which is where the design-option menu lives; that feature is only
visible in the full frames. Two are published, both re-cropped and converted
here: the Site tab with its per-edge setback fields, and the metrics panel from
a twenty-storey scheme with retail and a unit mix, captioned as a different
scheme so it cannot be read against the table below it.

**Both had to lose their last line.** The metrics panel footer reads
`… · rebuilt in 19.7 ms`, and §5 forbids an unmeasured, unattributed performance
figure on the page. Cropping 46 px off the bottom removes it. Anything else
published from that folder needs the same check.

**Third pass, same day: icons.** The two interface snapshots came back out and
the metrics chapter went back to its table alone. Chapter 1 is now the app's
eight tabs — icon, name, one sentence — which explains the app by its own
structure rather than describing it from outside.

The icons are **drawn here**, inline, not taken from `src/ui/Icons.tsx`: same
rule as the mark and the palette, and inline SVG costs no request. Two were
redrawn immediately because Facade and Units had both come out as grids and read
as the same thing — Units is now a segmented bar, which is what a mix looks like.

Worth recording, because four approaches have now been tried for this chapter:
prose alone, drawn figures, app screenshots, and icons. Each of the first three
was cut for a different reason — thin, inaccurate, and unreadable at column
width respectively. If a fifth is proposed, that history is the argument to
answer.

**Fourth pass: every figure out.** The exported elevation and the three drawing
sheets were cut too, and with them the drawings chapter — a chapter whose claim
was a picture has nothing left once the picture goes. Its substance moved into
the Drawings line of the tabs list, which now carries the true-scale claim, and
the formats stay in the FAQ.

**The page now has no images in `main` at all.** What survives is the hero
block, and it survives because it is generated rather than captured: it cannot
drift from the app the way a screenshot does, and it cannot misrepresent it the
way a drawing did. That is worth remembering before proposing imagery again —
five approaches have been tried and only the generated one has lasted.

Four chapters, 1 314 words.

## 12. The hero shows its working, 17 September 2026

With every figure gone, the page asserted "metrics that show their working" and
showed none. The block already rotated through four schemes; now it computes
footprint, GFA and height for each and prints the arithmetic beneath them.

**Why this and not another picture.** Five kinds of imagery have been cut — 
prose-only, drawn figures, app screenshots, exported drawings, interface
snapshots. The block is the only visual that has survived, and the reason is
structural: it is generated from the same parameters it describes, so it cannot
drift from the app like a screenshot or misrepresent it like a drawing. A
number derived from the geometry on screen inherits that property. Anything
proposed for this page should be asked whether it does too.

**Checked by hand, not by eye.** The courtyard's wings are 624 + 624 + 168 +
168 = 1 584 m², and 1 584 × 8 = 12 672. The presets abut rather than overlap,
so the sum is exact and no polygon union is needed — which is precisely why the
working can be shown rather than asserted.

**Nothing that needs a plot.** Plot ratio and coverage were built and then
removed: the ground is a margin drawn to sit the block on, and dividing by it
reported 3.96 and 49.5%. True of the drawing, misleading about the tool.

**The cache trap caught me again**, exactly as §8 records — the pane served a
stale `block.js` and then a stale `index.html`, so a working feature looked
broken twice. Busting the page URL fixes the markup; the script needs fetching
and re-evaluating. Read §8 before debugging anything here that looks wrong.

## 13. The hero dressed as the app, 17 September 2026

The block and its figures now read as the app's own viewport rather than as a
drawing-office diagram.

**Colours were sampled, not chosen.** `sample2.mjs` in the scratchpad reads
pixels out of `from-app/assets/ui/ui-01-whole-app-crop.png`: the viewport is
`#cacac9`, roofs land near `#d2d1d1`, walls between `#9a` and `#b8`, the panel
is `#f7f6f4` and a plot handle is `#0f5c9a`. Matching by eye would have got the
viewport badly wrong — it is a mid grey, and every instinct here said pale.

What changed: the ground plate is gone, because in the app the ground simply is
the background; the plot is a thin blue line with a round handle at each corner;
there is a soft shadow under the massing; the windows are cool grey rather than
blue, since the app's white mode has no blue glass; the caption became the pill
the app floats at the top of its viewport; and the figures became the app's
metrics panel — card bottom-left, label, value, and the working set as the small
qualifier the app puts beside a number.

**Two things to know if this is touched.** Sampling needs the page on the
server's own origin — `about:blank` fails CORS and reports
`EncodingError: The source image cannot be decoded`, which reads like a corrupt
file and is not. And a 200 KB base64 literal in `Runtime.evaluate` throws a
bare `SyntaxError`; pass a URL instead.

**Known inconsistency:** the no-JavaScript fallback is still `hero.svg`, drawn
in the old beige-and-blue palette. Seen only with scripting off, and left rather
than churning the generator for a path almost nobody takes.

## 14. Four animated scenes, 17 September 2026

`scenes.js` — the tabs opening in turn, a facade that stretches and swaps its
balconies, the metrics shuffling one at a time, and two design options compared
side by side. `block.js` now publishes one function, `window.URBGEN.block`, so
the options scene draws with the same projection as the hero rather than a
second copy of it — this file and the drawings generator have already had the
same depth-sort bug independently, and once was enough.

**Geometry follows the app, not an impression of it.** The facade uses the real
fit from `src/geometry/facade.ts` — `count = max(1, round(length / requested))`,
`actual = length / count`, windows clamped by `PIER_MIN = 0.3` — which is why
the bays visibly re-divide instead of leaving a ragged remainder.

**Three bugs, all mine, all worth remembering:**

1. `tabs.querySelectorAll('li')` also returns the parameter items nested inside
   each tab, so the open class landed *inside* a tab rather than on one. Use
   `tabs.children`.
2. The `grid-template-rows: 0fr` collapse trick only constrains the first
   implicit row. These lists have six items, so nothing collapsed. `max-height`
   instead.
3. `.tabs li` matched the nested items too, handing them the icon column and
   the dimming. Scoped to `.tabs > li`.

And a fourth that is really a rule: **a scene must draw once before its loop
starts.** `loop()` skips frames while the document is hidden, so the facade came
up empty in a background tab and stayed empty. The hero always did this; the
new scene did not, and looked broken in every headless capture.

**Checked with scripting off**, because that is §1's actual constraint: scenes
hide, parameter lists stand open, the metrics table and spec list are
untouched, the hero falls back to its drawing. No overflow at 320 px, no
heading-level jumps, no dead nav links.

**Metrics chapter, restructured the same day.** Static plot and building on the
left, the figures shuffling on the right, and **no panel behind the figures** —
they sit on the page, which is what makes them read as the page's own claim
rather than as a picture of one.

The block beside them is **the very scheme the figures describe**: the app's
default, two wings of 40 × 13 on its real 110 × 90 m plot. That took two
additions to `block.js` — a `ref` plan whose footprint is exactly 1 040 m², and
an optional explicit plot so the boundary is the app's rather than a margin
invented around the massing. A real boundary is far larger than the massing, so
the fixed viewBox could not hold it and `block()` fits its own box when a plot
is given.

Worth the trouble: at 1 040 m² on 9 900 m², the building covers 10.5% of the
drawn plot, so the coverage figure can be read off the picture beside it. A
block drawn at any other size would have quietly contradicted every number in
the chapter.
