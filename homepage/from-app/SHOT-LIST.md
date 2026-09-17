# Interface snapshots

`assets/ui/` holds twelve PNGs — six shots, each as the full 1600×1000 window
and as a 1200×856 crop. `capture-ui.mjs` is how they were made, and re-running
it is the whole of a retake.

## First, a disagreement worth naming

This folder's `CLAUDE.md` §9 records a deliberate move **away** from app
screenshots and back to drawn figures: they carry the brand, they read at any
width where a 1600 px desktop UI does not, they cost a fraction of the bytes,
and they do not rot when the app's UI moves.

These were captured anyway, at the app user's explicit request. That does not
overturn §9 — **whether any of them belongs on the page is still yours to
decide.** They are here so the decision can be made by looking rather than
imagining, and so that whatever you do publish is current.

If §9 holds and the answer is "none of them", these are still the reference for
redrawing the figures, and the crops are still what a caption should describe.

## Why both a full frame and a crop

§8 records that a 1600 px window shown at ~560 px put the sidebar text at
3–4 px — texture, not information — and that the fix was cropping to rail,
panel, model and metrics. The crops here use the identical clip your own
capture script uses, `{ x: 0, y: 40, width: 1200, height: 856 }`, so a crop
should drop straight into the layout that already handles one.

## The six

| File | Shows |
|---|---|
| `ui-01-whole-app` | The whole interface. **The eight-icon rail** — Site, Placement, Massing, Program, Facade, Units, Drawings, Settings — and **the `Option A ▾` button in the top bar**, which was empty before. Also the per-edge setback rows under the boundary setback |
| `ui-02-programme-by-floor` | A retail ground floor, in diagram mode so the warm band reads at a glance. The metrics panel carries `Retail 1 040 m² of GFA`, and the unit count has dropped to 196 because a shopfront is no longer counted as flats |
| `ui-03-unit-mix` | A 30 / 45 / 25 target and the **What fits** table beneath it — achieved share against target, and an average area per type |
| `ui-04-drawings-section` | The Drawings tab with **Section** selected and a live preview. The preview is the exported SVG itself, not a second renderer |
| `ui-05-design-options` | The option menu open with two options, **each row carrying a thumbnail from the same camera**. Option B is the 20-storey variant. Four features visible at once: options, thumbnails, the programme row and the unit-mix rows in the metrics panel |
| `ui-06-freeform-massing` | A drawn centreline turned into a building whose wings meet at an angle, with the Freeform control under its **Experimental** label and the panel text that goes with it |

## Re-taking them

```bash
npm run dev                                   # in the app, from the repo root
node from-app/capture-ui.mjs assets/ui 5173   # from homepage/
```

It spawns its own headless Chrome with software GL and drives the app over the
DevTools Protocol — the same technique as `tools/capture-screenshots.mjs`, and
with no dependency, for the same reason. Your tool is untouched; this is a
separate script so the two cannot interfere.

Headless is not a workaround. R3F will not size or render its canvas while the
document is hidden, so a backgrounded window comes out blank.

## Your existing five

`tools/capture-screenshots.mjs` clicks tabs by visible text — `Massing`,
`Facade`, `Site` — all of which still exist, so **it should run unchanged**.
The shots will simply come out with the new rail and the top-bar control. That
is the minimum retake, and it is one command.
