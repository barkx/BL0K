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

One page, in this order. Each section carries exactly one claim.

1. **Hero.** Mark, name, tagline, one sentence, one button: *Open the app*. A
   still of the app behind or beside it, white mode, showing a courtyard block
   on a drawn plot. The button goes to `app.urbgen.com` and is the only primary
   action above the fold.
2. **What it does.** Three or four blocks, each an image and two sentences:
   massing presets; a module-driven facade with real openings; the site — plot,
   many buildings, rules and metrics. Images do the work; prose stays short.
3. **The facade, in detail.** The one capability worth its own section, because
   it is the thing rivals do not have. Reveals, jambs, loggia cheeks and
   soffits, per-elevation overrides, a module rhythm that always divides evenly.
   A close-up render earns its place here.
4. **Metrics that show their working.** GFA corrected for the overlap where two
   wings meet; NIA with the core measured off the geometry rather than guessed;
   clash and off-plot detection; planning rules checked and reported with both
   numbers. Screenshot of the metrics panel.
5. **Why it is different.** Four short claims, no comparison table naming
   competitors: facade depth, determinism, no account and no cloud, metrics you
   can audit. Naming rivals invites a fight the page cannot win and dates badly.
6. **What it does not do.** Plainly, as a list. No IFC export yet. No floorplans
   or circulation. No environmental simulation. Flat ground only. No
   collaboration. The unit figure is an estimate. This section is not an
   apology — it is the reason the rest is believable.
7. **How it works.** Three steps: draw or trace a plot, place and shape
   buildings, export. One line each.
8. **FAQ.** Six or so, answering the questions the positioning actually
   provokes: Do I need an account? Where does my data go? Does it work offline?
   What can I export? Is it really free? Is there AI in it?
9. **Footer.** Link to the app, link to the repo, a contact address, the year.

Section 6 goes *before* the FAQ and after the strongest claim, deliberately. It
is the pivot the whole page turns on.

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
| JavaScript | Under 5 KB, or none |
| Requests | Under 15 |
| Fonts loaded | Zero |

Targets, not measurements. Nothing goes on the page claiming a number until it
has been measured.

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
3. ~~**Does the roadmap appear publicly?**~~ **Answered, 12 September 2026:**
   the page states that IFC export does not exist and promises nothing. §5
   forbids a roadmap stated as a promise, and "coming" commits a date this
   project does not have. Revisit only if a date becomes real.
4. **A licence, and is the app's source public?** The repo is currently private
   in effect; the footer cannot link to it until that is settled.
5. **A contact address.** A person, a role alias, or a form? A form needs a
   backend, which §1 rules out — so an address, and which one.
6. ~~**Does the page mention it is by a practice?**~~ **Answered, 12 September
   2026:** unattributed for now. Nothing in the copy has to be retracted to add
   it later.
7. **A gallery of schemes?** Persuasive, and the app can produce them — but
   every image is a maintenance cost, and any scheme shown must be one there is
   a right to show.
