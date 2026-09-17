# URBGEN — the homepage

The marketing site at **urbgen.com**. One job: explain what URBGEN is in about
five seconds, and send the right people to **app.urbgen.com**.

**This is the single spec of record for the homepage.** It is a working
document — keep it current as the page changes, and record any deviation in
`README.md` § Deviations once that file exists.

It is a *separate project* from the app, sharing one repo. Separate Vercel
project, separate domain, separate deploys — but the same git history. The app
lives at `app.urbgen.com` and is specified by the `project.md` at the repo root;
nothing here builds, imports or deploys it, and nothing there reaches in here.

---

## 1. Decisions locked in

| Area | Decision |
|---|---|
| Domain | `urbgen.com`, with `www` redirecting to the apex |
| Hosting | Vercel, its own project, root directory `homepage/` in the app's repo |
| Stack | Hand-written static HTML + CSS. No framework, no build step |
| JavaScript | Optional and tiny. The page must be complete with JS disabled |
| Backend | None. Same rule as the app |
| Fonts | One self-hosted variable font, latin subset. No third-party font requests |
| Analytics | None at launch. If added, cookieless and first-party only |
| Cookies | None. The site must never need a consent banner |
| Images | Self-hosted, `.webp` with a raster fallback, explicit width/height |
| Content | One page at launch. Extra pages are a decision, not a default |
| Brand | Same mark, palette and tagline as the app. No AI claims, ever |

### Why no framework

A one-page marketing site built from hand-written HTML and CSS has no
dependency tree to audit, no build to break, no framework upgrade to chase, and
no hydration cost. It also means anyone — human or agent — can open one file and
see the whole page. Astro is the escape hatch if a changelog or a docs section
arrives and templating starts to pay for itself; until then it would be
machinery around three hundred lines of markup. See §10.

### Explicit non-goals, for now

- A blog, a newsletter, or an email capture form.
- A pricing page. The app is free; a page saying so is a sentence, not a page.
- Accounts, logins, or anything that implies either exists.
- A docs site. The app's `README.md` is the documentation.
- A cookie banner — by not needing one.
- A chat widget, a support desk, or a status page.
- Third-party embeds of any kind, including video players and map tiles.
- Any claim of AI. See §5.

These are deferred, not rejected. Nothing here should make them painful to add.

---

## 2. Who the page is for

In rough order of how much the page owes them:

1. **A student or small practice** doing an early massing or feasibility study,
   who would otherwise pay for Forma or push boxes around in SketchUp by hand.
   They need to know it is free, needs no account, and does real facades.
2. **An architect evaluating tools**, who will want to know the limits before
   the features. They are the reason §6 of the page exists.
3. **Someone sent a link** with no context at all. The hero alone has to leave
   them knowing whether this is for them.

The page is not written for investors, recruiters, or search engines. If a
sentence only serves one of those, cut it.

---

## 3. What the page must achieve

| | |
|---|---|
| Primary | A click through to `app.urbgen.com` |
| Secondary | An accurate impression of scope, so the click is not wasted |
| Tertiary | Enough trust that a practice would put it in front of a client |

The secondary matters more than it looks. The app takes no sign-up, so a
mismatched visitor costs nothing but their time — but a visitor who arrives
expecting IFC export and leaves annoyed costs goodwill. Being plain about what
the tool does not do is the cheapest trust the page can buy.

---

## 4. Page structure

One page. **Each section carries exactly one claim** — and on 12 September 2026
the page was measured against that rule and failed it: nine blocks, 1 494
words, seven numbered chapters, with "facade" appearing in five sections,
"plot" in six and "export" in four. It now runs to five chapters and about
1 220 words.

The sticky bar carries a **section menu**, one link per numbered chapter. Plain
anchors, no script: on a narrow screen it drops to a second row and scrolls
sideways within itself, never making the page scroll. `scroll-padding-top`
keeps an anchored heading clear of the bar and differs between the one-row and
two-row layouts.

1. **Hero.** Mark, name, tagline, one sentence, one button: *Open the app* —
   the only primary action above the fold. Beside it, a block that rebuilds
   itself through four schemes. Under the button, the one-line workflow (draw,
   shape, export) and the two claims that no other section makes: free with no
   account and offline once loaded, and identical inputs giving an identical
   building.
