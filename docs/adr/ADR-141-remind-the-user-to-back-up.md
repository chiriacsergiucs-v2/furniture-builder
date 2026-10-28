# ADR-141: Remind the user to back up

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-133
- Design: docs/ui-design.md (Toast, Settings dialog)
- Backlog: N142
- Acceptance: light
- Proposed by: Claude, not requested (2026-10-28 task: "propose further architecture and UX ADRs")

## Context

Proposed by Claude, not requested. A folder backup (ADR-133) helps only if it runs. Where automatic backup is not
possible (browsers without folder access, or permission not granted again after a restart), the user must act.

## Decision

- When the last backup is older than the chosen interval and something changed since, a `.toast` reads "Last
  backup: <n> days ago." with **Back up now** and **Later**.
- Settings › Saved data holds the interval, including **Off**.

## Alternatives considered

- **Automatic backup only** — impossible on browsers without folder access.
- **Email reminders** — needs an account and a server (ADR-126).

## Scope

- In scope: the reminder rule, the setting, tests.
- Covered elsewhere: backups themselves (ADR-133).

## Consequences

- Positive: backups stay recent without effort.
- Negative / risks: an interval set too short annoys.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [ ] The rule shows the toast only when the interval passed and something changed (unit test with fixed dates).
- [ ] jsdom find-it at 390 and 1280 px: "Last backup:", "Back up now", the interval setting (light — catch-up).

## Open questions

- A fixed interval, or a Settings choice (with Off) starting at a value you pick? Suggested: a Settings choice
  (G-262).
