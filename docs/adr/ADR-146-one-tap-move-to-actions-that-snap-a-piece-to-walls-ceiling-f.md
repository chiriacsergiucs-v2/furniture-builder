# ADR-146: One-tap Move to actions that snap a piece to walls, ceiling, floor and neighbours

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-058, ADR-070, ADR-093
- Design: docs/ui-design.md (Project editor, piece panel; 3D view toolbar)
- Backlog: N147
- Acceptance: browser

## Context

The user, 2026-10-29: "add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest
left piece, snap to closest right piece, and any other snaps you think would be appropriate slash useful."

[ADR-070](../adr-done/ADR-070-snap-a-dragged-piece-to-neighbours-and-walls-with-a-preview.md) snaps a piece only
while it is dragged, within 60 mm. There is no way to send a piece to a wall or neighbour that is further away,
and no vertical snap at all. User answers 2026-10-29: buttons in the piece panel and in the 3D Move toolbar
([ADR-093](../adr-done/ADR-093-move-and-turn-project-pieces-in-the-3d-view.md)); directions follow the piece's own
front; a floor piece sent to the ceiling becomes wall-hung; extras: down to floor / onto piece below, into nearest
corner, align top / front with neighbour, centre between neighbours.

## Decision

- **Pure core** `src/core/moveTo.ts`: `moveTo(project, id, action): MoveResult` and
  `moveToOptions(project, id)` (each action enabled, or disabled with a reason). Integer mm; no UI geometry (ADR-004).
- **Directions from the piece's front** (rotationY): _left_ / _right_ as you face its front, _back_ = behind it.
  A piece turned 90° onto a side wall moves along that wall.
- **Slide until contact:** the piece moves in that direction until it touches the first obstacle whose outline
  overlaps its path in plan **and** in height: a room wall ([ADR-058](../adr-done/ADR-058-the-project-has-a-room-walls-doors-windows-and-obstacles-chec.md)) or another piece. No distance limit (unlike the 60 mm drag range).
  Nothing in the way → disabled, "Nothing on its left".
- **Actions:**
  - **To wall** — slide back until it touches the wall (or a piece) behind it.
  - **To left piece / To right piece** — slide left / right until it touches the first piece (or wall) there.
  - **To ceiling** — top at the room height. Wall-hung: its height changes. Floor piece: placement becomes
    wall-hung at `room.height − h` (user answer). Stacked pieces: see open question.
  - **Down** — a wall-hung piece drops until it meets the first piece under it (sits on it, `above`, gap 0) or the
    floor (placement becomes floor).
  - **Into corner** — _To wall_, then slide toward the nearer side (left or right) until contact; one undo step.
  - **Align top** / **Align front** — match the top height / front line of a neighbour (open question: which).
  - **Centre** — centred between what it touches when sliding left and right (wall or piece); odd mm rounds left.
- **Refused, with the reason, never silent** (ADR-008): a locked piece shows `LOCKED_HINT` (ADR-095); no room
  drawn → wall, corner and ceiling are disabled, "Draw the room first"; carried pieces follow `moveBlocked`.
- **UI:** a "Move to" button row in the piece panel's Position group; the same buttons in the 3D toolbar while
  Move is on and a piece is selected (next to Turn 90°). Each tap is one undo step (ADR-051); the Snap toggle does
  not affect them. Disabled buttons carry their reason as `title` and a visible hint.

## Alternatives considered

- **Larger drag snap range** — still needs a drag; no vertical moves.
- **Room-axis directions** — rejected by the user: a piece on a side wall would move the wrong way.
- **Store connections** — ADR-070 already rejected stored connections; positions are enough.

## Scope

- In scope: the actions above, their reasons, panel row and 3D toolbar buttons.
- Out of scope: these actions on the 2D plan as an overlay bar (G-283); moving several selected pieces at once
  (G-284).

## Consequences

- Positive: one tap lines pieces up at any distance, and up or down, without a drag.
- Negative / risks: nine more buttons; on a phone the row wraps. Placement can change (floor ↔ wall-hung).
- Harder to change later: nothing stored; pure functions only.

## Done when

- [ ] Each action on a turned piece (0/90/180/270) moves it to contact with the first wall or piece in the way,
      whole mm (unit tests)
- [ ] To ceiling turns a floor piece wall-hung at room height − h; Down lands on the piece below or the floor
      (unit tests)
- [ ] Locked piece, no room, nothing in the way: disabled with the reason and the project unchanged (unit tests)
- [ ] One undo step per tap (store test)
- [ ] "Move to" buttons in the panel and in the 3D Move toolbar found at 390 and 1280 px; a tap moves the piece
      (browser find-it, `tools/move-to/find-it.mjs`)
- [ ] All CI checks pass; `FUZZ_N=30000` fuzz passes

## Open questions

- Stacked (`above`) piece, sideways and ceiling moves (G-285): (a) move along its base by changing `offsetX`, lift
  off for ceiling; (b) lift it off and move it freely; (c) disabled, "moves with the piece under it". Suggested:
  (a), closest to "move a piece" while keeping it on its base (estimate +10 % work).
- Align top / front: which neighbour (G-286): (a) four buttons, align with left / right neighbour; (b) the nearer
  neighbour by gap, left on a tie. Suggested: (a), it says exactly which piece (estimate +5 % work, clearer).
- A piece turned by a free angle (ADR-121, not a quarter turn) (G-287): (a) all actions disabled, "turned
  freely"; (b) vertical actions only. Suggested: (b), keeps ceiling and floor working (estimate +3 % work).