2. **What it does.** **The app's own eight tabs, each with a line icon and one
   sentence** — Site, Placement, Massing, Program, Facade, Units, Drawings,
   Settings, in the order the decisions happen. Then one line about design
   options and undo, which belong to the window rather than to any tab.

   Chosen 17 September 2026 after prose, then drawings, then screenshots had
   each been tried and cut. It explains the app by its own structure instead of
   describing it from outside, which is both shorter and harder to get wrong:
   if a tab is added or renamed, the list is obviously stale rather than subtly
   so.

   **Icons are drawn here, not imported.** Same rule as the mark and the
   palette — `homepage/` has no build step and cannot reach into `src/`. They
   are inline SVG, so they cost no request and inherit the ink colour.

   **No interface screenshots.** Tried on the 17th and cut the same day. §6's
   staleness hazard is the standing reason; the immediate one is that a desktop
   UI shrunk into a column is texture rather than information, which §8 already
   recorded once about the earlier set.

3. **The facade, and what you can change.** The one capability worth its own
   section, because it is the thing rivals do not have. Presented as the
   *options* — module width, windows per module, window sizes, sill, reveal,
   balcony type and pattern, per-elevation overrides — with the range of each
   and what it does. A reader deciding whether the tool fits wants the
   controls, not a section drawing.
4. **Metrics that show their working.** A real scheme's figures in a table,
   each row saying what the number is made of, plus the planning limits checked
   in the same pass. **Marked up, not a screenshot** — a picture of numbers
   cannot be read by a screen reader, selected, or checked.
5. **Drawings you can print.** Three exported sheets — site plan, floor plan,
   section — shown as the exporter's own unretouched output, with the true-scale
   claim that makes them worth having. The elevation lives in §4.3 instead,
   where it illustrates the facade chapter's own subject. Not a list of file
   formats: that was tried on 17 September as "What you get out" and cut the
   same day, because a table of extensions is inventory rather than a claim.
   The formats live in the FAQ, where somebody looking for them will look.

   **There is no roadmap chapter.** "What it does not do" became "What is being
   built next" on 12 September and was deleted on the 17th. Both framings spent
   a chapter on what the tool is not yet, and neither earned the room. §5's ban
   on roadmap-as-promise is unaffected — with no roadmap on the page there is
   nothing to promise.

7. **FAQ.** Six, answering what the positioning provokes: account, data,
   offline, export, price, AI.
8. **Footer.** Portrait, name, role — *Architect | BIM Specialist* — and three
   social links: LinkedIn, YouTube, Facebook. Then a fine-print line holding the
   URBGEN mark, the privacy statement and the year. Nothing else.

   Adapted 12 September 2026 from the author's own site, archviz.one, then cut
   back the same day to those three elements. The borrowed version carried four
   columns of links; a one-page site has nowhere of its own to send people, and
   a footer of outbound links is a set of exits from a page whose single job is
   one click to the app.

   Three things were changed in the adaptation and all three still hold.
   **The "AI-Driven Design & Automation" clause was dropped**, because §5
   forbids the page implying AI and a visitor will not stop to work out that
   the phrase describes a person rather than this tool. **The portrait is
   self-hosted**, WebP with a JPEG fallback, because the page makes no
   third-party requests and a hotlinked image would break the claim printed two
   lines beneath it. **The social marks are inline SVG**, for the same reason.

### What was cut, and where its content went

- **"How it works"** — 77 words, and every concept in it appeared elsewhere.
  Its three steps became the single workflow line in the hero.
- **"Why it is different"** — four claims, two of which restated the facade and
  metrics chapters. The two that were genuinely its own, determinism and no
  account or cloud, moved into the hero beside the button, which is where the
  decision is actually being made.

