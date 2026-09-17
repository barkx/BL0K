# Screenshots

Every current screenshot predates two tabs and the top bar's first control, so
all of them show a sidebar that no longer exists.

## What changed in the frame

**The sidebar rail went from six icons to eight.** In order:

> Site · Placement · Massing · **Program** · Facade · Units · **Drawings** · Settings

`Program` sits between Massing and Facade because that is the order the
decisions happen in: floors have to exist before they can be zoned, and a floor
has to know what it is before it can be clothed.

**The top bar now carries a control.** On the right: a design-option button
reading `Option A ▾`. It was previously empty apart from the mark and the
sidebar toggle. Any caption describing a bare toolbar is now wrong.

## Retaking the existing five

`tools/capture-screenshots.mjs` drives the running app and clicks tabs by their
visible text. It clicks `Massing`, `Facade` and `Site`, all of which still
exist, so **it should still run unchanged** — the shots will simply come out
with the new rail and top bar.

That is the minimum: run it, and `shot-hero`, `shot-site`, `shot-massing`,
`shot-facade`, `shot-metrics` and their crops are correct again.

## Worth adding

The capture tool takes a tab name and a filename, so each of these is one more
entry in the same list. Setting up state beyond opening a tab is not something
the tool does today, so the ones that need a building configured are noted.

| Shot | Tab | Setup |
|---|---|---|
| Programme | `Program` | Select a building, then **Add a band** — it defaults to a retail ground floor. Switch the render mode to **Diagram** in Settings to show the warm tint on the ground floor, which is the clearest single image of the feature |
| Unit mix | `Units` | Select a building. Type shares into 1 bed / 2 bed / 3 bed — 30 / 45 / 25 gives a full "What fits" table with achieved-against-target |
| Drawings | `Drawings` | Opens on **Site plan** with a live preview. **Section** is the more distinctive image — pick it, and the preview shows the cut |
| Design options | any | Click `Option A ▾`, then **Duplicate this one**. Change the floor count, switch back, and open the menu: both rows then carry thumbnails from the same view. Needs the menu open when the shot fires |

## If you would rather not screenshot the drawings

`assets/` holds four real SVGs from the app's exporter — site plan, floor plan,
elevation and section. They are vector, they scale, and they are what the app
actually produces. A screenshot of a preview pane is a picture of a picture.

The site already ships hand-drawn SVG illustrations (`massing.svg`,
`facade.svg`, `site.svg`, `metrics.svg`), so real drawings may sit more
comfortably beside those than among the screenshots. That is your call — the
files are here either way.
