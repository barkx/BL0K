# What this site now says that is no longer true

Line numbers are from the files as they stood when this was written. Check the
text matches before editing — they will drift.

Ordered by how wrong each one is.

---

## 1. "There is no IFC export" — now materially untrue

The app exports IFC4. Not completely, but it exports. Three places say
otherwise, and one of them is the answer a search engine shows.

| Where | What it says |
|---|---|
| `index.html:81` | JSON-LD FAQ answer: *"There is no IFC export yet."* |
| `index.html:357–361` | A section headed **IFC export**: *"There is no IFC export today. Geometry comes out as glTF, which is a …"* |
| `index.html:393` | FAQ: *"There is no IFC export yet — it is the next thing being built."* |

`project.md:170` also records the claim as a deliberate decision — *"IFC export
stated as absent, in both §4.5 and the FAQ"* — and `project.md:337` repeats it.
Those need revising too, or the spec will keep re-justifying a statement the
app has outgrown.

**What is actually true:** storeys, floor and roof slabs, exterior walls, every
window as a real opening the receiving application cuts itself, balconies and
enclosed loggias, and georeferencing. Cores, the plot boundary, property sets
and a detail switch are not in it yet. It has not been tested by importing into
Revit or ArchiCAD.

**A note on how to word it.** `project.md:189` sets a rule — *"Roadmap as
promise. 'IFC export is coming' commits a date the project does not control"* —
and that rule still applies. The honest shape is to state what the file contains
today and what it does not, without a word about when the rest arrives. The
`index.html:357` section is currently built around an absence; it probably wants
rewriting around a partial presence rather than patching.

---

## 2. "Nothing it does needs a server" — needs one qualification

| Where | What it says |
|---|---|
| `index.html:392` | FAQ: *"the app keeps working with the network gone, because nothing it does needs a server."* |
| `index.html:70` | The same question in JSON-LD |
| `index.html:142` | *"Nothing is uploaded, and it keeps working offline once loaded."* |

Since the app gained locations and map context, **two things do reach the
network**, both only on an explicit press:

- searching for a place, which uses Nominatim
- importing surroundings to trace over, which uses OpenStreetMap's Overpass

Neither needs an account or a key. **Nothing the user draws is uploaded** — a
bounding box goes out, and that is all. Everything else in the app still works
with the connection unplugged, including every export.

So `index.html:142` is still true as written. The FAQ's *"nothing it does needs
a server"* is the phrase that has become false, and the fix is a qualification
rather than a retraction. The privacy claim is not weakened by saying so, and is
weakened by being caught overstating.

---

## 3. The feature list has no idea about seven new things

Nothing on the site mentions: programme by floor, the unit mix, measured
drawings, freeform massing, undo, design options, or per-edge setbacks. See
`WHATS-NEW.md`.

Two are worth weighing for the front of the site rather than a list, because
they change what the tool *is* rather than adding to it:

- **Measured drawings.** The site currently describes exports as glTF, CSV and
  JSON — geometry, numbers, and the scheme itself. Drawings at true scale are a
  different kind of output, and are the one most likely to matter to somebody
  deciding whether this is a toy.
- **Design options.** The positioning has always been about comparing schemes.
  Until now the app held one at a time.

---

## 4. Quoted figures and ranges

`project.md` records that this site quotes the app's parameter ranges and a real
scheme's metrics. Check every number against `facts.json`, which was generated
from the app rather than remembered.

Specifically likely to be stale:

- Anything describing **building depth** as one value for the whole building —
  wings B and C can now carry their own
- Any list of **presets** — there is a seventh, `Freeform`, though it is
  experimental and may not belong in a public list at all
- Any list of **exports** — SVG drawings are new, and IFC is no longer absent

---

## 5. Screenshots

Every screenshot on the site predates two new tabs and the top-bar control. See
`SHOT-LIST.md`.
