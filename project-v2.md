# Urbanism builder — v2 scope

v1 built a **building** builder. v2 makes it a **site** builder: a plot with
several buildings placed on it.

`project.md` stays the spec of record for the building itself, and its §1
non-goals still hold *for a single building*. This file records what v2 opens
up. Edit it freely — unlike `project.md`, it is a working doc.

---

## 1. Decisions taken

| Area | Decision |
|---|---|
| Location import | **Image underlay** + set scale by two points (done), and **DXF** from CAD (M11) |
| Not importing | Live map tiles (needs a runtime API key), GeoJSON for now |
| 3D context | **Flat plot only.** No terrain, no neighbour volumes yet |
| Plot | A plan polygon, drawn and edited on the ground. Concave allowed |
| Buildings | Many per site, each with its own full parameter set |
| Rotation | Free about Y, not snapped to 90° |
| Site area | Comes from the plot polygon. The old `siteArea` param is gone |
| Render mode | A view setting on the store, not a per-building parameter |

### The architectural constraint that made this cheap

`buildBuilding()` generates in the building's **own local frame** and every
geometry builder relies on masses being axis-aligned there. That assumption
holds *inside* a building, so placement lives one level up: a `Placement` is
`{ params, position, rotation }`, and the transform is applied at the scene
level.

Nothing in `geometry/` changed to support the site. Junction detection, the
facade, the roof and the per-building metrics all still work on axis-aligned
masses. **Keep it that way** — if a future feature wants to rotate masses
within a building, it needs its own answer, not a change to this contract.

### Non-goals for v2

- Terrain, cut and fill, sloped ground.
- Neighbouring building volumes as context.
- Shadow or right-to-light studies between buildings.
- Roads, parking, landscape, servicing.
- Per-building unit mix beyond the existing `modulesPerUnit` estimate.

Deferred, not rejected.

---

## 2. Data model

```
Site
 ├── plot: Vec2[]              // plan polygon, metres, site coordinates
 └── buildings: Placement[]
      ├── id, name
      ├── position { x, z }    // where the building's local origin sits
      ├── rotation             // degrees about Y, free
      ├── raw: Params          // what the sliders hold
      └── params: Params       // what the geometry was built from
```

- `src/site/types.ts` — the model and its defaults
- `src/site/build.ts` — derives every building, then the site numbers
- `src/site/metrics.ts` — site totals, clash and off-plot detection
- `src/lib/poly.ts` — plan polygon maths: area, centroid, point-in-polygon,
  separating-axis overlap

### Rebuild strategy

`buildSite` reuses the buffers of any building whose resolved `params` object
is unchanged, compared by identity. So moving or rotating a block rebuilds
nothing — placement changes cost only the site metrics pass, measured at
0.2 ms for two buildings. Only an edited building regenerates.

### Site metrics

GFA, units, facade and balcony area are sums. The ones that need the plot:

- **Coverage** — summed level-0 footprints over plot area.
- **Plot ratio (FAR)** — GFA over plot area.

Both assume buildings do not overlap, so overlap is *detected* rather than
silently absorbed: footprint quads are tested pairwise with a separating-axis
test (exact for the rotated rectangles a placed building produces, unlike an
AABB test), and clashes are named in the UI. Buildings not wholly inside the
plot are flagged the same way.

---

## 3. Milestones

**M8 — Site and multiple buildings. Done.**
Site model, placement with free rotation, select / add / duplicate / remove /
rename, drag a building across the ground, plot rectangle, site metrics with
clash and off-plot warnings, config v3 with migration from the single-building
format, whole-site glTF export.

**M9 — Draw the plot. Done.**
Trace a boundary by clicking corners on the ground, close it on the first
corner or with Enter, and edit it afterwards: drag a corner, click a midpoint
handle to add one, right-click a corner to remove one. The width/depth control
became "reset to rectangle". Area, coverage, plot ratio and off-plot detection
all follow the polygon, concave included.

A self-intersecting boundary is detected and flagged, because shoelace area
cancels the lobes on one — coverage and plot ratio would otherwise report
confident nonsense.

Handles size themselves per frame from the camera distance so they stay
clickable at any zoom, and they respect depth: drawing them over the buildings
would look better, but raycasting still puts the building first, so a handle
that appeared to be in front would refuse to be clicked.

**M10 — Image underlay. Done.**
Drop a map screenshot or site plan anywhere on the viewport, or choose one.
Set its true scale by clicking two points whose real distance you know and
typing that distance; the image rescales about the midpoint of those two
points, so whatever you measured stays where you put it. Then position,
rotate, fade, lock and trace the plot over it. No dependencies, no keys,
works offline.

The image is carried in the site config as a data URL, so a saved scheme
travels whole. That makes size a real concern, so anything over 2048 px is
downscaled and re-encoded before it is stored — PNG first, since linework and
map text survive it far better than JPEG, with JPEG as the fallback only when
the PNG comes out over 6 MB.

The plot fill steps aside whenever an underlay is showing, and the image is
inert while you are tracing or calibrating so it can never swallow a ground
click.

**M11 — DXF import.** Plot boundary and context linework from CAD. Needs a DXF
parser — the first real new dependency, so it wants a decision on which.

Each milestone should end in something demoable, as in v1.

---

## 4. Open questions

1. **Setbacks.** Worth a minimum distance to the plot boundary and between
   buildings, checked like clashes are? Planners ask for it.
2. **Snapping.** Should dragging snap to a grid, to the plot edge, or to
   another building's face? Corners and buildings both drag freely today.
3. **Plot subdivision.** One plot, or several with their own coverage limits?
4. **Building height limit.** A per-site cap that flags buildings exceeding it?
5. **Shared parameters.** If ten buildings should share a facade spec, does
   that want a template, or is duplicate-then-edit enough?
6. **DXF layers.** Which layer names carry the boundary, and does the importer
   ask or guess?
