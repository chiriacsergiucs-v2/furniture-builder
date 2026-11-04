# ADR-169: Turn a piece to any whole degree with a handle on the plan

- Status: Implemented
- Date: 2026-11-04
- Implemented: 2026-11-04
- Depends on: ADR-065, ADR-121, ADR-160
- Design: docs/ui-design.md (section 4, Project: the plan)
- Backlog: N172
- Acceptance: browser
- Agreed: 2026-11-04 "Validate all High demand features, analyze compatibility with app state/direction, create
  adrs"; answer "Free-angle turn handle"

## Context

The research feature _Direct manipulation in 2D/3D_ (High demand, P0) is _in progress_ with one missing part:
"rotating by dragging (any angle can be typed, ADR-121)". Pieces can stand at any whole degree since ADR-121
(`rotationY` quarter turn plus `angle` 1–89), but the typed field is hidden (ADR-160, G-311 "Keep hidden"), the
0/90/180/270 buttons are gone (ADR-160) and the only ways to turn are Turn ↺ / ↻ and R / Shift+R (quarter turns).
G-018 asks for a turn handle on the plan. User (2026-11-04): a free-angle turn handle.

## Decision

- **Handle:** the selected piece on the plan (one piece selected, not locked, not a display-only model) gets a
  round **Turn** handle on a short stem from the front-centre of its outline, 44 px touch target, drawn in the
  selection colour. Dragging it turns the piece about its centre: the angle is the whole degree of the pointer
  about the centre, taken from the piece's angle at press (no jump at press). Snaps to the nearest quarter turn
  within 5°, so an axis-aligned piece stays axis-aligned when the drag ends near it; **Shift** steps by 15°; the
  current angle shows in a small label by the handle while dragging ("37°").
- **Model:** `splitRotation(deg)` (ADR-121) stores the result as `rotationY` + `angle`; the piece turns about its
  centre, position recomputed as `setRotation` does today; whole millimetres (ADR-003). One undo step "Turn Base
  600" per drag (ADR-123 names); Esc during the drag restores the angle at press and ends the drag without
  selecting or deselecting anything.
- **Gesture:** `src/ui/planDrag.ts` gains a `turn` gesture beside `move` (same press / threshold / release shape);
  the plan's pointer handlers route the handle's pointer to it. Keyboard: with the piece selected, **[** and **]**
  turn by 1°, with Shift by 15° (R / Shift+R keep the quarter turns, ADR-160).
- **Snap, runs, checks:** unchanged. An angled piece keeps ADR-121's limits (enclosing-box snapping G-170, not in
  runs G-171, 3D outlines G-172, no side-by-side connections ADR-168); the plan tooltip of the handle says "Pieces
  at an angle do not join runs or snap side by side".
- **Esc bug (G-018):** Esc that cancels a plan drag also suppresses the click that follows, so the piece is not
  re-selected (test in `tests/plan-drag.test.ts`).
- Research record: _Direct manipulation in 2D/3D_ becomes Verified when this ships; 3D Move mode stays at quarter
  turns (ADR-093, by choice).

## Alternatives considered

- **90° step handle** — matches "Keep hidden" for typed angles but not the research row ("rotate by dragging");
  the user chose free angles.
- **Show the typed field again** — the user chose to keep it hidden (G-311); the handle does not change that.
- **Turning in 3D Move mode by dragging** — needs a gizmo in the 3D view (ADR-093 turns by button); G-332.

## Scope

- In scope: the handle, the turn gesture, quarter-turn snap and Shift steps, the angle label, [ ] keys, undo name,
  Esc fix, tests.
- Out of scope: turning by dragging in 3D (G-332); showing the typed Rotation field again (G-311, user "Keep
  hidden"); any change to how angled pieces snap or join runs (G-170, G-171, G-172).

## Consequences

- Positive: the last missing part of the P0 research row; an angled piece no longer needs a file to get its angle.
- Negative / risks: a handle on every selected piece adds one element to the plan; a slip of the finger turns a
  piece by a degree, which the quarter-turn snap and undo limit.
- Harder to change later: the key bindings [ and ] become habit.

## Done when

- [x] A drag of the handle from 0° to pointer angle 37° stores `rotationY` 0, `angle` 37; from 88° it snaps to 90°
      (planDrag tests)
- [x] Shift steps by 15°; [ and ] turn by 1° and Shift by 15°; the piece turns about its centre in whole mm (tests)
- [x] One undo step per drag named "Turn <piece>"; Esc restores the angle and the following click does not select
      (tests)
- [x] The handle is absent on a locked piece, a display-only model and with 2+ selected (tests)
- [x] The handle and the angle label are visible on the plan at 390 and 1280 px (browser find-it)
- [x] Russian entries for every new text; the feature tree line "Pieces at any whole-degree angle" is updated
