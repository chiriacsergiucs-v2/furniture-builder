# UI redesign — audit, competitor patterns and proposed layout (2026-10-24)

Input for [ADR-078](../adr-done/ADR-078-rebuild-the-app-shell-projects-catalog-and-editor-as-separat.md) and
[ADR-079](../adr-done/ADR-079-split-the-editor-into-compose-configure-and-build-preview-ph.md). The user's request,
2026-10-24: "ui/ux new from scratch build, to Analyze what is there, based on competitors derive what is the easiest
layout, declutter composition from configuration, optimise mobile view, keep domains of catalog/item/project cleanly
separate but available, make the import/export ui accessible from somewhere else to declutter the top and bottom.
Improve usability of configure and build && preview".

Evidence labels: **code**: read from the source at commit `ed94ad6`. **doc**: read from a document or a search
summary. Nothing here was measured in a browser. The tap counts are counted from the code.

## 1. What is there (code)

| #   | Finding                                                                                                                                                                                                                                                         | Where                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| U1  | Phone top bar has brand, four page tabs (Home, Editor, Catalog, Feature Research), the name field, status and theme. It wraps to 2–3 sticky rows (`.bar { flex-wrap: wrap }`, name `min-width: 14ch`).                                                          | `src/ui/App.tsx:375-462`, `src/styles.css:3527`, `:3592`  |
| U2  | Phone bottom bar is fixed and holds 8 actions (Undo, Redo, New, Library, Materials, Export ▾, Print, Parts CSV). It wraps rather than hiding any of them (ADR-030, F18), so it can take two rows.                                                                | `src/ui/App.tsx:463-618`, `src/styles.css:2181`           |
| U3  | Below the top bar, the drawing is sticky at 50 vh (min 300 px). With 2–3 bar rows above and a 1–2 row action bar below, a 390 × 844 phone keeps roughly a quarter of the screen for the inspector and output, which scroll underneath.                          | `src/styles.css:2230-2240`                                |
| U4  | Import and export are spread over five places: the Export menu in the action bar (SVG, Fusion, design or project file), Import in the Library dialog footer, Export/Import templates on the Catalog toolbar, Import decor CSV in Materials, and the Research Import & export tab. | `App.tsx:523`, `Dialogs.tsx:416`, `Catalog.tsx:423`, `Dialogs.tsx:626`, `Research.tsx:2295` |
| U5  | One side column mixes composition and configuration. A piece shows the steps rail, then (when a space is selected) Contents / Doors and handles / Divide, otherwise Whole cabinet → Construction → Materials → Drawers and runners. Materials are also a separate dialog in the action bar. | `Inspector.tsx:174-410`, `:713-1000`                      |
| U6  | A project shares the Editor page: the side column becomes the Project panel (pieces, selected piece with finish, merge and placement, Room, Run parts). Editing a piece inside a project, or a template variant, shows a banner with Back / Save / Cancel. | `App.tsx:620-670`, `Project.tsx:60-250`, `:1145`, `:1255` |
| U7  | "Saved things" live in two places: Home (choose a project, single pieces) and the Library dialog (projects, pieces, duplicate, delete, import). Templates live in Catalog.                                                                                                                  | `Home.tsx:60-176`, `Dialogs.tsx:400-500`                  |
| U8  | Preview controls (Front/Plan · 3D, Doors and fronts, Exploded, Reset view, Look, Render) sit in one wrapping toolbar above the drawing. 3D mounts only when shown or at ≥ 1500 px (ADR-014 kept).                                                               | `App.tsx:713-810`                                         |
| U9  | Outputs (Parts, Sheets, Hardware, Shopping list, Checks) form a third column at ≥ 1180 px, a row under the drawing at 760–1180 px, and come last in the scroll on phones. Parts CSV and Print are in the action bar, far from the Parts tab on a phone.        | `Output.tsx:16-55`, `styles.css:1396`, `:2136`            |

## 2. Competitor patterns (doc: search summaries, not checked in the products)

