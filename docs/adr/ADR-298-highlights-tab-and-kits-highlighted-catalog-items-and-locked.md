# ADR-298: Highlights tab and kits: highlighted catalog items and locked build templates

- Status: Pending
- Date: 2026-11-26
- Depends on: ADR-032, ADR-034, ADR-282, ADR-292
- Design: UX design pass 2026-11-26 (Project doc `claude/apl-highlights-templates-v2.md`)
- Backlog: N405
- Acceptance: full

## Context

The user (2026-11-26) asked to "introduce the 'Highlight' tab", that "Any catalog item can be marked as 'highlight'",
to "add the room divider under 'custom' room type", to mark it and "the staggered shelving as 'custom' and
highlighted", to "create 3 unique versions" of each, to "add at least one item which stands out from the rest, for all
types", and for build templates: "when we do it you get that prebuilt item, but your customisations are much more
limited". The Catalog's Source tabs are Templates, Saved and Brands (`src/ui/CatalogPage.tsx:95`), and "Templates"
already means catalog families, so a build template is called a **kit** in the UI. A kit's lock must survive a save
and a reload, so it lives in the design: a design document change (ADR-011).

## Decision

- Catalog data: `CatalogVariant.highlight?: true` and `CatalogVariant.kit?: true`; a new room `custom` ("Custom").
  The user's own templates (ADR-034) accept `highlight`; Edit template has **Highlight** per variant.
- Two families in room `custom`, function storage, every variant highlighted and a kit:
  **Room divider** (bookcase carcass, Open both sides, ADR-292, staggered rows, ADR-282): Low 1600×800×350 (2 rows),
  Tall 1200×2000×350 (6 rows), Wide 2400×1600×400 (5 rows, widths 300/400/500);
  **Staggered shelving** (back nailed on): Narrow tower 600×2000×300 (7 rows, 150/200/250), Wall 1800×1800×300
  (5 rows), Low bench shelf 1400×600×350 (2 rows, 250/350/450). Closed infill panels wait for ADR-293 (Pending).
- One stand-out per function group is highlighted: `tall-drawer-tower`, `media-wall`, `dining-h-stretcher`,
  `garden-bench-back`, `daybed-three-sided`.
- Catalog › **Highlights** (4th Source tab): highlighted versions grouped by function, kits first; each tile has the
  **Highlight** badge, a **Kit** badge on kits, and **Add kit** or **Open**. Empty state names Edit template.
- `CatalogMeta.kit?: { allow: ('size' | 'boards')[] }` (schemaVersion 12; 1 to 11 still load; `custom` in an
  origin's rooms needs 12). Inserting a kit variant sets it. While it is set, Compose and Settings show a banner
  ("Kit: <name>" over "Size and boards can be changed. Unlock all edits to change the rest.") and Settings only the outer size;
  Boards stay open. The store refuses any other change to the product and shows a notice. **Unlock all edits** asks
  once and removes `kit` in one commit; Undo brings it back.

## Alternatives considered

- **Lock in memory only** — lost on reload, so the kit would silently become a normal design.
- **Reuse project piece locks (ADR-211)** — they lock size axes of a project item, not a standalone design's structure.

## Scope

- In scope: the flags, the room, the two families, the stand-outs, the tab, the kit lock, the unlock.
- Out of scope: closed panels in the divider (ADR-293, Pending); handles in a kit (no kit has fronts, G-608).

## Consequences

- Positive: a curated entry point, and a safe pre-made piece for users who do not want to design.
- Negative / risks: a schema bump; the store guard must not block size edits or the stagger refresh.
- Harder to change later: the saved `kit` shape.

## Done when

- [x] Catalog › Highlights lists Room divider and Staggered shelving with 3 versions each and one stand-out per
      function group (`tests/highlights.test.ts`, `tests/find-it/highlights.test.tsx` at 390 and 1280 px)
- [x] Room `custom` exists with its label and Russian entry; both families are in it (`tests/highlights.test.ts`)
- [x] Every highlighted version inserts with no error diagnostic, and the 3 versions of a family differ (same test)
- [x] A kit opens with the banner and only the size in Settings; a structure change is refused (`tests/kits.test.ts`)
- [x] Unlock all edits removes the kit after a confirm, and Undo restores it (`tests/kits.test.ts`, find-it)
- [x] Highlight in Edit template marks a variant of the user's own template (`tests/find-it/highlights.test.tsx`)
- [x] schemaVersion 12: `kit` refused before 12; version 11 loads (`tests/kits.test.ts`)
- [x] Every new text has its Russian entry (`pnpm typecheck`)