**Cutting chapters is not licence to cut claims.** Everything §5 requires still
appears: free, no account, nothing uploaded; the unit count labelled an
estimate on the row where it appears; runs in the browser and keeps working
offline; and, **since 17 September 2026**, IFC export stated as *partial*
rather than absent — what the file carries, what it does not, and that it has
not been import-tested. That now lives **in the FAQ only**, since the chapter
that also carried it was cut; if the FAQ answer is ever trimmed, this claim has
nowhere else to live and must move rather than vanish. The page said
"there is no IFC export" until the app's agent handed over a correction; it had
been true when written and quietly stopped being so.

**"Works offline" now carries a qualification** and must keep it. Searching for
a place and importing surroundings reach Nominatim and Overpass, on an explicit
press, sending a bounding box and nothing the user drew. Everything else, every
export included, still works unplugged. The claim is not weakened by saying so
and is weakened by being caught overstating.

---

## 5. Claims: what may be said, and what may not

### Must not be said

- **Anything implying AI, machine learning, or generative design.** The app is
  parametric and seeded; identical inputs give byte-identical output. "Generate"
  as a verb describing geometry is fine. "Generative", "AI-powered", "smart",
  "intelligent" and "learns" are not. The name expands to *urban generator* and
  that is where the word stops.
- **Invented social proof.** No testimonials, no client logos, no user counts,
  no "trusted by" — not until they are real and attributable.
- **Performance numbers that were not measured.** No "instant", no millisecond
  figures, unless measured and attributed to a stated machine.
- **Comparisons to named products.** The positioning is defensible; a table with
  a rival's name in it is a maintenance liability and an invitation.
- **Roadmap as promise.** "IFC export is coming" commits a date the project does
  not have. See §10.

### Must be said

- Free, no account, no upload. These are the differentiators and they are true.
- That the unit count is an estimate, wherever it is mentioned.
- That it runs in the browser, and keeps working offline once loaded.

### Tone

The app's documentation explains its own compromises in plain language. The
homepage should read like the same product wrote it: precise, unhurried, no
exclamation marks, no growth-copy verbs. If a sentence would embarrass the
`README.md`, it does not ship.

---

## 6. Brand and assets

The app is the source of truth: `src/ui/Logo.tsx` for the mark,
`src/ui/styles.css` for the palette. Copy them here rather than importing them.
Sharing one repo makes an import look tempting, but this page has no build step
and cannot pull from a Vite app without acquiring one — and twenty lines of CSS
variables plus one SVG is not worth that. Revisit only if the brand starts
changing often.

- **Mark** — one axonometric block, three flat faces, no strokes. Same shape as
  the app's favicon.
- **Wordmark** — `URBGEN`, with the tagline *Parametric building design*.
- **Palette** — the app's drawing-office greys and blueprint ink, unchanged.
- **Screenshots** — captured from the running app at a consistent window size,
  white mode for hero and feature shots, diagram mode where structure needs to
  read. Keep the source config JSON for every screenshot in the repo so any
  shot can be reproduced exactly rather than approximated.
- **Open Graph image** — 1200×630, the mark and the tagline over a render.

**The maintenance hazard:** screenshots go stale silently when the app's UI
changes. Every screenshot is dated in the repo, and a UI change in the app is
not finished until the shots that show it are retaken.

---

## 7. Technical requirements

### Budget

| | Target |
|---|---|
| Total page weight | Under 400 KB including images |
| HTML + CSS | Under 40 KB uncompressed |
| JavaScript | Under 6 KB, or none |
| Requests | Under 15 |
| Fonts loaded | Zero |

Targets, not measurements. Nothing goes on the page claiming a number until it
has been measured.

**The JavaScript target moved from 5 KB to 6 KB on 12 September 2026.** Fitting
the hero block's viewBox to each scheme — which recovered about 40% of the
panel that a short building left empty — took `block.js` to 5.4 KB. The
alternative was stripping the comments that explain why the rotation is
deterministic and why it stops under `prefers-reduced-motion`, which is a worse
trade for 300 bytes. §1's rule is unchanged and still holds: optional, tiny,
and the page complete without it. Uncompressed 5.4 KB is under 2 KB over the
wire.

### Non-negotiable

- **Works with JavaScript disabled.** Every word and link is in the HTML.
- **Accessible.** WCAG AA contrast, a visible focus ring, real landmarks, alt
  text that describes the drawing rather than naming the file, and
  `prefers-reduced-motion` respected — the app already honours it.
