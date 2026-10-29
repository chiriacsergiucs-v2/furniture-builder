# ADR-156: Translate the problem messages into Russian

- Status: Implemented
- Date: 2026-10-29
- Implemented: 2026-10-29 (PR #137, CI run 40923177464)
- Depends on: ADR-153
- Design: n/a
- Backlog: N158

## Context

Part of the user's request of 2026-10-29, see [ADR-153](../adr-done/ADR-153-switch-the-app-between-english-and-russian.md).
Answer: scope "UI + diagnostics + print/CSV".

## Decision

- Every diagnostic message, check result and notice text written in `src/core` (and the import, validation and
  storage messages in `src/persist`, `src/store`, `src/online`) goes through `t` with placeholders.
- Diagnostic codes and severities do not change; an error still blocks export and is never softened (ADR-008).

## Alternatives considered

- **Translate at display by matching the English sentence** — breaks on every placeholder; `t` at the source is
  exact.

## Scope

- In scope: all message text in `src/core`, `src/persist`, `src/store`, `src/online`.

## Consequences

- Positive: problems read in Russian.
- Negative / risks: tests that compare message text keep running in English.

## Done when

- [x] With Russian chosen, a design with a known error gives its Russian message and the same code
      (`tests/i18n.test.ts`).

## Open questions

None. All answered by the user on 2026-10-29.
