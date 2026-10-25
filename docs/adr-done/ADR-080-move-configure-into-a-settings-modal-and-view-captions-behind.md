# ADR-080: Move Configure into a settings modal and view captions behind an info icon

- Status: Implemented
- Date: 2026-10-25
- Implemented: 2026-10-25 (Merged in PR #55 (ae82326); light acceptance, find-it pending (ADR-066))
- Depends on: ADR-079
- Design: docs/ui-design.md (§3 Components and states, §4 Screens: projects, editor)
- Backlog: N75
- Acceptance: light

## Context

The user, 2026-10-25, with a phone screenshot of a project in Compose: "Add a tooltip icon with the text on-hover
on desktop and onclick on mobile, so the 2d views fit right, also move configure tab content to build and review,
2 tabs remain."

Revised the same day: "Re-do the adr to have the entire content of configure to be moved to a settings icon with
a modal onclick to change the configuration, it should be visible on the projects list." This replaces the first
draft's "Configure section inside Build & Preview".

On a 390 px phone the plan ("Seen from above. The yellow edge is each piece's front; …", seven lines) and the room
front view ("Seen from the front. Sizes in mm: …") carry captions under the drawings (`src/ui/Project.tsx`
figcaptions) that push the front view below the fold.

This changes [ADR-079](../adr-done/ADR-079-split-the-editor-into-compose-configure-and-build-preview-ph.md) (implemented), Decision 2 ("Configure: what it is made of") and 4–5: there is no Configure mode; its content moves
to a settings modal. ADR-014 is kept.

Requirement ledger (user's words):

- R-a "Add a tooltip icon with the text on-hover on desktop and onclick on mobile"
- R-b "so the 2d views fit right"
- R-c "2 tabs remain"
- R-d "the entire content of configure to be moved to a settings icon with a modal onclick to change the
  configuration"
- R-e "it should be visible on the projects list"

## Decision

1. **Info icon for view captions.**
   - Each 2D view caption (project plan, project front view, any piece drawing caption) is replaced by an info
     button (`ⓘ`, ≥ 44 px target) at the drawing's top-right. Names: _About the plan_ / _About the front view_.
   - Desktop (hover-capable pointer): the text shows on hover and on focus; hides on leave, blur or Esc.
   - Touch: a tap toggles it; tapping outside, tapping again or Esc closes it.
   - The Snap status line under the plan's Snap button (user decision 2026-10-25) moves into the plan's
     popover: its idle text ("Pieces go exactly where dropped." / "Snaps within 60 mm …") is shown first, then the
     caption. While a piece is being dragged, the live snap feedback ("Snaps: …", "Alt held: placing freely.")
     shows as an overlay on the plan, removed on drop, so it takes no layout space.
   - The text is unchanged and shown as a popover over the drawing, so the drawing never moves. It stays inside
     the viewport at 390 px. The button has `aria-expanded`/`aria-controls`.
2. **Two modes: Compose · Build & Preview.** The Configure segment is removed. Both modes are otherwise unchanged.
   A stored `fb:mode` of `configure` opens Compose.
3. **Settings modal.**
   - A settings button (gear icon, name _Settings_) sits in the editor app bar next to Undo/Redo, at every width.
   - It opens a modal (the shared `Dialog`; full screen on phones) holding **all** of Configure's former content
     in its former order:
     - piece: steps rail, Size, Construction, Materials (Add a material, kerf, decor CSV), Drawers and runners,
       _Open in wizard_;
     - project: the project-wide settings (finish scope, Run parts, kerf);
     - a piece opened from a project: the piece settings.
   - Changes apply live, as in Configure today: each is an undo step, autosaved, and checked (ADR-008 unchanged:
     an error shows in the modal and in Checks, nothing is clamped). The modal has one _Done_ button and closes
     on Esc.
   - Steps-rail jumps for Size, Build and Boards open the modal at that section; Inside goes to Compose.
4. **Settings on the projects list.**
   - Each row under _Projects_ and _Single pieces_ gets a gear button, _Settings for <name>_, next to Duplicate
     and Delete.
   - It opens the same modal for that stored project or piece without leaving the list. Changes are validated
     like an import (ADR-011) and saved to that row with `saveProject`/`saveDesign`; a design the app cannot read
     shows the error and is never rewritten (ADR-012).
   - For the item open now, it edits the open copy, so the editor and the list never disagree.

No change to `src/core`, the design document, the model or the Dexie schema.

## Alternatives considered

- **Configure section inside Build & Preview** — first draft; replaced by the user's revision.
- **Native `title` tooltip** — does not open on touch and is not keyboard reachable.
- **Settings only in the editor** — the user asked for it on the projects list too.
- **Open the project in the editor when the list gear is tapped** — slower; the user asked for a modal.

## Scope

- In scope: info button + popover and a settings button in `src/ui/controls.tsx`; the Configure panel moved into
  a modal reused by the editor and `src/ui/shell/ProjectsPage.tsx`; two-segment mode control; `fb:mode` fallback;
  steps-rail targets; `docs/ui-design.md`; `tests/ui-mode.test.ts`; `tools/settings-modal/find-it.mjs`.
- Out of scope: the wording of captions and settings; 3D controls; other Compose content.

## Consequences

- Positive: both 2D views fit on a 390 px phone; two modes; settings reachable from the list.
- Negative / risks: settings are one tap away instead of a tab; edits from the list have no undo once the
  modal closes (history is not stored, ADR-051).
- Harder to change later: nothing stored changes shape.

## Done when

- [ ] Project plan and front view render no caption text; each has an info button _About the plan_ / _About the
      front view_ that shows the original text on hover/focus at 1280 px and on tap at 390 px, closes on outside
      tap or Esc, with no horizontal scroll (light — catch-up).
- [ ] No Snap status line under the Snap button; the plan's popover starts with "Pieces go exactly where dropped."
      when Snap is off; while dragging, "Snaps:" shows over the plan and disappears on drop (light — catch-up).
- [ ] At 390 × 844 px in a project's Compose, the plan and the front view are both fully visible (light — catch-up).
- [ ] The mode control shows exactly _Compose_ and _Build & Preview_ (light — catch-up); a stored `fb:mode` =
      `configure` opens Compose and steps-rail Size opens the modal (`tests/ui-mode.test.ts`).
- [ ] The editor bar's _Settings_ opens a modal with _Width_, _Construction_, _Add a material_ and _Drawers_ for a
      piece, and the project-wide settings for a project; changing Width updates the drawing (light — catch-up).
- [ ] Every Projects and Single pieces row has _Settings for <name>_; changing a value there and reopening the
      item shows the new value (light — catch-up).
- [ ] An invalid value in the modal shows its error, is not clamped, and blocks Download CSV (tests).
- [x] Lint, format, typecheck, tests, build and docs check pass.

## Open questions

- The list gear on a piece inside a project: not offered (default; open the project); or list pieces too?
- Editing from the list: apply live (default) or Save/Cancel buttons in that modal?
