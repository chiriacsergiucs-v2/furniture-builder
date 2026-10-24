# ADR-080: Retire light acceptance: every visible change gets a find-it test

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-066
- Design: n/a
- Backlog: N75

## Context

The user, 2026-10-24: "Remove the idea of find-it pending, i changes my mind".

[ADR-066](../adr-done/ADR-066-light-acceptance-an-adr-may-ship-without-a-find-it-test-caug.md) allowed an ADR
whose header says `- Acceptance: light` to skip the find-it script and any browser run. Its backlog rows stayed
Partially done with the gap `find-it pending (light, ADR-066)` until the user said "catch up acceptance". ADR-066
is implemented, so it is not edited; this ADR replaces it.

Where it is used today: only ADR-065 (implemented) had `- Acceptance: light`, and its row N60 was caught up to
Done. No pending ADR uses it, and no backlog row carries the marker. Nothing is waiting on a catch-up.

## Decision

- R3 has no exception any more. Every ADR with anything visible ships with its `tools/*/find-it.mjs` script,
  run against the production build at phone and desktop widths. That is how CLAUDE.md R3 read before ADR-066.
- Remove the `- Acceptance:` header line, the `find-it pending (light, ADR-066)` marker and the "catch up
  acceptance" command from the following places:
  - CLAUDE.md (R1, R3, Process)
  - the ADR template
  - the skills: new-adr, next-adr, review, implement-design, ship-adr, add-tests, verify
- `scripts/check-docs.py` drops the marker checks. A pending ADR in `docs/adr/` that still has an
  `- Acceptance:` line is an error. Implemented ADRs keep theirs as history (ADR-065).
- Replies still end with the backlog status table and _Skipped this iteration_. The table no longer lists
  find-it-pending rows.

## Alternatives considered

- **Keep ADR-066 and simply never use it.** The option would stay in the template and skills, and get chosen
  again by default wording. The user asked to remove the idea.
- **Edit ADR-066 in place.** Implemented ADRs are never edited (ADR-050).

## Scope

- In scope: CLAUDE.md, `docs/adr/_template.md`, `docs/adr/README.md` conventions, the seven skills above,
  `scripts/check-docs.py`, and backlog rows N61 and N75.
- Out of scope: implemented ADRs (ADR-065, ADR-066 stay as written) and existing find-it scripts.

## Consequences

- Positive: one rule for acceptance and no backlog gaps waiting on a catch-up.
- Negative: an ADR with a screen always costs a production build and a browser run.

## Done when

- [x] `grep -rn "find-it pending\|Acceptance: light"` finds nothing in CLAUDE.md, the ADR template, the other
      pending ADRs, `.claude/skills/` or `scripts/` (only this ADR's own Context quotes them).
- [x] `pnpm docs:check` passes, and fails for a pending ADR that has an `- Acceptance:` line (checked by
      hand on a scratch copy).
- [x] Backlog N61 says it is retired by ADR-080; N75 records this change.
