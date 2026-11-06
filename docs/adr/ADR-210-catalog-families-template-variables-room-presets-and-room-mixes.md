# ADR-210: Catalog families, template variables, room presets and room-mix filters

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-011, ADR-073, ADR-100, ADR-123, ADR-161, ADR-170, ADR-172, ADR-173, ADR-193, ADR-204
- Design: docs/ui-design.md (section 4, Screens: catalog, dialogs and wizards, Output)
- Backlog: N215

## Context

User (2026-11-06): "Do the same for next 50 gaps with no questions, …, no implementation yet. Exclude any Online
service or account sync ones." The user accepted the gaps' suggested picks; this ADR writes them. Requests (gap
Request fields): G-025 "The 14 features you selected at 21:28" (context, not a quote); G-103 "New adr 3"; G-335
variables "within the project" (not a quote); G-341 and G-342 "Fill the room"; G-044 "Mark 029 as won't do"; G-396 G-104's
"Offer repairs such as … 'Move the bed away'?" (not a quote); G-313 "Match products to parts in app". No pick
conflicts with an implemented ADR. G-044 stays offline:
[ADR-029](ADR-029-the-catalog-is-fed-by-a-scheduled-search-and-extract-job-wit.md) (the feed) stays won't do, and
the brand filter of [ADR-027](ADR-027-catalog-page-browse-furniture-by-category-brand-and-saved-on.md) (Deferred)
takes the user's decor list instead. Builds on pending
[ADR-193](ADR-193-fix-the-start-something-new-fill-a-wall-and-fill-the-room-fl.md) and
[ADR-204](ADR-204-complete-templates-and-the-fill-a-wall-and-fill-the-room-wizards.md) (Refine fields, compat
repairs) without repeating them.

## Decision

1. **Room presets (G-025).** `src/core/catalog/roomPresets.ts` builds three shipped `ProjectTemplate`s at runtime
   from shipped families' first insertable variant, in a 3600 × 3000 rectangle room (ADR-173's default): "Bedroom:
   bed, two nightstands and a wardrobe" (`bed`, `nightstand`, `wardrobe`), "Home office: desk and bookcase"
   (`desk`, `bookcase`), "Kitchen and desk" (Fill a wall's first mix for a 2400 mm stretch of wall 1, `desk` on wall
   3); backs to walls, kitchen and desk never touch. New… gets a **Room preset** row listing them; one runs
   `projectFromTemplate` (ADR-060), saves as ADR-193 item 7 and opens it. A preset with a variant not insertable is
   not listed.
