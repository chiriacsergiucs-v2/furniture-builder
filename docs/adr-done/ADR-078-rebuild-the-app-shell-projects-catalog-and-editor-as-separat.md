# ADR-078: Rebuild the app shell: Projects, Catalog and Editor as separate places, with files in one menu

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-25 (Merged to main; CI run 40170561018 and Deploy GitHub Pages run 40170561007 green on 895eb54)
- Depends on: ADR-030
- Design: docs/ui-design.md (§4 Screens: shell), docs/research/2026-10-24-ui-redesign-audit.md (§3)
- Backlog: N73

## Context

The user, 2026-10-24: "ui/ux new from scratch build … based on competitors derive what is the easiest layout …
optimise mobile view, keep domains of catalog/item/project cleanly separate but available, make the import/export ui
accessible from somewhere else to declutter the top and bottom."

The audit is in `docs/research/2026-10-24-ui-redesign-audit.md` (U1–U4, U6, U7). On a phone the top bar wraps to
2–3 rows and the fixed bottom bar holds 8 actions. Import and export are spread over five places. Saved things are
split between Home and the Library dialog. Projects and pieces share one page, with banners on top.

This changes part of [ADR-030](../adr-done/ADR-030-one-token-set-with-light-and-dark-themes-a-component-layer-a.md)
(item 4: "at ≤ 760 px the actions sit in a fixed bottom bar"; user decision 2026-10-23 "phone bottom bar"). Phones
keep a bottom bar, but it carries the three places instead of actions. Tokens, components and themes from ADR-030
are unchanged.

## Decision

Write a new shell from scratch in `src/ui/shell/` and rewrite `App.tsx` to use it. Existing page and editor
components are reused as content.

1. **Three places**, hash-linked, one tap away anywhere:
   - **Projects** (`#projects`, and the bare address): merges Home and the Library dialog. It lists projects and
     single pieces, with New project, New piece, open, duplicate, delete, Clean up unused pictures and Import a file.
   - **Catalog** (`#catalog`): unchanged content.
   - **Editor** (`#editor`): the open project or item.

   Old links keep working: `#editor` and `#catalog` as before, and the bare address now shows Projects.

2. **Navigation.** Phones (≤ 760 px) get a fixed bottom nav, one row, with icons and labels _Projects · Catalog ·
   Editor_. Wider screens show the same three as tabs in the top bar.
3. **App bar, one row.** It shows the path in place of the banners:
   - a project: `‹ Project`
   - an item in a project: `‹ Project › Item`
   - a template variant: `‹ Template › Variant`

   The name is editable on the last segment. The template banner's Save to template / Cancel buttons move into the
   bar. The bar also holds the status dot (the failed text always shows), Undo, Redo, the theme toggle (see open
   question R3) and a ⋯ **More** menu.

4. **Files in one menu.** ⋯ → **Files** holds Export design file / Export project file, Front view drawing (SVG),
   Fusion 360 script and Import a file. Projects also has Import a file. Template import/export moves into a ⋯
   menu on the Catalog toolbar. Decor CSV stays in Materials (configuration) and the research files stay in
   Feature Research. No import or export control stays in the top or bottom bar.
5. **Feature Research** moves from a page tab into ⋯ → _Feature Research_ (`#research` still works).
6. Print and Parts CSV leave the bars. [ADR-079](../adr-done/ADR-079-split-the-editor-into-compose-configure-and-build-preview-ph.md)
   puts them on the Parts list, still blocked by errors (ADR-008).

## Alternatives considered

- **Keep the layout, shrink the labels.** This was done in ADR-030. The bars still wrap, and the five file places
  stay.
- **A hamburger drawer for everything.** It hides the three places, and the user asked for them to be "available".
- **Four bottom tabs including Research.** Research is a maintainer tool. It would crowd the bar at 360 px.

## Scope

- In scope: `src/ui/shell/*` (AppBar, BottomNav, MoreMenu, ProjectsPage), `App.tsx`, the shell CSS in `styles.css`,
  and moving the Library dialog content to Projects. Update `docs/ui-design.md` §4 and the feature inventory.
- Out of scope: the editor's inner layout (ADR-079); Catalog and Research content; `src/core`, `src/store` actions
  and Dexie (no storage change); the 3D viewer.

## Consequences

- Positive: one-row bars on phones, so the drawing gets about twice the height. One place for files. Clean domain
  boundaries.
- Negative / risks: Parts CSV takes one more tap on a phone. Users of Home and Library must relearn where things
  are, so every old label is kept as text on Projects.
- Harder to change later: the hash routes (`#projects`).

## Done when

- [x] At 390 px the top app bar is one row and the bottom nav is one row with _Projects_, _Catalog_, _Editor_.
      At 1280 px the three show as top-bar tabs (find-it).
- [x] The top and bottom bars contain no import or export control. ⋯ → _Files_ lists _Design file_ (or _Project
      file_), _Front view drawing_, _Fusion 360 script_ and _Import a file_, and each one works (find-it, using the
      same file names as today).
- [x] _Projects_ lists saved projects and pieces with open, duplicate, delete and _Import a file_. The Library and
      Home content is gone from elsewhere, and nothing it did is lost (find-it, plus the existing `tests/persist.test.ts`).
- [x] Editing an item in a project shows `‹ <project> › <item>` in the app bar. Tapping the project segment returns
      to the project (find-it). The template variant path offers Save to template and Cancel (find-it).
- [x] _Feature Research_ opens from ⋯. `#editor`, `#catalog` and `#research` links still open their pages.
- [x] No horizontal page scroll at 360 and 390 px. Focus is visible on every nav and menu item. Escape closes ⋯.
- [x] `tools/shell/find-it.mjs` passes on the production build at 390 and 1280 px. All CI checks pass.

## Answers (user, 2026-10-24: "Proceed", every default accepted)

- R1: new shell and layouts; field editors reused. R2: Feature Research in ⋯. R3: theme toggle stays in the app
  bar. R4: no CSV shortcut in the app bar. R5: full acceptance (find-it).
