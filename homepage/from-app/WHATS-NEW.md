# What is new in the app

In the order it was built. Figures here are real; cross-check any you publish
against `facts.json`, which is generated rather than written.

---

## IFC export exists now — partly

**This is the biggest change, and the one the site currently contradicts.**

The app writes **IFC4 Reference View** files, by hand, with no library. What is
in them today:

- A project, a site, a building per block placed and rotated as on the plot
- A storey per level
- Floor and roof slabs, and exterior walls
- **Every window as a real `IfcOpeningElement` with an `IfcWindow` filling it** —
  the receiving application cuts the hole itself, rather than being handed a
  wall with a hole already faked in it
- **Balconies**: a projecting balcony as a deck and a guard; a loggia as the
  recess voided out of the facade wall, with a back wall and two returns
  enclosing it, so the building reads as enclosed rather than open to the
  weather at every loggia
- Georeferencing: latitude, longitude and true north, so the model lands where
  it belongs rather than at the receiving application's origin

What is **not** in them yet: cores, the plot boundary, property sets carrying
the metrics, and a massing-versus-full detail switch for file size.

Two properties worth knowing, because they are the kind of thing a sceptical
reader asks about:

- **GlobalIds are derived from the model, not generated fresh.** Export the same
  scheme twice and you get the same file; re-export after a reload and elements
  update downstream instead of being replaced. Renaming a building does not
  reissue every element's identity.
- **Wall and slab thickness are assumptions, and are stated as such** — the app
  models surfaces, not thicknesses. The figures are quoted in the app's own UI
  next to the export button.

"Valid file" and "opens cleanly in Revit" are different bars. The first is
checked; the second is checked only by importing, and has not been.

---

## Drawings — plans, elevations and sections

The app now produces **measured drawings as SVG**, written by hand like the CSV
and the IFC, so no dependency and it works offline.

| Drawing | Of | Shows |
|---|---|---|
| Site plan | the whole site | plot boundary, every footprint at ground, cores, names, north |
| Floor plan | one building, one level | the outline it occupies, cores still passing through, the module rhythm ticked on each exterior face |
| Elevation | one building, one face | silhouette run by run, floor lines, every opening, balconies — projecting solid, loggias dashed |
| Section | the whole site, one cut | every mass the line passes through, at its real height, with floor lines and the ground |

**The scale is real.** Sheets are sized in millimetres and drawn in millimetres,
so one metre is `1000 / scale` mm and printing at 100% gives a drawing you can
put a scale rule on. A scale bar rides along anyway, because the printed ratio
only holds if nobody resized the page. Line weights are fixed in millimetres, so
they read the same at 1:100 and at 1:1000.

Four real examples are in `assets/`. They are the exporter's actual output, not
mock-ups.

Two absences are deliberate and worth stating if the site describes this at all:

- **No rooms.** A plan here is a plan of the *massing* — outline, core, module
  rhythm, openings. Apartment layouts and corridors are not modelled, and the
  drawing does not put a line where a wall might one day go.
- **No imported map context.** OpenStreetMap surroundings are in the viewport to
  trace over and are excluded from every export. That is the ODbL licence as
  much as a design choice.

---

## Programme by floor

A floor can be given over to **retail, office or amenity** instead of housing.

- A band is a run of levels, so "retail at ground, housing above" is one entry
- A public floor takes its own shopfront glazing — low sill, wide opening, one
  per module — and never gets a balcony
- The module rhythm is unchanged, so a shop sits in the same grid as the flats
  above it, which is what stops a plinth reading as a different building
- Metrics report GFA per use, and **the unit estimate counts only residential
  floors**. Before this, a retail ground floor was silently counted as flats
- Diagram render mode tints a public floor in a warm accent so it reads at a
  glance

What it is **not**: the massing does not change. Floor height is uniform and the
footprint is the same on every level. This is a programme and a facade, not a
plinth with its own footprint.

---

## Unit mix

The unit count was one divisor over every module. It can now be a **target mix**:
a share per apartment type, and how many modules a flat of that type spans.

- Studio, 1 bed, 2 bed, 3 bed; a share of zero is a type the scheme does not have
- Shares need not add to 100 — they are normalised where they are spent
- The residential pool is filled one flat at a time, taking the type furthest
  below its target, so it can never claim more modules than the building has;
  the remainder is reported rather than hidden
- The panel shows the **achieved share beside the target**, because a mix with
  no target next to it is a number you cannot argue with
- Area per type is shared out in proportion to the modules each type took, not
  typed in per flat

Counts and areas only. Which flat sits in which bay is a floorplan, and remains
out of scope.

---

## Massing: per-wing depth, and a setback top

- **Each wing carries its own depth.** Previously one number for the whole
  building. Courtyard and stacked still have one, because they expose one wing.
- **The top floors can step in** from every face that is not a junction — a face
  shared with another wing never moves, or the joint would open a gap. Off by
  default; it is a choice in the Roof control, not a standing parameter. A
  courtyard steps back from its void as well as from the street.

---

## Freeform massing — draw the plan

Alongside the six presets (bar, L, T, U, courtyard, stacked) there is now a
**freeform** option: trace a centreline on the ground and the building follows
it, one bar per leg, **at any angle**.

Corners are mitred, so wings meet cleanly rather than overlapping. Area, roof,
core track, setback and the floor-plan drawing all read the real outline, so the
numbers hold at any angle.

**It is labelled experimental in the app**, and the site should not describe it
as settled. It is the newest way to shape a building and the least worn in.

---

## Undo

Ctrl+Z and Ctrl+Shift+Z, in every tab, fifty steps deep. A slider drag is one
step, not fifty.

---

## Design options

Several schemes in one session, from a menu in the top bar: switch between them,
duplicate one as a starting point for a variation, start an empty one, rename,
delete. Each option is a whole site with **its own undo**, and each row in the
menu carries a thumbnail taken from the live view, so two options seen one after
the other are photographed from the same camera and compare directly.

Saving writes every option, so a comparison survives the round trip.

**This is the first control in the top bar**, which was previously bare. If any
screenshot caption or copy describes the toolbar as empty, that is now wrong.

---

## Site rules: a setback per plot edge

The boundary setback could be one number for the whole plot. Each edge can now
carry its own, or follow the boundary-wide figure. **Zero on an edge is a real
answer** — a party boundary a building may sit right on — which is a different
thing from having said nothing about it.

A building short of several edges reports one breach, against the edge it falls
furthest short of, and the warning names that edge.

---

## What has **not** changed

- **The mark and the palette.** See `README.md` in this folder.
- **No account, no sign-up, no backend.** Still a static page.
- **Nothing the user draws is uploaded.** Still true — but see `CORRECTIONS.md`,
  because the blanket "nothing it does needs a server" is no longer accurate.
- **No AI.** There is none in the app and the branding must not imply otherwise.
- **The positioning.** Deliberately a simpler tool than Forma or Spacio; not
  chasing simulation breadth or generative layout.
