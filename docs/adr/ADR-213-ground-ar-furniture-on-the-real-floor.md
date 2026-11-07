# ADR-213: Ground AR furniture on the real floor

- Status: Pending
- Date: 2026-11-07
- Depends on: ADR-208
- Design: docs/ui-design.md (3D view, ⋯ menu, AR overlay)
- Backlog: N218
- Acceptance: browser

## Context

User, 2026-11-07: "Enhance ar corners/floating/accuracy". Follows [ADR-208](../adr-done/ADR-208-room-surfaces-plan-tracing-placed-3d-models-and-ar.md)
(View in AR) and the tap fix of PR #190. Answers to the questions asked the same day:

- Floating: "Hovers above floor", "Drifts as I walk", "Doesn't look grounded".
- Accuracy: "Better floor detection", "Size looks wrong" → "Bigger than real".
- Corners look wrong: "Jagged / stair-step edges".
- Exploded view: "As the 3D view" (AR keeps showing what the 3D view shows).
- Acceptance: "Browser script + phone".

ADR-208 placed the content where the first hit-test result fell, on any surface, with a static pose and no shadow.
The scale in code is 1:1 (1 mm = 0.001 m, `S` in `src/viewer/pieceDrag.ts`); a model hovering above the floor reads
as closer, so bigger. This ADR does not change ADR-208's decisions; it adds to how a pose is chosen and kept.

## Decision

1. **Floor hits only.** A hit-test result counts only when its surface faces up: the pose's up axis is within 15° of
   vertical. Walls, sloped and upside-down hits are ignored.
2. **Stable floor before the ring.** The ring shows only after 6 frames in a row with floor hits less than 3 cm
   apart in height; until then the hint says "Looking for the floor — move the phone slowly." The ring's position
   is smoothed (moves 35 % of the way to each new hit) so it does not jitter.
3. **Anchors.** The session asks for the optional `anchors` feature. On placing, an anchor is made from the
   hit-test result (`createAnchor`); each frame the content follows the anchor's pose, so when the phone refines
   the floor the furniture stays on it and does not drift. Without anchor support the pose stays fixed (as now).
4. **Grounding shadow.** In AR a soft dark shadow is drawn on the floor under the content's footprint
   (a display-only plane with a blurred-edge texture made on the device, about 6 cm past each side), so it looks set on
   the floor. Not exported, not shown outside AR.
5. **Sharper edges.** Before the session starts the XR framebuffer uses the phone's native scale
   (`XRWebGLLayer.getNativeFramebufferScaleFactor`, when offered), and the canvas keeps antialiasing.
6. **Scale stays 1:1** and is covered by a test: a 600 mm wide piece measures 0.6 m between its placed sides.

## Alternatives considered

- **Lock the floor at the lowest hit seen** — guesses wrong when the first stable surface is a low table; anchors
  follow the phone's own refined plane instead.
- **Real shadow-map shadows** — needs shadow maps in every look and a light that matches the room; a blurred
  footprint shadow reads as grounded at a fraction of the cost.

## Scope

- In scope: floor-only hits, stable-floor wait and smoothing, anchors, grounding shadow, native framebuffer scale,
  1:1 scale test, hints for each state.
- Out of scope: depth occlusion and light estimation (G-479); real-phone check (G-482).

## Consequences

- Positive: the furniture sits on the floor, stays put while walking, edges are sharper.
- Negative / risks: on phones without anchors it can still drift; the stable-floor wait adds about a quarter second.
- Harder to change later: nothing; all inside `src/viewer/AR.tsx`.

## Done when

- [ ] A wall or sloped hit-test result never shows the ring (unit test with simulated WebXR frames)
- [ ] The ring shows only after 6 steady floor frames; jittery heights keep "Looking for the floor" (unit test)
- [ ] With `anchors` offered, placing makes an anchor and the content follows its moved pose (unit test)
- [ ] The grounding shadow is in the scene only while AR is placed, sized to the footprint (unit test)
- [ ] A 600 mm piece spans 0.6 m in AR (unit test)
- [ ] Browser find-it (`tools/ar/find-it.mjs`, stubbed WebXR) at 390 and 1280 px finds View in AR and the new hints
