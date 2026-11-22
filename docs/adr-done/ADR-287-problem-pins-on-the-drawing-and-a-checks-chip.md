# ADR-287: Problem pins on the drawing and a Checks chip

- Status: Implemented
- Date: 2026-11-22
- Implemented: 2026-11-22
- Depends on: ADR-286
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec, slice 5: problem pins)
- Backlog: N370
- Acceptance: browser

## Context

Slice 5 of the canvas-native phone editor (ADR-283, G-577; user 2026-11-22: "Proveed slices"). In the design a check
that names a space is marked on that space, and the chip rail carries the error count. Today the checks are listed
under Checks in Build & Preview (ADR-071) and counted on the Cut list nav; the drawing does not show where they are.

## Decision

While the canvas editor is on (ADR-283):

1. **Pins.** Each space of the front drawing that a check names (`Diagnostic.nodeId`) gets one pin at its top-left
   corner, red for a problem (error), amber for a check (warning), a 44 px button named "Problem: <message>" or
   "Check: <message>". The messages are the checks' own, never shortened or softened (ADR-008).
2. **Callout.** A tap opens a callout under the pin with every message for that space and three actions: Open Checks
   (the Checks list, where repairs are previewed, ADR-071), Select it, Close. Esc closes it.
3. **Checks chip.** While the design has problems the chip rail starts with "Checks: n problem(s)", which opens the
   Checks list.
4. Pins come from the model's diagnostics (ADR-004); checks still run on their own (ADR-008).

## Alternatives considered

- **Repairs inside the callout** — repairs are previewed on the plan (ADR-071); the Checks list stays their one place.
- **Pins for project checks on the plan** — project checks have a room box, not a space; left for the plan view.

## Scope

- In scope: pins on the front drawing of a piece, the callout, the Checks chip.
- Out of scope: pins on the project plan, output lenses (next slice, G-577).

## Consequences

- Positive: a problem shows where it is, one tap from its message.
- Negative / risks: a space with several checks has one pin; the callout lists them all.

## Done when

- [x] Canvas editor on: no pin while nothing is wrong.
- [x] A space with a problem shows a "Problem: …" pin ≥ 44 px, and the rail shows "Checks: n problem(s)".
- [x] Tapping the pin opens a callout that names the problem; Select it closes it.
- [x] The Checks chip opens the Checks list.
- [x] Canvas editor off: the drawing shows no pins.
- [x] Every new text has its Russian entry; `pnpm typecheck` passes.
- [x] `tools/problem-pins/find-it.mjs` passes at 360 and 390 px from the bare app.
