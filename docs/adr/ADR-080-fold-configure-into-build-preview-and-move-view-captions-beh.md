# ADR-080: Fold Configure into Build & Preview and move view captions behind an info icon

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-079
- Design: docs/ui-design.md (§3 Components and states, §4 Screens: editor)
- Backlog: N75

## Context

The user, 2026-10-25, with a phone screenshot of a project in Compose: "Add a tooltip icon with the text on-hover
on desktop and onclick on mobile, so the 2d views fit right, also move configure tab content to build and review,
2 tabs remain."

On a 390 px phone the plan ("Seen from above. The yellow edge is each piece's front; …", seven lines) and the room
front view ("Seen from the front. Sizes in mm: …") each carry a caption under the drawing (`src/ui/Project.tsx`
figcaptions). The captions push the front view below the fold, so the two 2D views do not fit on screen.

This changes [ADR-079](ADR-079-split-the-editor-into-compose-configure-and-build-preview-ph.md) (Pending, built,
not shipped), Decision 2–5: "The Editor gets three modes … 2. Configure: what it is made of." becomes two modes;
Configure's content moves into Build & Preview. ADR-014 is kept: the drawing is where you edit, 3D only selects,
stays lazy and mounts only when visible.

Requirement ledger (user's words):

- R-a "Add a tooltip icon with the text on-hover on desktop and onclick on mobile"
- R-b "so the 2d views fit right"
- R-c "move configure tab content to build and review"
- R-d "2 tabs remain"

## Decision

1. **Info icon for view captions.**
   - Every 2D view caption (project plan, project front view, and any piece drawing caption) is replaced by a
     small info button (`ⓘ`, the shared `Icon`, ≥ 44 px touch target) at the top-right corner of its drawing.
     Accessible name: _About the plan_ / _About the front view_.
   - Desktop (hover-capable pointer): the text shows on hover and on keyboard focus; it hides on leave, blur or
     Esc.
   - Phone / touch: tapping the icon toggles the text; tapping outside, tapping again or Esc closes it.
   - The text is unchanged, word for word, and shown as a popover over the drawing (not in the page flow), so
     opening it never moves the drawing. It stays inside the viewport at 390 px (no horizontal scroll).
   - The button carries `aria-expanded` and `aria-controls`; the popover is in the DOM only while open.
2. **Two modes: Compose · Build & Preview.**
   - The segmented control shows two segments. Compose is unchanged.
   - Build & Preview, item: 3D (unchanged, ADR-014), then a **Configure** section with Configure's former content
     in its former order (steps rail, Size, Construction, Materials with Add a material, kerf and decor CSV,
     Drawers and runners, _Open in wizard_), then the output tabs (Parts · Sheets · Hardware · Shopping list ·
     Checks).
   - Build & Preview, project: 3D, then **Configure** with the project-wide settings (finish scope, Run parts,
     kerf), then the outputs.
   - Desktop (≥ 1180 px): the left panel is Compose only; the Configure section sits at the top of the right
     Build column, above the outputs.
3. **Follow-ups of the merge.**
   - A stored `fb:mode` of `configure` opens Build & Preview (no error, no reset of other settings).
   - Steps-rail jumps for Size, Build and Boards go to Build & Preview › Configure; Inside still goes to Compose.
   - Tap-to-place and room drawing still switch to Compose (ADR-056, ADR-059).

No change to `src/core`, the design document, the model or storage.

## Alternatives considered

- **Shorter captions, always shown** — still costs lines on a phone, and the user asked for an icon.
- **Native `title` tooltip** — does not open on touch and is not keyboard reachable.
- **Configure as a tab in the output tab row** — six tabs overflow at 390 px; a section keeps the row as it is.
- **Keep three modes, collapse Configure on phones only** — the user asked for two tabs on every width.

## Scope

- In scope: info button + popover component in `src/ui/controls.tsx`; the plan and front-view captions; the
  segmented control; moving the Configure panel into Build & Preview for item and project; `fb:mode` fallback;
  steps-rail targets; `docs/ui-design.md` §3/§4; `tests/ui-mode.test.ts`; `tools/view-info/find-it.mjs`.
- Out of scope: any change to the text of captions or settings; the 3D viewer's own controls; Compose content;
  the Snap status line ("Pieces go exactly where dropped.") — kept as is unless the open question says otherwise.

## Consequences

- Positive: on a 390 px phone the plan and the front view both fit; one fewer mode to learn.
- Negative / risks: the caption help is one tap away; Build & Preview gets longer on phones (Configure sits
  between 3D and outputs).
- Harder to change later: nothing stored changes shape; the old `configure` mode value keeps being accepted.

## Done when

- [ ] No `<figcaption>` text is rendered under the project plan or front view; each has an info button named
      _About the plan_ / _About the front view_ (find-it, 390 and 1280 px).
- [ ] Desktop: hovering or focusing the button shows the original text; leaving or Esc hides it (find-it 1280 px).
- [ ] Phone: tapping shows the text, tapping outside hides it; no horizontal scroll at 390 px (find-it 390 px).
- [ ] At 390 × 844 px in a project's Compose, the plan and the front view are both fully visible without
      scrolling the drawing area (find-it, bounding boxes).
- [ ] The mode control shows exactly two segments, _Compose_ and _Build & Preview_; no _Configure_ segment
      (find-it, both widths).
- [ ] Build & Preview shows _Width_, _Construction_, _Add a material_ and _Drawers_ for a piece, and the
      project-wide settings for a project (find-it, both widths).
- [ ] A stored `fb:mode` = `configure` opens Build & Preview; steps-rail Size jumps to Build & Preview
      (`tests/ui-mode.test.ts`).
- [ ] Lint, format, typecheck, tests, build and docs check pass.

## Open questions

- Snap status line "Pieces go exactly where dropped." / "With Snap on …": keep it as a visible line (default) or
  move it into the plan's info popover?
- Configure section in Build & Preview on phones: expanded (default) or collapsed behind a _Configure_ heading?
- Order on phones: 3D → Configure → outputs (default), or 3D → outputs → Configure?
