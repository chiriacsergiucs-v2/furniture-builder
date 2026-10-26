# ADR-091: Keep the results tabs collapsed until tapped so the views stay main

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-079, ADR-081
- Design: docs/ui-design.md (section 4, Build & Preview results tabs)
- Backlog: N89
- Agreed: 2026-10-26 "Only phones, next adr"; "Open it", "Always collapsed"

## Context

User request 2026-10-26, in their words: "Adr to Parts to sheets tabs. They should be a collapsed view, onclick
showing only, so the views with renders are kept as main".

Today Build & Preview ([ADR-079](../adr-done/ADR-079-split-the-editor-into-compose-configure-and-build-preview-ph.md))
shows the views (drawing, 3D, or both, [ADR-081](../adr-done/ADR-081-show-the-drawing-and-3d-side-by-side-from-the-view-switch.md))
and under them the results strip (`src/ui/Output.tsx`): Parts, Sheets, Hardware, Shopping list, Checks, with the
selected tab's content always open (Parts by default). The tables push the views aside, mostly on a phone.

User answers 2026-10-26:

- Scope: **the whole results strip** (all five tabs), not only Parts and Sheets.
- Closing: **tapping the open tab again** closes it.
- Errors: **stay collapsed, badge only**; nothing opens by itself.
- Acceptance level: **full** (find-it script, R3).
- Width: **only phones** (G-075).
- Settings cut-list link: **open it**.
- Reload: **always collapsed** (G-074).

## Decision

- The results section starts **collapsed**: only the tab row shows, with its badges (part count, Checks count).
  No tab is selected; the tab panel is not rendered.
- Tapping a tab opens the panel on that tab. Tapping another tab switches the content. Tapping the open tab
  again collapses the panel.
- The open state is UI state (`resultsOpen: boolean` beside `tab` in the design store), not saved and not part
  of the design document (no ADR-011 change). A reload starts collapsed (G-074).
- Diagnostics never open the panel. The Checks badge (red for errors, amber for warnings) stays the signal.
- One explicit user action still opens it: the Settings "cut list" link (`Inspector.tsx`, `go('cut')`) opens the
  panel on Checks or Parts as today, because the user asked to see the results.
- Accessibility: tabs keep `role="tab"`; while collapsed every tab has `aria-selected="false"` and
  `aria-expanded="false"`; the open tab has `aria-selected="true"`, `aria-expanded="true"`. Focus stays visible.
- Phones only (`max-width: 760px`, the phone layout of ADR-079; user answer, G-075). Desktop keeps today's
  layout: a tab is always open.
- Print and CSV stay inside the Parts panel; printing (`setPrinting`) does not depend on the panel being open.

## Alternatives considered

- **Collapse only Parts and Sheets** — the user chose the whole strip.
- **A bottom sheet over the views** — more work, covers the renders the user wants kept main.
- **Auto-open Checks on errors** — the user chose badge only.

## Scope

- In scope: `Output.tsx` collapse/expand, store flag, the Settings link, styles for the collapsed strip, tests,
  a find-it script.
- Out of scope: remembering the open state across reloads (G-074, user answer "Always collapsed").

## Consequences

- Positive: the drawing and 3D take the space in Build & Preview; results are one tap away.
- Negative / risks: find-it scripts that expect Parts open on load (e.g. those reading the parts table) need a
  tap on "Parts" first; they are updated in the same change.
- Harder to change later: nothing; UI state only.

## Done when

- [x] Store test: `resultsOpen` starts `false`; `toggleTab(t)` opens on `t`, switches on another tab, closes on
      the same tab; `setTab` from the Settings link opens the panel.
- [x] A design with an error diagnostic leaves the panel collapsed and the Checks badge shows the count (test).
- [x] Find-it (`tools/results-collapse/find-it.mjs`, production build, 390 and 1280 px): on the bare app in Build &
      Preview the text "Download CSV" is not visible and the tabs "Parts", "Sheets", "Hardware", "Shopping list",
      "Checks" are; tap "Parts" → "Download CSV" visible; tap "Sheets" → sheet content visible; tap "Sheets" again
      → collapsed; no horizontal page scroll at 390 px.
- [x] Existing find-it scripts that read the results are updated and pass (named in the backlog evidence).
- [x] lint, format:check, typecheck, test, build, docs:check pass.

## Open questions

None. Answered 2026-10-26: width "Only phones" (G-075).
