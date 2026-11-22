# ADR-290: Turn the canvas editor on by default on phones

- Status: Implemented
- Date: 2026-11-22
- Implemented: 2026-11-22
- Depends on: ADR-289
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec, slice 7: the sheet's place)
- Backlog: N373
- Acceptance: browser

## Context

ADR-283 put the canvas editor behind a device flag that is "off by default"; ADR-284 to ADR-289 built the rest of it.
Asked what should happen to the phone sheet (G-580), the user chose on 2026-11-22: "Canvas on by default
(Recommended)" — the new editor is the default and the More switch can still bring back the sheet. This changes
ADR-283's default; ADR-283 is implemented and is not edited.

## Decision

1. On a phone the canvas editor is on unless the device has chosen the sheet: `fb:canvasEditor` reads on for anything
   but a stored `off` (an unreadable store also reads on).
2. ⋯ More › "Canvas editor (preview)" stays: turning it off stores `off` and brings back the sheet, as before.
3. A first visit therefore meets the first-run hints (ADR-289).
4. The sheet is not removed; its jsdom find-it tests choose it the way the More switch does (`tests/find-it/setup.tsx`),
   and the canvas editor keeps its browser scripts, which start from the sheet and turn the editor on from More.

## Alternatives considered

- **Remove the sheet** — not chosen by the user; it cannot be switched back.
- **Keep the preview off by default** — not chosen.

## Scope

- In scope: the default, the test setup, the scripts' starting point.
- Out of scope: removing the sheet (the user chose not to, G-580).

## Consequences

- Positive: every phone user gets the canvas editor without finding a switch.
- Negative / risks: people used to the sheet meet a new editor; the switch brings it back.

## Done when

- [x] A first visit on a phone shows "Getting started", then the chip rail and ladder, and no peek row.
- [x] A stored `off` brings back the sheet; the More switch still turns it on and off (unit test and scripts).
- [x] The jsdom find-it suite passes with the sheet chosen in its setup.
- [x] The seven canvas browser scripts pass at 360 and 390 px.
