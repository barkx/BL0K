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
| Total page weight | under 400 KB | 93 KB |
| HTML + CSS | under 40 KB | 28 KB |
| JavaScript | under 5 KB | 4.7 KB |
| Requests | under 15 | 10, all same-origin |
| Fonts loaded | zero | zero |

The hero drawing is 25 KB of that and the facade elevation 19 KB — both are
SVG, and both get replaced at M2 by images that will almost certainly weigh
more. There is room, though `block.js` leaves only 400 bytes of the JavaScript
budget: anything more than a tweak there needs the budget revisited rather than
quietly exceeded.

---

## Chapter 2 — publishing it

### Where things stood before the split

`urbgen.com` is already delegated to Vercel's own nameservers
(`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), so there is no registrar work to
do — every record is managed inside Vercel. The **app** project was linked
first and took all three hostnames with it:

| | Before | After |
|---|---|---|
| `urbgen.com` | app, redirecting to `www` | **homepage** |
| `www.urbgen.com` | app | **homepage**, redirecting to the apex |
| `app.urbgen.com` | app | app, unchanged |

Note the redirect ran the wrong way round: `project.md` §1 wants `www`
redirecting *to* the apex, and it was the apex redirecting to `www`. Moving the
domain is also the moment that gets fixed.

### The two settings that keep the projects apart

1. **Root directory** — `homepage/` for this project, the repo root for the
   app. A dashboard setting; there is no file that can express it.
2. **Ignored build step** — so a push that touched only one project does not
   redeploy the other. Both `vercel.json` files now carry an `ignoreCommand`:

   | Project | Command |
   |---|---|
   | homepage | `git diff --quiet HEAD^ HEAD -- .` |
   | app | `git diff --quiet HEAD^ HEAD -- . ':(exclude)homepage'` |

   The homepage's is relative because Vercel runs it from the root directory,
   which for this project is `homepage/`. Exit 0 means *skip the build*, which
   is what `git diff --quiet` returns when nothing changed. On a first
   deployment `HEAD^` may not exist; git then errors, the exit code is
   non-zero, and the build runs — which is the safe way round.

### Moving the domains

A domain belongs to exactly one Vercel project at a time, so the apex has to
leave the app project before it can join this one. In order:

1. Create the second project from the same repo (`barkx/BL0K`), root directory
   `homepage/`, framework preset **Other**, build command empty.
2. On the **app** project → Settings → Domains, remove `urbgen.com` and
   `www.urbgen.com`. Leave `app.urbgen.com` alone.
3. On the **homepage** project → Settings → Domains, add `urbgen.com`, then add
   `www.urbgen.com` and set it to redirect to `urbgen.com` (307).
4. Redeploy both once, since neither will have rebuilt under the new settings.

### What is served

There is no build, so the contents of `homepage/` are the site — which is why
[`.vercelignore`](.vercelignore) exists. Without it `project.md`, this file and
`CLAUDE.md` would all be readable at `urbgen.com/…`. It is worth confirming
rather than assuming:

```bash
curl -sI https://urbgen.com/project.md | head -1   # expect 404
curl -sI https://urbgen.com/ | head -1             # expect 200
curl -sI https://www.urbgen.com/ | head -1         # expect 307 to the apex
```

`vercel.json` here also sets `cleanUrls`, a week of caching on `/assets/`, and
three response headers that cost nothing (`nosniff`, `no-referrer`, a
`Permissions-Policy` that turns off what the page never uses).

Deploys happen on push to `main`, the same as the app.

### Why not `urbgen.com/app`

It was considered and it is the worse option. `app.urbgen.com` is what
`project.md` §1 and §8 lock in, it already works, and a path would cost:

- A `base: '/app/'` in the app's `vite.config.ts`, because its assets are
  root-relative today.
- A collision to manage — both projects serve `/assets/`.
- A cross-project rewrite, so every app request would proxy through the
  homepage project. That is a hop, and a way for a homepage deploy to break the
  app — the exact coupling §8 exists to prevent.

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

**The hero is not a still.** §4.1 asks for a still of the app beside the
headline. It is instead a drawn block that rebuilds itself every few seconds
through four schemes — courtyard, L, U and bar — captioning the parameters it
is showing. A page whose first claim is "change a slider and it rebuilds" is
more convincing if something on it visibly rebuilds. It does not rotate under
`prefers-reduced-motion`, and it does not redraw in a backgrounded tab.

**There is JavaScript now: `block.js`, 4.7 KB.** §1 allows "optional and tiny"
and §7 caps it at 5 KB, so this is within the budget rather than against it —
but it was previously none, which is worth recording. The page stays complete
without it: the controls-free markup ships a static drawing, and the script
replaces it only once it runs.

**The font question is still open.** The typography is the largest remaining
cause of the page looking generic, and the fix — a self-hosted variable font —
conflicts with §1's "system font stack" while not breaking the privacy claim,
since self-hosting makes no third-party request. Nothing has been decided, so
the page still uses the system stack and loads no font at all.

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
├── block.js                      the rotating hero block, 4.7 KB, no deps
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
