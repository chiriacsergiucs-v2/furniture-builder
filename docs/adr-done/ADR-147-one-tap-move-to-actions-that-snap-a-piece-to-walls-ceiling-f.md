# ADR-147: One-tap Move to actions that snap a piece to walls, ceiling, floor and neighbours

- Status: Implemented
- Date: 2026-10-29
- Implemented: 2026-10-29 (Merged to main via PR #129 on the user's instruction ("Ship, merge now, no ci wait"); local evidence in N148)
- Depends on: ADR-058, ADR-070, ADR-093
- Design: docs/ui-design.md (Project editor, piece panel; 3D view toolbar)
- Backlog: N148
- Acceptance: browser

## Context

The user, 2026-10-29: "add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest
left piece, snap to closest right piece, and any other snaps you think would be appropriate slash useful."

[ADR-070](../adr-done/ADR-070-snap-a-dragged-piece-to-neighbours-and-walls-with-a-preview.md) snaps a piece only
while it is dragged, within 60 mm. There is no way to send a piece to a wall or neighbour that is further away,
and no vertical snap at all. User answers 2026-10-29: buttons in the piece panel and in the 3D Move toolbar
([ADR-093](../adr-done/ADR-093-move-and-turn-project-pieces-in-the-3d-view.md)); directions follow the piece's own
front; a floor piece sent to the ceiling becomes wall-hung; extras: down to floor / onto piece below, into nearest
corner, align top / front with neighbour, centre between neighbours. Answers 2026-10-29 to the open questions:
stacked piece "Slide along base" (G-295), align "Left / right buttons" (G-296), freely turned piece "Vertical only"
(G-297).

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
    wall-hung at `room.height − h` (user answer). A stacked piece lifts off, then rises.
  - **Down** — a wall-hung piece drops until it meets the first piece under it (sits on it, `above`, gap 0) or the
    floor (placement becomes floor).
  - **Into corner** — _To wall_, then slide toward the nearer side (left or right) until contact; one undo step.
  - **Align top ←/→** / **Align front ←/→** — match the top height / front line of the first piece on its left /
    right (four buttons; G-296).
  - **Centre** — centred between what it touches when sliding left and right (wall or piece); odd mm rounds left.
- **Stacked piece** (`above`, G-295): left, right, corner and centre slide it along its base by changing
  `offsetX`, with the base's ends as limits as well as the first piece in the way; To ceiling lifts it off first.
- **Freely turned piece** (ADR-121, G-297): only To ceiling and Down; the others are off, "Turned freely".
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
- Out of scope: these actions on the 2D plan as an overlay bar (G-289); moving several selected pieces at once
  (G-294).

## Consequences

- Positive: one tap lines pieces up at any distance, and up or down, without a drag.
- Negative / risks: nine more buttons; on a phone the row wraps. Placement can change (floor ↔ wall-hung).
- Harder to change later: nothing stored; pure functions only.

## Done when

- [x] Each action on a turned piece (0/90/180/270) moves it to contact with the first wall or piece in the way,
      whole mm (unit tests)
- [x] To ceiling turns a floor piece wall-hung at room height − h; Down lands on the piece below or the floor
      (unit tests)
- [x] Locked piece, no room, nothing in the way: disabled with the reason and the project unchanged (unit tests)
- [x] One undo step per tap (store test)
- [x] "Move to" buttons in the panel and in the 3D Move toolbar found at 390 and 1280 px; a tap moves the piece
      (browser find-it, `tools/move-to/find-it.mjs`)
- [x] All CI checks pass; `FUZZ_N=30000` fuzz passes

## Implementation

- Core: `src/core/moveTo.ts` (`moveTo`, `moveToOptions`, `MOVE_TO_ACTIONS`, `MOVE_TO_LABELS`); store `moveItemTo`
  (one undo step, refused taps set the notice and leave history alone).
- UI: `src/ui/MoveTo.tsx` (`MoveToButtons`), in the Position group of the piece panel and, behind a **Move to…** toggle,
  in the 3D toolbar while Move is on (so eleven buttons do not cover the view on a phone). An action that cannot move
  the piece stays tappable and marked off; a tap says why ("To left piece: Already touching …"), as phones have no
  hover. Already touching what it would slide to also counts as off.
- Grouped pieces (ADR-148, merged into `main` while this was open): a piece in a group takes its group along
  (`carryGroups`); its group-mates are not in its way, and the first of them to touch something stops the slide.
- Tests: `tests/move-to.test.ts` (25); browser find-it `tools/move-to/find-it.mjs` (24 checks at 1280 and 390 px).
