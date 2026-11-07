# ADR-215: Fine-tune AR placement and show its dimensions

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: ADR-208, ADR-213
- Design: docs/ui-design.md (3D view, AR overlay)
- Backlog: N220
- Acceptance: browser

## Context

User, 2026-11-07: "Enhance ar corners/floating/accuracy". Answers to the questions asked the same day:

- Accuracy: "Fine-tune after placing", "Show dimensions".
- Fine-tune: "Buttons 1 cm/10 cm, 1°/15°".
- Dimensions: "Overall W × H × D".

Today ([ADR-208](../adr-done/ADR-208-room-surfaces-plan-tracing-placed-3d-models-and-ar.md)) the placed content can
only turn 90°; to correct it the user exits AR.

## Decision

1. **Fine-tune buttons** once placed, relative to the furniture (not the phone):
   - Move: ← Left, → Right (along its width), ↑ Back, ↓ Forward (along its depth).
   - Turn: ↺ and ↻ about its centre.
   - A step switch "Step: 1 cm / 1°" ↔ "Step: 10 cm / 15°". Turn 90° ↻ stays.
   - "Place again" goes back to placing with the same point and mode.
2. **Dimensions.** While placed, the overall width, height and depth of what is shown are labelled in mm on the
   content: width along the front bottom edge, height up the front left edge, depth along the left bottom edge.
   Labels are 3D text (made on the device, no fonts downloaded), face the phone, and are display-only.

## Alternatives considered

- **Finger drag** — faster for big moves, imprecise; recorded as G-480.
- **Per-piece labels** — clutter on a phone; recorded as G-481.

## Scope

- In scope: move and turn buttons, step switch, Place again, overall W × H × D labels, Russian text.
- Out of scope: finger drag (G-480), per-piece dimensions (G-481), real-phone check (G-482).

## Consequences

- Positive: placement is correctable to 1 cm and 1° without leaving AR; size is checkable against a tape.
- Negative / risks: more buttons in the overlay on a phone; they fold into one bottom panel.
- Harder to change later: nothing.

## Done when

- [x] Left/Right/Back/Forward move the content 1 cm or 10 cm along its own axes, whatever its turn (unit test)
- [x] ↺/↻ turn it 1° or 15° about its centre (unit test)
- [x] Place again returns to placing (unit test)
- [x] Labels show the shown content's width, height and depth in mm (unit test)
- [x] Browser find-it at 390 and 1280 px finds the move, turn, step and Place again buttons with no horizontal scroll
