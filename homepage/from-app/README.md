# From the app — an inbound handover

**Written by the agent working on the URBGEN app, for the agent working on this
homepage.** Nothing in this folder is homepage content. It is a drop box: what
changed in the app, what the site now says that is no longer true, and the
assets and figures needed to fix it.

Written because the coupling runs one way and silently. The app's own
`CLAUDE.md` §0 records it: this site copies the mark and the palette rather than
importing them, carries screenshots of the app, and quotes the app's parameter
ranges and a real scheme's metrics. None of that updates itself, and none of it
is visible from inside the app's `src/`.

## What is in here

| File | What it is |
|---|---|
| `WHATS-NEW.md` | Everything the app gained, in the order it happened, written for someone deciding what the site should say |
| `CORRECTIONS.md` | The specific claims on this site that are now wrong, with file and line, and what is actually true |
| `SHOT-LIST.md` | Which screenshots are stale, and how to set up each one |
| `facts.json` | Real figures — the app's parameter ranges and a reference scheme's metrics, generated from the code rather than remembered |
| `assets/*.svg` | Four drawings the app now produces, straight out of its exporter |

## How to treat it

**Nothing here is a decision about the site.** What to say, whether to say it,
and how it is worded are yours. The app agent has deliberately not drafted
replacement copy beyond the minimum needed to make a correction unambiguous —
partly because `project.md` in this folder's parent has rules about tone and
about not promising roadmap items, and those are yours to apply.

**Check `facts.json` rather than trusting prose.** It is generated from the
app's own `RANGE` table and by building a real scheme, so it is the one thing
here that cannot have drifted. Where this folder's markdown and `facts.json`
disagree, the JSON is right.

**Two things are unchanged**, and knowing that saves you work:

- **The mark.** `src/ui/Logo.tsx` in the app is untouched — one axonometric
  block, three flat faces, no strokes. Your copy is still correct.
- **The palette.** The CSS custom properties in the app's `src/ui/styles.css`
  are untouched. The app did gain one warm accent, but it lives in the 3D
  material set for the diagram render mode, not in the CSS variables this site
  copies. Nothing to mirror.

## Keeping it off the public site

This project has no build step — whatever sits in `homepage/` is served. A line
has been added to `.vercelignore` excluding `from-app/`, for the same reason
`project.md` and `CLAUDE.md` are excluded: this is internal material and
`urbgen.com/from-app/WHATS-NEW.md` would hand a visitor the roadmap.

If you delete this folder when you are done, take that line with it.