- **Responsive** from 320 px up, with no horizontal scroll at any width.
- **No layout shift.** Every image carries explicit dimensions.
- **Privacy by construction.** No cookies, no third-party requests, no
  fingerprinting. This is not a compliance exercise; it is the same claim the
  app makes, and the site would be lying if it broke it.

### SEO

A title and description per page, canonical URL, Open Graph and Twitter tags, a
`sitemap.xml`, a `robots.txt`, and `JSON-LD` describing a SoftwareApplication.
No keyword stuffing — the audience is small and specific.

---

## 8. Relationship to the app repo

| | App | Homepage |
|---|---|---|
| Repo | `barkx/BL0K` — one repo, two projects | same |
| Root directory | repo root | `homepage/` |
| Domain | `app.urbgen.com` | `urbgen.com` |
| Vercel project | its own | its own |
| Shared code | None | None |
| Shared assets | Mark, palette — copied, not imported | |

Nothing in `homepage/` imports from the app, and nothing in the app reaches into
`homepage/`. A homepage deploy cannot break the app, and an app deploy cannot
break the homepage.

**Two settings make that true rather than merely intended.** Each Vercel project
needs its **root directory** set — the repo root for the app, `homepage/` for
this — and an **ignored build step** so a push that touched only the other
project's files does not trigger a build. Without the second, every copy tweak
redeploys the app and every geometry change redeploys the homepage: harmless,
but it makes the deploy history useless for working out what broke.

**One repo means the boundary is a convention, not a sandbox.** A separate repo
would have made it impossible for work on the homepage to touch the app; sharing
one means it is merely disallowed. If an agent is ever pointed at this folder,
give it a `homepage/CLAUDE.md` of its own saying so in as many words.

**Facts about the app quoted on this page must be checked against the app's
`project.md` and `README.md`, not remembered.** The app changes faster than the
homepage will.

---

## 9. Milestones

### Next

**M1 — One page, live.** Hero through footer, real copy, placeholder imagery,
deployed to `urbgen.com` with `www` redirecting. Ships before the screenshots
are perfect; a live honest page beats a staged perfect one.

**M2 — Real imagery.** Screenshots captured from the app with their configs
committed, the Open Graph image, and the hero render.

**M3 — Polish.** Accessibility pass against the §7 list, budget measured
against the table, metadata and structured data complete.

Each milestone ends in something deployable. If one stops being deployable, it
is too big — split it.

---

## 10. Open questions

1. **Astro or stay static?** The trigger to reconsider is a second page that
   shares a header, or a changelog with more than a handful of entries. Not
   before.
2. **Analytics at all?** Nothing at launch. If the question becomes "is anyone
   using this", a cookieless first-party counter is the only acceptable answer,
   and the privacy claim in §5 has to be re-read before it goes in.
3. ~~**Does the roadmap appear publicly?**~~ **Answered 12 September 2026,
   revised 17 September:** the page states what IFC export carries today and
   what it does not, and promises nothing about the rest. §5
   forbids a roadmap stated as a promise, and "coming" commits a date this
   project does not have. Revisit only if a date becomes real.
4. **A licence, and is the app's source public?** The repo is currently private
   in effect; the footer cannot link to it until that is settled.
5. **A contact address — reopened, 12 September 2026.** Briefly answered with
   `archviz.one/contact/`, then reopened when the footer was cut back to
   portrait, name and social links. **There is now no contact route on the page
   except LinkedIn**, which is a way to reach a person but not an address. The
   `hello@urbgen.com` alias stays retired; whether an evaluating architect
   needs more than a LinkedIn profile is the open part.
6. ~~**Does the page mention who made it?**~~ **Answered twice, 12 September
   2026.** First unattributed, then reversed: the footer now carries the
   author's name, portrait and links, shared with archviz.one. Attribution to a
   named architect is the trust signal §3 asks for, and it costs nothing that
   has to be retracted.
7. **A gallery of schemes?** Persuasive, and the app can produce them — but
   every image is a maintenance cost, and any scheme shown must be one there is
   a right to show.
