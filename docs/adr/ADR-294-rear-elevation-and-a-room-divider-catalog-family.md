# ADR-294: Rear elevation and a Room divider catalog family

- Status: Pending
- Date: 2026-11-24
- Depends on: ADR-292, ADR-293
- Design: n/a
- Backlog: N382
- Acceptance: browser

## Context

With ADR-292 and ADR-293 a divider can be built, but only an expert can find how: the user did not find staggered
rows (ADR-282) and asked for "room dividers". The catalog has no such family (`src/core/catalog/storage.ts:26-52`).
The 2D elevation draws the front only (`src/ui/Elevation.tsx:137-141`), so a rear infill cannot be checked in 2D.

## Decision

- Elevation: a **Front / Rear** toggle on two-faced pieces. Rear draws the piece mirrored, as seen from behind:
  rear infills solid, front infills dashed. It is drawn from `buildModel()` only (ADR-004).
- Catalog: a family **Room divider** (`function: 'storage'`, rooms living, office, kids). It has one variant,
  "Open both sides, staggered", 1000 × 1980 × 300, 6 rows, staggered (ADR-282, the default widths), Open both
  sides, and one infill per row. Aliases: room divider, space divider, partition shelf, paravan bibliotecă.
- Infill faces are configurable (user, 2026-11-24: "mix of front and [rear] on my choice"). Add asks for a
  **Closed panels** pattern: Alternate front/rear (default), All front, All rear or Both. After Add, any cell can
  be changed on its own through Space › Contents › Closed panel (ADR-293).
- The variant is built only from ADR-282/292/293 data: no new model field.

## Alternatives considered

- **Use the 3D view only** — no measurements; the 2D sheet is what gets printed.
- **Add a variant to Bookcase** — Bookcase is "(with back)", and the user searched for a divider.

## Scope

- In scope: the toggle, the rear drawing, the family and the variant.
- Out of scope: a printed rear sheet in the review pack (G-595).

## Consequences

- Positive: a divider is one tap from the catalog, and both faces can be checked in 2D.
- Negative / risks: one more family; the 2D drawing code gains a mirrored mode.

## Done when

- [ ] Catalog search "room divider" shows the family, and Add gives 6 staggered rows, Open both sides and
      one infill per row (`tests/catalog.test.ts`)
- [ ] Each Closed panels pattern (Alternate, All front, All rear, Both) gives those faces, and a single
      cell can then be switched on its own (same)
- [ ] The variant has no error diagnostic, and its cut list lists every infill (same)
- [ ] Rear view: a rear infill is solid and a front one dashed, mirrored left to right (`tests/elevation.test.tsx`)
- [ ] Browser find-it at 360 and 1280 px from the bare app: Catalog › "room divider" › Add › Elevation › Rear
      (`tools/room-divider/find-it.mjs`)
- [ ] Every new text has its Russian entry (`pnpm typecheck`)
