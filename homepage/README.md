# URBGEN homepage

The marketing site at **urbgen.com**. One page. Hand-written HTML and CSS, no
build step, no framework, no JavaScript.

The spec is [`project.md`](project.md) and it is the authority; this file only
says how to run and publish the thing, and records where the page departs from
the spec.

---

## Chapter 1 — running it

There is nothing to install and nothing to compile. Open `index.html` in a
browser and that is the site.

The one caveat is that every path in the page is root-relative (`/styles.css`,
`/assets/hero.svg`), because that is what they will be in production. Opening
the file directly with `file://` therefore loads no CSS. Serve the folder
instead:

```bash
npx serve homepage
```

Any static server will do — `python -m http.server` from inside `homepage/`
works just as well. There is no dev server, no watch mode and no reload; edit a
file and refresh.

### Illustrations

The six drawings in `assets/` are **placeholders**, generated rather than
captured, and M2 replaces them with screenshots of the real app. Redraw them
with:

```bash
node homepage/tools/build-illustrations.mjs
```

No dependencies — plain Node, writing SVG. Palette values are copied from the
app's `src/ui/styles.css`; if the brand changes, they change here by hand.

### Checking it before it ships

There is no test runner and nothing to typecheck. What is worth doing by hand:

- Load it with JavaScript disabled. Nothing should change.
- Narrow the window to 320 px. Nothing should scroll sideways.
- Tab through it. Every link should show a focus ring, and the first stop
  should be *Skip to content*.
- Open the network panel. It should show this origin only, and no cookies.

### Budget, as measured

Against the targets in `project.md` §7. Uncompressed bytes on disk, counted on
12 September 2026 — recount after any change to the assets, and do not quote
these in the page itself.

| | Target | Measured |
|---|---|---|
| Total page weight | under 400 KB | 84 KB |
| HTML + CSS | under 40 KB | 23 KB |
| JavaScript | under 5 KB | 0 |
| Requests | under 15 | 9, all same-origin |
| Fonts loaded | zero | zero |

The hero drawing is 25 KB of that and the facade elevation 19 KB — both are
SVG, and both get replaced at M2 by images that will almost certainly weigh
more. There is room.

---

## Chapter 2 — publishing it

The homepage is its **own Vercel project**, in the same repo as the app. Two
settings keep the two apart, and both are dashboard settings rather than
anything in a file:

1. **Root directory** — `homepage/` for this project, the repo root for the app.
2. **Ignored build step** — so a push that touched only the app does not
   redeploy the homepage. This project's `vercel.json` carries
   `ignoreCommand`, which skips the build when nothing under `homepage/`
   changed. **The app's own `vercel.json` needs the mirror of it**
   (`git diff --quiet HEAD^ HEAD -- . ':(exclude)homepage'`) or every copy
   tweak here will rebuild the app. That change has not been made — it is a
   change to the app's config, which belongs to the app.

Then the domain: `urbgen.com` on this project, with `www.urbgen.com` added and
set to redirect to the apex. Vercel does the redirect at the domain level, so
it is not in `vercel.json` either.

`vercel.json` here also sets `cleanUrls`, a week of caching on `/assets/`, and
three response headers that cost nothing (`nosniff`, `no-referrer`, a
`Permissions-Policy` that turns off what the page never uses).

Deploys happen on push to `main`, the same as the app.

---

## Deviations

Departures from [`project.md`](project.md), with the reason. Spec §6 requires
them to be written down here.

**Illustrations are SVG drawings, not `.webp` screenshots.** §1 says images are
self-hosted `.webp` with a raster fallback. At M1 there are no screenshots yet,
and a grey box saying "screenshot pending" is worse than a drawing that
explains the same idea. They are SVG because six drawings come to about 60 KB
that way and stay sharp at any width. M2 replaces them with `.webp` captures
and this deviation goes away.

**No Open Graph image.** §7 asks for one and §6 specifies it at 1200×630. It
needs a render that does not exist until M2. A tag pointing at a missing file
is worse than no tag, so `og:image` is absent and `twitter:card` is `summary`
rather than `summary_large_image`. There is a `TODO M2` on the line in
`index.html`.

**The footer does not link to the repo.** §4 lists a repo link in the footer.
Open question §10.4 — whether the app's source is public, and under what
licence — is unsettled, and the repo is private in effect, so the link would
404 for everyone who clicked it.

**Contact is `hello@urbgen.com`.** Answering §10.5 with a role alias on the
site's own domain rather than a person. **The mailbox has to exist before the
page goes live**, or the footer is a dead end.

**The page is unattributed.** §10.6 asked whether it says which practice made
it. It does not, for now. Nothing in the copy has to be retracted to add it
later.

**JavaScript: none at all.** §1 allows up to 5 KB. The FAQ uses
`<details>`/`<summary>`, so there is nothing left for a script to do.

**There is a tenth section.** §4 lists nine, hero through footer. A short
closing block repeats the *Open the app* button after the FAQ, because by then
the reader has scrolled past the only other one and the page's primary job is
that click. It carries no claim of its own, and it is below the fold, so the
hero button is still the only primary action above it.

---

## What is here

```
homepage/
├── index.html                    the page, top to bottom
├── styles.css                    one stylesheet, no preprocessor
├── favicon.svg                   copied from the app's public/
├── robots.txt
├── sitemap.xml                   one URL; update lastmod when the copy changes
├── vercel.json                   no build; headers, cleanUrls, ignored build step
├── project.md                    the spec, and the authority
├── CLAUDE.md                     the boundary, for agents pointed at this folder
├── assets/                       six placeholder drawings (M1)
└── tools/
    └── build-illustrations.mjs   redraws assets/ — goes away at M2
```
