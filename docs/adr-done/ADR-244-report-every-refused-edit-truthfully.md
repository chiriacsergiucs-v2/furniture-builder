# ADR-244: Report every refused edit truthfully

- Status: Implemented
- Date: 2026-11-10
- Implemented: 2026-11-10
- Depends on: ADR-243
- Design: n/a
- Backlog: N253

## Context

Same request as [ADR-243](../adr-done/ADR-243-keep-locks-in-force-in-every-editing-flow.md) ("combine, 1 PR to cover it all").
The flow map found edits that were refused while the app said they had worked, or said nothing:

- Apply material, finish and style returned the names they meant to change even when a lock refused the commit,
  so the Material dialog said "Applied to N items" (`src/store/designStore.ts`). One boards-locked piece also
  refused a whole group or project apply.
- A refused merge, mirror, gap, Against the wall, Align or Distribute (group carry) set no notice; only the
  calling card knew, so an assistant plan never saw it.
- A repair worked out on an older project, a repair a lock refused, and a template save that failed all ended
  silently or with "Applied".
- The lock chip and the plan badge left out the boards and construction locks (ADR-211); their menu buttons had
  no title.
- Project settings read a notice left by an earlier action as their own refusal.

## Decision

- `commit` and `updateProject` return why a change was refused (or null); callers report that.
- Group and project apply (material, finish, style) leave a boards-locked piece (and, for a style, a
  construction-locked one) as it was and list it as "{name}: locked" under skipped; the rest is applied. A
  refusal is never counted as applied.
- Merge, mirror, Mirror the run, gap, Against the wall, Align and Distribute set the notice when refused.
- The repair banner says "The project changed since this repair was worked out; pick it again." or the lock's
  reason; a failed template save says "Not saved to the template; your draft waits on the Catalog page."
- The chip lists "boards" and "construction"; the plan badge shows for them; both menu buttons get a title.
- Project settings clear the notice before their own call.

## Alternatives considered

- **Refuse the whole batch** (status quo) — one locked piece blocked every other piece, with a false "Applied".
- **Silently skip locked pieces** — hides why a piece did not change.

## Scope

- In scope: the store actions and the UI messages above.
- Out of scope: wording of messages that were already correct.

## Consequences

- Positive: the user and the assistant always learn what really happened.
- Negative / risks: apply-to-many now succeeds partly; the skipped list says which pieces kept their boards.

## Done when

- [x] Apply material to the project skips a boards-locked piece, names it and applies the rest
      (`tests/editing-flows.test.ts`)
- [x] A refused merge and a refused mirror leave a notice (`tests/editing-flows.test.ts`)
- [x] `updateProject` returns the refusal reason (`tests/editing-flows.test.ts`)
- [x] Find-it: the chip reads "Locked: boards, construction" at 390 and 1280 px
      (`tests/find-it/editing-flows.test.tsx`)
