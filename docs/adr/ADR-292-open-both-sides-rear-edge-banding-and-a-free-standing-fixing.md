# ADR-292: Open both sides: rear edge banding and a free-standing fixing

- Status: Pending
- Date: 2026-11-24
- Depends on: ADR-011, ADR-035
- Design: n/a
- Backlog: N380
- Acceptance: full

## Context

The user (2026-11-24) cannot build a room divider: "unable to create furniture that can be used as room dividers
with partial walls on and shelves". A cabinet can already have Back: None (`src/ui/Inspector.tsx:1365`), but every
carcass panel is banded on its front edge only (`src/core/cabinet.ts:399,409,475,1379,1412`). With no back, the rear
edges show raw board. The anti-tip rule (ADR-035, `src/core/rules.ts:149`) tells the user to fix a tall piece to the
wall, which a divider in the middle of a room has no wall for.

## Decision

- `CabinetParams.twoFaced?: true` (design schemaVersion 11), allowed only with `back: 'none'`. Versions 1 to 10
  still load. `twoFaced` with any other back is refused by `validateDesign`.
- When `twoFaced` is set, `buildModel()` adds `-z` to the banded edges of sides, top, bottom, dividers, fixed and
  loose shelves. The cut list and the edge-band totals follow from the model (ADR-004).
- When `twoFaced` is set, the anti-tip rule schedules "Free-standing fixing: floor or ceiling" instead of the wall
  fixing, as the new hardware kind `floor-fixing` (printed in Romanian as "Prindere de sine stătătoare: în podea sau
  tavan"). Its note says to choose the fixing for the floor or ceiling type (ADR-010: no product is named).
- Racking: no warning until the user gives a height figure (user, 2026-11-24; ADR-010, G-592).
- UI: Piece › Settings › Back gets a fourth option, **Open both sides**. It sets `back: 'none'` and `twoFaced`.
  Picking another back clears `twoFaced`.

## Alternatives considered

- **Band the rear edges whenever Back is None** — changes the cut list of every existing open piece set against
  a wall, which needs no rear banding.
- **A separate "room divider" product kind** — duplicates the carcass. ADR-007 asks to reuse `buildCabinet`.

## Scope

- In scope: the flag, rear banding, the free-standing fixing, the option in Settings.
- Out of scope: a racking check for back-less pieces (G-592: no figure yet); corner units (G-591).

## Consequences

- Positive: an open piece reads as finished from both sides, and its cut list says so.
- Negative / risks: one more Back option, and a schema bump.
- Harder to change later: the saved `twoFaced` shape (schemaVersion 11).

## Done when

- [x] Open both sides: every side, top, bottom, divider and shelf has `+z` and `-z` banded (`tests/two-faced.test.ts`)
- [x] Back None without Open both sides keeps today's banding (same test)
- [x] The hardware list shows the free-standing fixing, not the wall fixing, above the anti-tip height (same test)
- [x] schemaVersion 11 is required for `twoFaced`; with another back it is refused; version 10 loads (same test)
- [x] Find-it at 390 and 1280 px: Bookcase › Settings › Back › Open both sides, then Parts shows the sides banded
      on both long edges (L2 W0) and Hardware the free-standing fixing (`tests/find-it/two-faced.test.tsx`)
- [x] Every new text has its Russian entry (`pnpm typecheck`)
