# ADR-218: AR walls, wall gap, occlusion, light, finger drag and per-piece sizes

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: ADR-213, ADR-214, ADR-215
- Design: docs/ui-design.md (3D view, AR overlay)
- Backlog: N223
- Acceptance: browser

## Context

User, 2026-11-07: "Implement what was skipped, all in 1 adr/pr, single test run". The skipped items of
[ADR-213](../adr-done/ADR-213-ground-ar-furniture-on-the-real-floor.md),
[ADR-214](../adr-done/ADR-214-place-ar-furniture-by-a-corner-or-into-a-room-corner.md) and
[ADR-215](../adr-done/ADR-215-fine-tune-ar-placement-and-show-its-dimensions.md): G-477 to G-481. G-482 (the
real-phone check) is the user's to run and stays open. Written as ADR-217 / N222; renumbered to ADR-218 / N223 before merging, when `main` took both ids. Answers to the questions asked the same day:

- Walls (G-477): "Auto corner + fallback".
- Wall gap (G-478): "Stepper ±5 mm".
- Realism (G-479): "Both" (depth occlusion and light estimation).
- Drag (G-480): "One-finger drag".
- Sizes (G-481): "Switch Overall/Per piece".
- Acceptance: "Unit + browser, once each": the full suite and the browser script run once at the end.

## Decision

1. **Auto room corner.** Two more hit-test rays leave the phone up-left and up-right of the centre. In Room corner
   mode, when both hit walls (surface within 15° of vertical) whose faces differ by more than 60°, the hint says
   "Both walls found — tap to place in the corner." One tap then places it: the corner is where the two walls meet at
   the tapped floor height; the back goes against the wall the phone faces more squarely, the side against the other.
   Without both walls, the two floor taps of ADR-214 stay.
2. **Wall gap.** "Wall gap: 0 mm" with − and + (5 mm steps, 0 to 200 mm), shown in Room corner mode and once placed by a
   corner. The back and the wall side stand that far from the walls; changing it once placed moves the furniture.
   It starts at 0 mm each AR session.
3. **Depth occlusion.** The session asks for optional `depth-sensing` (CPU depth, luminance-alpha or float32). Once
   placed, each frame's depth is drawn into the depth buffer before the furniture, 4 cm (or 3 % of the distance)
   behind the measured surface, so real objects in front hide it. "Hide behind real objects: On / Off" switches it,
   shown only when the phone gives depth (a safety switch while it is unchecked on a phone, G-482).
4. **Light estimation.** The session asks for optional `light-estimation`; once placed, the room's main light and
   ambient light (spherical harmonics) replace the 3D view's lights, as three's `XREstimatedLight` does.
5. **One-finger drag.** Once placed, touching the screen and dragging slides the furniture across the floor under the
   finger (transient-input hit test, floor hits only); its turn is kept. The buttons stay for the last centimetre.
6. **Sizes switch.** "Sizes: Overall" cycles Overall → Per piece → Off. Per piece labels each piece "W × H × D mm"
   above its top front edge; a single piece shows one label.

## Alternatives considered

- **Back to wall button** — one wall at a time and no corner; the user chose the auto corner.
- **Separate back and side gaps** — more controls for a rare case.
- **three's GPU depth path** — made for headsets (texture arrays); Android Chrome gives CPU depth.

## Scope

- In scope: the six items above, their hints and buttons, Russian text, feature lines.
- Out of scope: the real-phone check (G-482).

## Consequences

- Positive: corners, skirting, real objects and room light are taken into account; moving it is direct.
- Negative / risks: depth and light vary by phone and are unchecked on a device until G-482; the switch turns
  occlusion off if it misbehaves.
- Harder to change later: nothing; all in `src/viewer/AR.tsx` and `src/viewer/arPlace.ts`.

## Done when

- [x] Two wall hits meeting at more than 60° give the corner and the back wall; fewer walls keep the two-tap fallback
      (unit test)
- [x] The wall gap moves the back and the wall side by the gap, also after placing (unit test)
- [x] With depth offered, the occluder gets each frame's depth; the switch hides it (unit test)
- [x] A light estimate sets the light's colour, intensity and direction and hides the view's lights (unit test)
- [x] A one-finger drag moves the placement by the finger's floor movement, keeping its turn (unit test)
- [x] Sizes cycles Overall → Per piece → Off with the right labels (unit test)
- [x] Browser find-it at 390 and 1280 px finds the walls hint, the wall gap stepper, Sizes and the occlusion switch
