# ADR-206: Prints, exports and seller matching

- Status: Implemented
- Date: 2026-11-06
- Implemented: 2026-11-06
- Depends on: ADR-048, ADR-121, ADR-161, ADR-166, ADR-172, ADR-174
- Design: docs/ui-design.md (§3 Button, Dialog; §4 Build & Preview results, the 3D view)
- Backlog: N211
- Acceptance: browser

## Context

User (2026-11-06): "in groups of 7-10 gaps create adrs, no implementation". This ADR takes over eight gaps on
prints, exports and seller data. Their requests: G-020 "To sell designed kitchens"; G-021 high-quality renders
(context, not a quote); G-343 "Ordered step list + 3D highlight"; G-001 "Render the furniture according to the
selected material's color and structure"; G-316 "You didnt use the image i provided to render"; G-314 "Match
products to parts in app"; G-340 "You upload a new export; the workflow converts it"; G-324 "Formulas too".
User accepted the gaps' suggested picks on 2026-11-06.

Change control: [ADR-048](../adr-done/ADR-048-a-material-can-show-any-picture-from-the-user-s-device-the-p.md) says
"The front-view SVG download uses plain colours (`data-plain`), because picture URLs exist only in the app." The
accepted G-001 pick replaces that sentence for the SVG download only: the picture travels inside the file. ADR-048's
average colour for catalog pictures and cut sheets stays (G-413). The project document gains one field (ADR-011).

## Decision

1. **Client sheet (G-020, part).** Output → **Client sheet** prints one A4 page (ADR-020 print flow): the piece or
   project name and date, one picture, the piece list (name, W × H × D mm, quantity) and the estimate total (ADR-062;
   seller prices name seller and export date, ADR-161/172). Lines without a price are counted, never hidden.
   Picture: the last PNG the Render dialog made this session (ADR-068), else a still of the open 3D view, else the
   front view. `pt()` entries: 'Fișă pentru client' (ru 'Лист для клиента', en 'Client sheet'), 'Preț estimat'
   (ru 'Ориентировочная цена', en 'Estimated price'), 'linii fără preț' (ru 'строк без цены', en 'lines without a
   price').
2. **Step pictures in the assembly print (G-343).** The Assembly tab's print, with the 3D view open, steps through
   every step with Show step and Exploded 3D, renders once per step on demand (ADR-121 `invalidate()`), keeps each
   canvas as a PNG and prints it beside its step; the view then returns to its state. Without the 3D view the sheet
   keeps the front view and says so: `pt()` 'Imaginile pașilor cer vizualizarea 3D' (ru 'Для картинок шагов нужен
   3D-вид', en 'Step pictures need the 3D view'). The guidance line stays (ADR-174).
3. **Export scene (.glb) (G-021).** The 3D toolbar's ⋯ beside Render gets **Export scene (.glb)**: three's own
   `GLTFExporter` (part of `three`, MIT, no new dependency), loaded dynamically, binary, with materials and board
   pictures embedded, no highlights; downloads `<name>-scene.glb`. Reads the scene only (ADR-014, ADR-002). `t()`
   entry 'Export scene (.glb)' with its Russian line.
4. **Board pictures on fronts and in the SVG (G-001, part).** With fronts shown, door and drawer fronts in the front
   view fill with their board's picture pattern (as carcass panels do), dashed outline kept. **Front view drawing**
   embeds each used pattern's picture as a JPEG data URL from the stored image; a picture not loaded falls back to
   `data-plain`.
5. **Seller boards seen in 3D (G-316).** Claude opens at least five Regency boards with shipped pictures in 3D on
   the production build at 390 and 1280 px and records screenshots and the verdict in the backlog row. If the decor
   reads too large or small, picked seller pictures get their own default tile (`defaultTile`, `src/core/surface.ts`)
   from the product's stated sheet width; the user's own tile edits still win.
6. **Fasteners and run parts matched (G-314).** Shopping list → **Product** on each fastener line (saved in
   `Design.hardwareProducts` under `fs:<joint>`, same shape, no design version change) and on each run part line
   (plinth, filler, cover, trim, worktop). Run part links live in `Project.runProducts` (run part key →
   `HardwareProduct`), from the next free project `schemaVersion` (21 at writing); older versions still load (ADR-011).
   A linked run part is priced by its product when the unit fits (piece or m), else by its board as today.
7. **Price change summary (G-340).** `tools/sellers/price-changes.mjs <previous> <new>` writes Markdown: counts of
   changed prices, new and dropped products, then up to 50 changed lines (old → new, %), "… and N more". The Seller
   prices workflow puts it into the pull request body. Workflow only; the app makes no request.
8. **Formula functions (G-324).** Formulas accept `min(a, b, …)`, `max(a, b, …)`, `floor(x)`, `ceil(x)`,
   `round(x)`. A name followed by `(` is a call; those five names become reserved for new variables, and an existing
   variable with one of them still reads as a variable. Wrong argument counts are diagnostics (ADR-008). Formulas are
   stored text, so the document shape is unchanged; an older app shows a syntax diagnostic and keeps the last numbers.

Every new UI text goes through `t()` with its Russian entry; the feature tree gains "Client sheet", "Export scene
(.glb)" and "Formula functions" (ADR-158).

## Alternatives considered

- **Client sheet as a .zip** like the review pack (ADR-121) — the pick asked for one printable page.
- **An offscreen renderer for step pictures** — a second WebGL context the viewer rules do not cover (ADR-014).
- **Store fastener links on the device's fastener list** — they would not travel with the design file.

## Scope

- In scope: items 1–8 above, tests, `tools/prints-exports/find-it.mjs` on the production build.
- Out of scope: worktop edge profiles and bundled CC0 appliance models (G-412); board pictures in the plan, catalog
  pictures and cut sheets (G-413); conditions and stepped rounding in formulas (G-414).

## Consequences

- Positive: a client page to sell from, a scene for Blender, more parts priced from seller data.
- Negative / risks: SVG downloads grow by their pictures; per-step rendering is slow on a phone.
- Harder to change later: the reserved function names and the project's `runProducts` field.

## Done when

- [x] The client sheet shows picture, piece list, total and the count of unpriced lines in ro, ru and en (tests)
- [x] The assembly print has one picture per step with the 3D view open, and the fallback line without it (find-it)
- [x] Export scene (.glb) downloads a file starting with `glTF` with the panels' meshes, no request (find-it)
- [x] Fronts show their board picture; the SVG download embeds it; the G-316 check is recorded with screenshots
- [x] Fastener and run part products save, price and reload; project files of every older version still load (tests)
- [x] `price-changes.mjs` reports changed, new and dropped products on two sample catalogs (tests)
- [x] min, max, floor, ceil and round evaluate; bad argument counts and reserved names give diagnostics (tests)
- [x] Browser find-it at 390 and 1280 px finds Client sheet, Export scene (.glb) and Product on a run part line
