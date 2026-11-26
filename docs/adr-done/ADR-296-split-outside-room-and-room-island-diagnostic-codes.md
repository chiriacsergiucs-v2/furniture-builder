# ADR-296: Split outside-room and room-island diagnostic codes

- Status: Implemented
- Date: 2026-11-26
- Implemented: 2026-11-26
- Depends on: ADR-225
- Design: n/a
- Backlog: N396

## Context

ADR-225 gave every diagnostic its own code and kept six codes that say more than one wording, because each was judged
one problem (`SAME_PROBLEM` in `tests/diagnostic-codes.test.ts`). G-505 (architecture review I-07) lists the closest
calls. The user approved on 2026-11-23: "build every Low-work gap with its recorded Suggested pick". The pick for G-505
is: "Split outside-room into outside-room and taller-than-room with repairs keyed on both, and room-island's rectangle
and too-small cases, in a follow-up ADR".

Today in `src/core/room.ts` one code `outside-room` says "{name} is outside the room (through a wall)" (with or
without "it is {mm} mm too far out") and "{name} is {mm} mm taller than the room". Two problems, two fixes (move along
the floor, or hang lower), one code. In `src/core/roomfill.ts` `room-island` says four things: the walkway is missing,
the walkway is not a whole number above 0, an island needs a rectangle room, and the room is too small for an island
with this walkway. The first two are the walkway field; the last two are about the room.

## Decision

1. New code `taller-than-room`, given by the "taller than the room" wording. The "through a wall" wordings keep
   `outside-room`.
2. New codes `room-island-not-rectangle` ("An island needs a rectangle room.") and `room-island-too-small` ("The room
   is too small for an island with this walkway."). The two walkway wordings keep `room-island`.
3. Severity, wording, ids, box and amount of every diagnostic are unchanged (ADR-008); only the code differs.
4. Everything keyed on `outside-room` applies to `taller-than-room` too, so no repair is lost: `REPAIRABLE` and
   `mayRepair` (one piece id), the repair candidates (hang lower, move inside), `POSITION_ERRORS` in `Project.tsx`
   and `BODY_CODES` in `envelopes.ts`. A shared `ROOM_FIT_CODES` set in core names the pair.
5. Fill the room's Refine step (`stepOf` in `RoomFill.tsx`) treats the three island codes like `room-island`.
6. `SAME_PROBLEM` loses `outside-room` (now one wording, the through-a-wall pair is one problem: a count of 1 is
   not listed) and `room-island` drops to 2 wordings (the walkway field).

Decided by Claude: the code names; `room-island-too-small` rather than a longer name, as the room is the subject.

## Alternatives considered

- **Keep the codes** — repairs and the UI cannot tell the two fixes apart without reading the message.
- **Also split the other four** (worktop joint, worktop edge, drawer-low, corner-size) — not in the pick; each stays
  one problem said per place, left as G-505's remainder in GAPS.md.
- **Split by message wording in the UI** — rejected by ADR-225: nothing keys on translated text.

## Scope

- In scope: the three new codes, their emit sites, repairs, UI sets, tests.
- Out of scope: the other four multi-wording codes (recorded in G-505's remaining text, ADR-082).

## Consequences

- Positive: each wording has one code; the repairs and the Refine step name both explicitly.
- Negative / risks: a saved golden list of diagnostics changes its code column for the affected rows.
- Harder to change later: the code names are compared everywhere (ADR-225).

## Done when

- [x] A piece taller than the room gives `taller-than-room`; one through a wall gives `outside-room` (tests).
- [x] A non-rectangle room and a too-small room give `room-island-not-rectangle` and `room-island-too-small`; the
      walkway wordings keep `room-island` (tests).
- [x] The repairs offered for `taller-than-room` equal those offered before for the same case (tests).
- [x] `SAME_PROBLEM` and `DIAGNOSTIC_CODES` list the new codes and `tests/diagnostic-codes.test.ts` passes.
- [x] The fuzz (`FUZZ_N=30000`) passes.