2. **Family rule for your own templates (G-103).** `insertVariant` writes `origin.rooms` (the family's rooms) for
   an `own-…` family. `familyOf` falls back to `origin.rooms` when no shipped family matches, so `shared-room`
   refuses and warns for those pieces too. Design `schemaVersion` 10 (ADR-011): `origin.rooms` needs 10, known
   `Room` names only; 1–9 still load. Pieces inserted earlier stay unchecked (nothing rewritten).
3. **Variables in designs (G-335).** `Design.variables` and `Design.bindings` (same shapes and limits as ADR-166;
   targets width, height, depth, mountHeight and `split:*`, no positions), design `schemaVersion` 10. The stand-alone
   editor's Inspector gets the **Variables** section (`VariablesPanel` with a design scope) and `BindButton` on the
   size fields; `applyDesignBindings` runs on each commit; problems are diagnostics that block export (ADR-008).
   Catalog templates keep them (they embed the design). In a project they are the piece's parameters, evaluated
   with its own variables only; a project binding on the same target wins.
4. **Budget and style on room mixes (G-341, part).** Fill the room's Refine gets **Budget ceiling** (empty = none)
   and **Style** (Any, ADR-123's built-in styles and your styles). A style is applied to every piece of each mix
   (`applyStyle`, whole project) before checks. Each card shows its estimate (ADR-172 `estimate`, through a pure
   `projectEstimate` shared with the editor) and "{n} lines without a price" when any; mixes over the ceiling are
   dropped and Suggestions says "{n} mixes over the budget hidden"; none left: "No mix fits the budget; the cheapest
   is {total}." Ranking otherwise stays ADR-173's.
5. **Islands (G-342, part).** Refine gets **Add an island** and **Walkway width** (mm, required, no prefill: the
   user's size, ADR-010, ADR-073). Rectangle rooms only. The island is base cabinets only, parallel to the longest
   filled wall, fronts facing its run at the walkway's distance, length = that wall minus 2 × (depth + walkway) in
   50 mm steps, filled by `candidates()`; it needs the walkway behind it too. Opening clearances (ADR-057) check it
   like any piece. Errors (ADR-008): "Type the walkway width to place an island.", "The room is too small for an
   island with this walkway." Card summary line "Island: {summary}".
6. **Brands from your decor list (G-044).** Catalog → **Brands** shows a chip per manufacturer of the device's decor
   list (`listDecors()`, ADR-049; `other` rows by their written maker) with its count, beside any shipped brand
   entry. A chip lists that maker's decors (swatch, code, name, thickness, type) and the saved pieces with a board of
   that maker. Empty: "No brands yet. Import your decor list under Boards to see its manufacturers here."; a failed
   read: "The decor list could not be read on this device." (alert). This empty text replaces the one [ADR-202](ADR-202-fix-phone-layout-false-texts-translations-and-segmented-controls.md) writes for G-096 (built first), with its Russian entry. No request.
7. **Repair for the family warning (G-396).** `compat-family` joins `REPAIRABLE`: the later-placed piece (then the
   other) moves along its wall, left or right, to the nearest spot where it touches no piece side by side, overlaps
   none and stays in the room, labelled with the existing "Move {name} {mm} mm {side}"; previewed, one undo step
   (ADR-071); locked pieces never move (ADR-095).
8. **Project seller items (G-313).** `Project.sellerItems` (ADR-161 `SellerItem`) at project `schemaVersion` 22
   (ADR-205/206 take 21); template `sellerItems` at `TEMPLATE_SCHEMA` 4 (ADR-204 takes 3). In the project view **Add
   seller product** is enabled, hint "Any product of a seller, added to this project’s shopping list.";
   `projectSellerChoices` adds them once after the pieces' items. The old title and its Russian entry go.

Every new text uses `t()` with its Russian entry (`ru/catalog.ts` 1 and 6, `ru/variables.ts` 3, `ru/viewer.ts` 4–5,
`ru/sellers.ts` 8); feature tree lines "Room presets", "Variables in a piece", "Brands" and "Project seller items"
cite ADR-210 (ADR-158).

## Alternatives considered

- **Room presets as Fill the room types** — a bigger wizard change (G-446).
- **Look up own families in the template store (G-103)** — core reads no storage; a deleted template loses its rooms.
- **Design variables merged into project variables on insert (G-335)** — name clashes, and the piece loses them.
- **Island with a prefilled walkway** — an invented clearance (ADR-010).

## Scope

- In scope: items 1–8, tests, jsdom find-it tests `tests/find-it/room-presets.test.tsx` and `catalog-brands.test.tsx`.
- Out of scope: layout optimisation of room mixes (G-444); peninsulas and islands in L and U rooms (G-445); Fill
  the room for bedroom and office walls (G-446).

## Consequences

- Positive: multi-piece starts for other rooms; every catalog piece is family-checked; a decor list fills Brands.
- Negative / risks: three document versions go up; older apps refuse design 10, project 22 and template 4 files.
- Harder to change later: design-level variables and the project's `sellerItems`.

## Done when

- [ ] Each room preset builds with no error and no `compat-family` warning; kitchen and desk never touch (tests).
- [ ] A piece from an `own-…` family with rooms [bedroom] beside a kitchen base is refused and warned; design 1–9
      files load; `origin.rooms` below 10 or with an unknown room is refused (tests).
- [ ] A design variable bound to width drives the cut list; a bad formula blocks export; inside a project a project
      binding on that target wins (tests).
- [ ] Room fill: a ceiling hides costlier mixes with the count; a style changes every mix's fronts; island mixes
      keep the walkway; an empty walkway is an error (tests).
- [ ] The family warning offers move repairs that clear it in one undo step; a locked piece is not moved (tests).
- [ ] Project seller items save, reload, show on the shopping list and travel in templates; project 21 and template
      3 files load (tests).
- [ ] Find-it (390 and 1280 px): New… → Room preset → "Home office: desk and bookcase" opens a project with both;
      Catalog → Brands with a decor list → "Egger" lists its decors; Fill the room → Refine shows "Budget ceiling"
      and "Add an island".
- [ ] Russian entries for every new text, removed ones deleted; typecheck, lint, test, build and docs:check pass.