| Pattern                                                                                                       | Seen in                                                                   | Fits us?                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Step-by-step flow: room/wall → place cabinets → interior fittings → doors and finish; the itemised list is a separate view. | IKEA PAX planner (ikea.com planner page; user blogs)                      | Yes. It is the order of our steps rail. The list (our Build) is a view of its own, not a column. |
| Two modes: one cabinet at a time vs. a room project that places cabinets.                                     | PolyBoard Cabinet mode / Project mode (wooddesigner.org help centre)      | Yes. It matches Item vs Project. We already have both, but on one page.                    |
| Layout tools (dimensions, doors, drawers, shelves) separate from a Properties panel for the selected element. | PolyBoard Quick Design toolbars vs. Properties menu                       | Yes. This is Compose (on the drawing) vs. Configure (properties).                          |
| Output (layouts, PDF, CSV) is a results screen; import/export and save/load sit in a file menu.               | Online cut-list optimisers (forestsource CutList Optimizer, Optimalon, Kerf iOS) | Yes. Files go in one place. CSV and Print go on the Parts list itself.               |
| Bottom tab bar for the top-level places; segmented control for modes inside a place.                          | General iOS/Android app convention (doc: platform guidance, not a competitor) | Yes. It replaces the action-heavy bottom bar.                                          |

Sources: https://www.ikea.com/gb/en/planner/pax-planner, https://chrislovesjulia.com/ikea-pax-install/,
https://wooddesigner.org/help-centre/polyboard-set-up-and-overview/, https://wooddesigner.org/help-centre/polyboard-basic-design/,
https://forestsource.io/software/cutlist-optimizer, https://apps.apple.com/app/id6761802671. No branding or assets are copied.

## 3. Proposed layout

Places (three, separate, one tap away anywhere):

- **Projects** — what is saved on this device: projects and single pieces, with New, open, duplicate and delete,
  and "Import a file". This merges Home and the Library dialog. The bare address opens it.
- **Catalog** — templates to start from (unchanged content, ADR-032/034). Its template import/export moves into the
  Catalog's own ⋯ menu.
- **Editor** — the one open thing: a project (plan) or an item (piece). The app bar shows the path
  `Project › Item` in place of the banners.

Feature Research moves into the ⋯ menu (open question R2).

```
Phone 390 px — Editor, Compose                        Desktop ≥ 1180 px — Editor
┌──────────────────────────────────┐                  ┌────────────────────────────────────────────────────────────────────┐
│ ‹ Kitchen › Base 600   ● ↶ ↷  ⋯ │ app bar (1 row)  │ ▣ Projects Catalog Editor │ Kitchen › Base 600 ● │ ↶ ↷ ☾ ⋯           │
│ [Compose|Configure|Build & Prev.]│ modes (1 row)    ├──────────────┬─────────────────────────────┬─────────────────────────┤
├──────────────────────────────────┤                  │Compose|Config│  Front · 3D   ☐ fronts  …   │ Build: Parts Sheets …   │
│                                  │                  │              │                             │ [Download CSV] [Print]  │
│        drawing (≈ 55 vh)         │                  │  selection   │        drawing / 3D         │                         │
│     tap a space to select it     │                  │  editor or   │                             │   parts table           │
│                                  │                  │  settings    │                             │                         │
├──────────────────────────────────┤                  └──────────────┴─────────────────────────────┴─────────────────────────┘
│ Selected: Drawers ×3       ▴     │ sheet: Contents · Doors · Divide
├──────────────────────────────────┤
│  Projects   Catalog   Editor     │ bottom nav (1 row, fixed)
└──────────────────────────────────┘

⋯ menu: Files (Export design/project file · Front view SVG · Fusion 360 script · Import a file) · Feature Research · Theme
Configure (phone): full-width scrolling settings: Size · Construction · Materials (inline, was a dialog) · Drawers and runners
Build & Preview (phone): 3D (≈ 40 vh, mounts only here) over Parts | Sheets | Hardware | Shopping | Checks, with
  Download CSV and Print on top of the list (still blocked by errors)
```

Tap counts on a phone, counted from the code (before → after):

| Task                           | Before                                     | After                                    |
| ------------------------------ | ------------------------------------------ | ---------------------------------------- |
| Download parts CSV             | 1 (bottom bar)                             | 2 (Build & Preview, Download CSV)        |
| Export design file             | 2 (Export, Design file)                    | 2 (⋯, Design file)                       |
| Import a file                  | 2 (Library, Import)                        | 2 (⋯, Import a file) or 2 on Projects    |
| Change a piece's boards        | 1 (Materials dialog)                       | 1 (Configure; Materials is inline)       |
| See 3D                         | 1 (3D)                                     | 1 (Build & Preview)                      |
| Open Catalog / saved projects  | 1 / 2 (Catalog; Library)                   | 1 / 1 (bottom nav)                       |

Parts CSV costs one more tap. In exchange, every bar shrinks to a single row and the drawing gets about twice the
height. Open question R4 asks whether to keep a CSV shortcut in the app bar.
