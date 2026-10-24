# ADR-025: Wall and corner cabinets as new product roots built from the cabinet generator

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: open questions answered by the user
- Depends on: none
- Design: n/a
- Related: ADR-007, ADR-010, ADR-022
- Backlog: N07

## Context

Kitchens need wall cabinets (no plinth, hung on the wall) and corner cabinets (L-shaped blind or diagonal).
ADR-007 says new families get their own root and reuse `buildCabinet` where a carcass exists.

## Decision

- **Wall cabinet** = the cabinet root with `mount: 'floor' | 'wall'`; wall mode forces plinth 0, adds a mounting
  height (position only) and schedules a hanging-rail/bracket pair as hardware, labelled to confirm against the
  bracket datasheet and wall type.
- **Corner cabinet** = a new `corner` root composed of two carcasses joined at a blind panel, each built by
  `buildCabinet` with an origin offset (same pattern as desk pedestals). An L-shaped two-door corner is a second `corner` variant
  built the same way. Diagonal and carousel corners are out of scope until requested.
- **Worktop joins** belong to projects (ADR-022): a worktop spanning several floor pieces is a project-level panel.

## Alternatives considered

- **Free-form L-shaped carcass** — breaks the space model; two carcasses keep every existing rule.

## Consequences

- Corner blind-panel width depends on door and handle clearance; it is a parameter with a check, not a fixed rule.

## Evidence (repository files)

- `src/core/types.ts` — `CabinetParams.mount/mountHeight`, `CornerParams`, `Product` kind `corner`, roles/hardware kinds.
- `src/core/cabinet.ts` — wall mode (no plinth, brackets + rail, back warning); `omitSide` and `frontTrim` build options.
- `src/core/corner.ts` — blind corner (blind carcass + blind panel + usable carcass) and L-shape (two carcasses, wing B rotated a quarter turn with its corner side omitted, door leaves offset, corner fold hinge scheduled), mirrored for the right; no shelf/drawer/front code of its own.
- `src/core/design.ts` — templates (wall cabinet, blind corner, L corner), roots, validation; `src/core/ro.ts` — Romanian names.
- `src/ui/Inspector.tsx` — wall mount and corner editors; `src/ui/Elevation.tsx` — side-wing spaces kept out of the front view.
- `tests/core.test.ts` — ADR-025 block incl. 400 random corners with no overlaps.

## Compliance check

When accepted: `corner` uses `buildCabinet` twice and contains no drawer/shelf code of its own.

## Answers (2026-10-21, from the user)

- **Corner cabinets:** both types — blind corner (left or right) and L-shaped with a hinged double door.
- **Wall cabinets:** adjustable hanging brackets on a wall rail; 2 brackets per cabinet plus rail cut to the cabinet
  width, scheduled as hardware with a note to confirm against the bracket datasheet and wall type.

Built and accepted 2026-10-21. Worktop joins remain part of projects (ADR-022).
