# ADR-142: Switch between accounts on one device

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-129, ADR-136
- Design: docs/ui-design.md (Menu, Dialog)
- Backlog: N143
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)
- Proposed by: Claude, not requested (2026-10-28 task: "propose further architecture and UX ADRs")

## Context

Proposed by Claude, not requested. A workshop tablet or a family computer may be used by two people, or one
person may keep a work and a private account. ADR-136 allows one signed-in account.

## Decision

- Account menu: the signed-in account, other accounts used on this device, **Add another account**.
- Switching never deletes or rewrites saved designs (ADR-012); account items of the other account are hidden, not
  removed.

**Answers (user, 2026-10-28):**

- **Several accounts** on one device, each with its own account copies; device-only items stay visible to all (G-263).

## Alternatives considered

- **Sign out and in again** — works today with ADR-136; slower, and badges change meaning each time.
- **Browser profiles** — separate storage, but outside the app and unknown to most users.

## Scope

- In scope: the menu, switching, the item filter, tests.
- Covered elsewhere: sign-out choices (ADR-129, G-227).

## Consequences

- Positive: shared devices keep work apart.
- Negative / risks: a device-only item belongs to nobody; must be shown clearly.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Switching shows only the chosen account's items plus device-only items; no row is deleted (store test).
- [ ] Browser find-it on the production build at 390 and 1280 px: "Add another account", switch, back (light — catch-up).

## Implementation (2026-10-28)

Several accounts (G-263): the device remembers them; Account › Switch to … and Add another account; another
account's copies are hidden on this device, never removed, and never uploaded to the current account. A switch signs
out and asks for the other account's password (G-275). Tests: `tests/sync.test.ts`, `tests/account-ui.test.tsx`.

## Open questions

- None open. Answered 2026-10-28, one by one: G-263 several accounts.
