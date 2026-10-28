# ADR-140: Say when designs are only on this device

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-133
- Design: docs/ui-design.md (Alert `.alert.info`, Library)
- Backlog: N141
- Acceptance: browser
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

- [ ] Notice shows exactly when its conditions hold (jsdom tests).
- [ ] Browser find-it on the production build at 390 and 1280 px: "only on this device", **Back up**.

## Open questions

- Always while unprotected (dismissible for N days you choose), or once only? Suggested: dismissible (G-261).
