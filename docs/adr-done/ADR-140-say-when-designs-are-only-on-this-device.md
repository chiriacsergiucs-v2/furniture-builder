# ADR-140: Say when designs are only on this device

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-133
- Design: docs/ui-design.md (Alert `.alert.info`, Library)
- Backlog: N141
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)
- Proposed by: Claude, not requested (2026-10-28 task: "propose further architecture and UX ADRs")

## Context

Proposed by Claude, not requested. ADR-012: "Clearing site data deletes saved designs; export is the backup."
Users do not see that. ADR-133 adds persistent storage and folder backups; a short notice tells users when neither
protects their work.

## Decision

- The library shows `.alert.info`: "Your designs are only on this device. Back up to a folder or save them to your
  account." with **Back up** (and **Sign in** once ADR-136 exists) and **Dismiss**, while storage is not
  persistent or no backup and no account copy exists.
- It never blocks work and never shows in printed sheets.

**Answers (user, 2026-10-28):**

- **Dismiss** hides it for 7 days; it returns while the conditions still hold (G-261).

## Alternatives considered

- **Nothing** — users learn about eviction by losing data.
- **A blocking dialog at start** — punishes offline-only users who chose that.

## Scope

- In scope: the notice, its conditions, dismiss, tests.
- Covered elsewhere: reminders over time (ADR-141).

## Consequences

- Positive: the risk is stated once, in plain words.
- Negative / risks: notice fatigue if shown too often.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Notice shows exactly when its conditions hold (jsdom tests).
- [ ] Browser find-it on the production build at 390 and 1280 px: "only on this device", **Back up** (light — catch-up).

## Implementation (2026-10-28)

`DeviceOnlyNotice` on Projects: while something is saved, no backup was made and nothing is in an account; Back
up, Sign in (when accounts exist) and Dismiss (back after 7 days, G-261). Tests: `tests/backup.test.ts`,
`tests/saved-data.test.tsx`.

## Open questions

- None open. Answered 2026-10-28, one by one: G-261 dismissible, back after 7 days.
