# ADR-082: Record every unbuilt item in a gaps ledger kept in step with main

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-050, ADR-066
- Design: n/a
- Backlog: N77

## Context

The user, 2026-10-25: "Configure the project so everytime something is "not implemented" it is being saved into
adrs folder into "Gaps" with "origin/missing/user request text that specifies it/questions to fix, suggested pick".
Save the file so it is persisted and items from it can be used to add as a new adr or mark as acknowledged and
accepted. Once implemented (present on main, mark it as done)." And: "How to configure to have it always up to
date? Hook?"

Until now, unbuilt items were spread over _Skipped this iteration_ replies, _Out of scope_ lines, _Open questions_
and backlog notes. The 2026-10-25 review found 48 such gaps, most of them chosen by the agent without asking. Replies
are lost with the session, so nothing tracked them.

## Decision

- **One ledger:** `docs/adr/GAPS.md`, one section per gap:
  `### G-NNN: <title>` followed by `- Status:`, `- Origin:`, `- Missing:`, `- Request:`, `- Questions:` and
  `- Suggested pick:` lines. The suggested pick follows the 2026-10-25 rule in `CLAUDE.md`: the option closest to
  the request, with estimated extra effort and value.
- **Statuses:**
  - `Open`: new.
  - `Acknowledged (YYYY-MM-DD)`: the user accepted the gap as it is. Only the user sets this.
  - `ADR-NNN`: the gap moved into that ADR.
  - `Done (<commit or ADR-NNN>)`: built.
- **Done means on main.** The `ship-adr` skill marks the gaps of the ADR it ships `Done (ADR-NNN)` in the ship
  commit. They therefore reach `main` together with the shipped ADR. `pnpm docs:check` fails while a gap points at
  an Implemented ADR and is not Done.
- **Capture:**
  - Every reply's _Skipped this iteration_ item, every _Out of scope_ item and every unconfirmed open question gets
    a G id in the same change. `scripts/gaps.py add` appends one with the next free id; `scripts/gaps.py list`
    shows the open ones.
  - `pnpm docs:check` also fails if an ADR from ADR-082 on has an _Out of scope_ line or open question without a G
    id.
- **Hook:** a Claude Code `Stop` hook in `.claude/settings.json` runs `scripts/gaps-hook.py`. If the last reply
  names skipped or unbuilt items and the ledger has not changed on this branch, the hook asks once to record them
  or to say why none apply. CI is the hard check. The hook is the reminder; it runs only in Claude Code.
- The ledger is seeded with the 48 gaps from the 2026-10-25 review (G-001 to G-048).

## Alternatives considered

- **Only a hook.** It runs only inside Claude Code and can be skipped. Without the CI check, the ledger would drift
  from the ADRs and from `main`.
- **A folder with one file per gap.** Easier to diff one gap, but 48+ files are harder to scan or edit at once. A
  single file can still be split later.
- **A GitHub Action that marks gaps Done after each merge.** It would push to `main` directly, which `CLAUDE.md`
  forbids. Marking gaps in the ship commit gets the same result through the normal pull request.

## Scope

- In scope:
  - `docs/adr/GAPS.md` and the seed;
  - `scripts/gaps.py` (`add`, `list`, `sync`);
  - the ledger checks in `scripts/check-docs.py`;
  - the `Stop` hook;
  - `CLAUDE.md`, the template and the `new-adr`, `next-adr` and `ship-adr` skills;
  - a `gaps` script in `package.json`.
- Out of scope: G ids on the backlog notes and ADRs written before ADR-082 (G-049); a page in the app for the
  ledger (G-050).

## Consequences

- Positive: nothing unbuilt is lost between sessions; the user can turn any gap into an ADR or accept it.
- Negative / risks: replies and ADRs take a little longer to write; the hook may ask once when nothing applies.
- Harder to change later: the G id format, which ADRs and the backlog will cite.

## Done when

- [ ] `docs/adr/GAPS.md` holds G-001 to G-048 with all six fields.
- [ ] `pnpm docs:check` fails when:
  - a gap is missing a field or has a bad status;
  - two gaps share an id;
  - a gap points at an unknown ADR;
  - a gap points at an Implemented ADR and is not Done;
  - an ADR from ADR-082 on has an _Out of scope_ line or open question without a G id.
- [ ] `scripts/gaps.py add` appends the next id; `scripts/gaps.py sync` marks gaps of Implemented ADRs Done.
- [ ] The `Stop` hook asks once when a reply lists skipped items and the ledger has not changed, and stays silent
      otherwise (tested with sample inputs).
- [ ] `CLAUDE.md`, the template and the `new-adr`, `next-adr` and `ship-adr` skills describe the ledger.
