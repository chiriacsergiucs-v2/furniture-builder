# ADR-151: Key gaps by a UUID and keep the number and time in the title

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-082, ADR-101
- Design: n/a
- Backlog: N152
- Acceptance: browser

## Context

User request 2026-10-29: "Update gap file to use a uui instead of number, put number only in title + current hour and
minute, use the title when listing the gaps, apply to all previously existing, time for them 12:00."

[ADR-082](../adr-done/ADR-082-record-every-unbuilt-item-in-a-gaps-ledger-kept-in-step-with.md) keys each gap by its
heading, `### G-NNN: title`, and `pnpm gaps add` takes the next number. Two branches that add a gap at the same time
pick the same number. [ADR-101](../adr-done/ADR-101-show-the-gaps-ledger-in-the-app-and-hand-marked-decisions-to.md)
shows the ledger in the app and saves the user's marks on the device keyed by `G-NNN` (Dexie v9 `gapMarks`). This ADR
replaces the gap key of both; implemented ADRs stay as written.

Answers 2026-10-29: the heading is the name only, with `- Id:` and `- Number:` lines under it; ADRs, the backlog and
replies keep citing `G-NNN`; marks saved before this change are read as they are (no migration).

## Decision

- Each gap is `### Name`, then `- Id: <uuid v4>` (the key) and `- Number: G-NNN HH:MM`, then the ADR-082 fields.
- The gap's title is `G-NNN HH:MM Name`. `pnpm gaps list`, `gaps add`, `gaps sync`, the ledger errors and the Gaps
  page use the title.
- `pnpm gaps add` takes a new UUID, the next free number and the current UTC hour and minute.
- All 265 existing gaps get a new UUID and keep their number with the time `12:00`.
- Citations stay `G-NNN`; `pnpm docs:check` resolves them by the Number line. A repeated number is allowed; a repeated
  Id is an error.
- Gaps page: marks are stored under the gap's UUID. A mark saved before this change, under `G-NNN`, is found by the
  gap's number and stays under that key when changed. No new Dexie version (the key is a string either way).

## Alternatives considered

- **Heading `G-NNN HH:MM Name` with an Id line** — not chosen by the user.
- **Cite gaps by UUID** — unique, but the user kept `G-NNN` citations.
- **Move old marks to the UUID key** — no data loss either, but the user chose to read them as they are.

## Scope

- In scope: `docs/adr/GAPS.md`, `scripts/gaps.py`, `scripts/check-docs.py`, `src/core/gaps.ts`, `src/ui/Gaps.tsx`,
  their tests, `tools/gaps/find-it.mjs`.

## Consequences

- Positive: two branches can add gaps at the same time without a key clash.
- Negative / risks: a repeated `G-NNN` makes a citation ambiguous; the title's time tells the two apart.
- Harder to change later: marks on devices are keyed by either form.

## Done when

- [ ] Every gap in `docs/adr/GAPS.md` has a UUID Id and a `G-NNN 12:00` Number; `pnpm docs:check` passes.
- [ ] `pnpm gaps add` writes a UUID, the next number and the UTC time; a bad Id or Number and a repeated Id are errors
      (`scripts/test_gaps.py`).
- [ ] `pnpm gaps list` prints the status and the title.
- [ ] The app parser matches `scripts/gaps.py` on the real ledger (ids, titles, statuses); an old `G-NNN` mark is
      still found (`tests/gaps-page.test.ts`).
- [ ] Browser find-it `tools/gaps/find-it.mjs`: the Gaps page row shows "G-021 12:00" at 1280 and 390 px.
