# ADR-289: Find an action and first-run hints in the canvas editor

- Status: Pending
- Date: 2026-11-22
- Depends on: ADR-288
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec, slice 7: Find and coach marks)
- Backlog: N372
- Acceptance: browser

## Context

Slice 7 of the canvas-native phone editor (ADR-283, G-577; user 2026-11-22: "Proveed slices"). In the design the first
chip, a magnifier, finds any action by name, and three coach marks explain the new gestures on first use. Until now the
magnifier opened the card on its tab list (ADR-283). The design's last step, removing the phone sheet, deletes the
sheet the app uses today; it is left for the user to decide (G-580).

## Decision

While the canvas editor is on (ADR-283):

1. **Find an action.** The magnifier opens a search dialog. "Open here" lists what the editor can open now (Overview,
   the selection's blocks, the five results) and opens it. "All features" lists the lines of the feature tree (ADR-158)
   that match every typed word, case and accents ignored, each with its path; a tap shows its description. Esc closes.
2. **First-run hints.** The first time the canvas editor shows in Compose on a device, a three-step dialog explains
   selecting, the size tags and handles, and the chips; Skip or Start ends it for good on that device.
3. **The sheet stays.** The flag still chooses between the canvas editor and the sheet (G-580).

## Alternatives considered

- **Search running feature actions directly** — the feature tree describes features, it holds no actions; opening what
  is here plus describing the rest stays honest.
- **Hints as tooltips on each control** — they would cover the drawing; one short dialog is skippable.

## Scope

- In scope: Find, the hints, updating the earlier find-it scripts to skip the hints.
- Out of scope: removing the phone sheet or turning the canvas editor on by default (G-580).

## Consequences

- Positive: every feature can be found by name from the editor.
- Negative / risks: a feature without a block here is described, not opened.

## Done when

- [x] First canvas use shows "Getting started", steps 1 to 3, ending with Start; it does not come back.
- [x] The magnifier opens "Find an action"; typing "cont" and tapping Contents opens the Contents block.
- [x] Find › Sheets opens the Sheets card.
- [x] Typing "mirror" lists features; a tap shows the description; Esc closes Find.
- [x] Every new text has its Russian entry; `pnpm typecheck` passes; matching has unit tests.
- [x] `tools/find-action/find-it.mjs` passes at 360 and 390 px, and the six earlier canvas scripts still pass.
