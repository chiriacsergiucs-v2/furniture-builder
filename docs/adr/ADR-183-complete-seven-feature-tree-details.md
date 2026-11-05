# ADR-183: Complete seven feature-tree details

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-158
- Design: n/a
- Backlog: N186
- Agreed: 2026-11-05 "Proceed similarly with next 5 adrs"; answer "Both, delete all 9"

## Context

Gap G-328 (N170): seven feature-tree lines (`src/core/features.ts`, ADR-158) keep correct but incomplete details:
Drag a piece on the plan (arrow keys), Wall colour or picture (where it shows, Solid walls), 2D, 3D or both (one
switch in both modes), Share links, Save pieces and templates to your account, Boards and edge bands from a seller
(seller pictures load online), Seller products for hardware (Add seller product).

User, 2026-11-05: complete them with their Russian entries.

## Decision

1. Each of the seven lines' `detail` says what the gap names, read from the code (no new behaviour), with its Russian
   entry in `src/core/i18n/ru/info.ts` (the old entries go).

## Alternatives considered

- **Leave them** — the tree stays short of what the app does. Not chosen.

## Scope

- In scope: seven `detail` texts and their translations.

## Consequences

- Positive: the Information page describes what is built.

## Done when

- [ ] The seven details name the missing points; each has its Russian entry (typecheck, tests)
- [ ] More → Information → "arrow keys" under Drag a piece on the plan at 390 and 1280 px (jsdom find-it)
