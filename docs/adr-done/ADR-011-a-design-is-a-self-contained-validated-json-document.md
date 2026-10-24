# ADR-011: A design is a self-contained, validated JSON document

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-012

## Context

Designs must survive export/import and future versions without depending on the app's code state.

## Decision

`Design { schemaVersion: 1, id, name, createdAt, updatedAt, materials[], product }` embeds its materials, so a file
opens identically anywhere. It stores only parameters and the space tree — never generated geometry or code.
`validateDesign` checks every field (integers, enums, material references, unique space ids, count caps) before a
design is loaded from storage or a file. A future shape change bumps `schemaVersion` and adds a reader; old readers
stay.

## Alternatives considered

- **Store generated panels** — rejected: stale as soon as generators improve.

## Consequences

- Imported files get a new id so they never overwrite an existing design.

## Evidence (repository files)

- `src/core/types.ts` — `Design`.
- `src/core/design.ts` — `validateDesign`, `MAX_SHELVES`, `MAX_DRAWERS`.
- `src/ui/Dialogs.tsx` — import path validates first.

## Compliance check

`tests/core.test.ts` document validation and every-template-validates cases pass.
