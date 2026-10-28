# ADR-142: Switch between accounts on one device

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-129, ADR-136
- Design: docs/ui-design.md (Menu, Dialog)
- Backlog: N143
- Acceptance: browser
- Proposed by: Claude, not requested (2026-10-28 task: "propose further architecture and UX ADRs")

## Context

Proposed by Claude, not requested. A workshop tablet or a family computer may be used by two people, or one
person may keep a work and a private account. ADR-136 allows one signed-in account.

## Decision

- Account menu: the signed-in account, other accounts used on this device, **Add another account**.
- Switching never deletes or rewrites saved designs (ADR-012); account items of the other account are hidden, not
  removed.

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

- [ ] Switching shows only the chosen account's items plus device-only items; no row is deleted (store test).
- [ ] Browser find-it on the production build at 390 and 1280 px: "Add another account", switch, back.

## Open questions

- Several accounts with separate account copies, or one at a time? Suggested: several (+20 %) (G-263).
