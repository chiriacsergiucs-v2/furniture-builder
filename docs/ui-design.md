# UI design system — audit, direction, tokens, components, screens, rollout

Date 2026-10-22. Scope: `src/styles.css`, `src/ui/**`, `src/viewer/Viewer3D.tsx`. Every feature in the inventory at the
end is kept; nothing was removed. Core paths are unchanged in length (same clicks for new piece, edit a space, export).

Inputs that were not provided and the assumptions made:

| Input               | Assumption                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Users and top tasks | Hobby cabinetmakers and small panel shops. Top tasks: start from a template → set size → fill/divide spaces → clear Checks → Parts CSV / Print; place several pieces in a project. (README, ADR-014, ADR-020.) |
| Brand assets        | The existing palette is the brand: graphite ink, cutting-mat green, tape-measure yellow, Barlow. Kept and systematised, not replaced.                                                                          |
| Pain points         | Taken from the audit below, not from user reports.                                                                                                                                                             |
| Platform            | Web PWA, phone → wide desktop (ADR-002, F18). No new dependencies.                                                                                                                                             |

## 1. Audit (before: commit b2c6f0f, screenshots at 360 / 390 / 1280 / 1600 px)

| #   | Issue                                                                                                                                     | Location                       | Impact                                                                           | Effort | Fix                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| A1  | Save status (incl. "Not saved — storage unavailable") hidden on phones (`.save { display: none }`)                                        | top bar ≤ 760 px               | High: data-loss warning invisible on the device most likely to lack storage      | S      | Status dot always visible; text shown on phones only for the failed state                                      |
| A2  | Eight unrelated button styles (`.actions`, `.secondary`, `.split-actions`, `.mini`, `.link`, `.file-btn`, `.piece-banner`, `.update-bar`) | everywhere                     | Med: inconsistent affordance; hover inverted to solid black on secondary buttons | M      | One `.btn` with variants (primary, solid, outline, ghost, danger, link, icon, sm)                              |
| A3  | Text-only actions; "Saved" names the library but reads like a status                                                                      | top bar                        | Med: scanning, confusion with the "Saved on this device" status next to it       | S      | Icons + labels; "Library"; labels collapse to icons below 1320 px with `aria-label`                            |
| A4  | Inspector is a flat list of 10+ fields with no grouping (Contents / Doors / Handles / Divide run together)                                | space editor                   | High: hierarchy; users scroll to find "Divide"                                   | M      | Three titled sections: Contents, Doors and handles, Divide this space                                          |
| A5  | No map of the stages of a piece; no wizard primitive for coming flows (catalog N14, guided start)                                         | whole-piece editor             | Med                                                                              | M      | Steps rail (size → inside → build → boards → cut) with live status; same component carries a guided flow later |
| A6  | Long parts tables lose their header while scrolling                                                                                       | Parts, Hardware, Sheets        | Med                                                                              | S      | Sticky `thead` inside the tab panel                                                                            |
| A7  | Template chooser: 10 identical rows, no visual differentiation                                                                            | New, Add a piece               | Med: slow recognition                                                            | S      | Two-column grid with a glyph per template                                                                      |
| A8  | Dialogs have no footer; primary actions ("Add a material", "Import") sit at the end of a scrolling body                                   | Materials, Library             | Med                                                                              | S      | Header / body / sticky footer                                                                                  |
| A9  | Materials dialog: rows run together; four-column sheet fields clip "2800" at 560 px                                                       | Materials                      | Med                                                                              | S      | One card per material; sheet fields in two columns                                                             |
| A10 | Export menu cannot be closed with Escape or a click outside                                                                               | top bar                        | Med (keyboard access)                                                            | S      | Escape closes and returns focus; outside click closes                                                          |
| A11 | No dark theme; `color-scheme: light` only                                                                                                 | global                         | Med: workshop/evening use, OLED phones                                           | M      | Token set for dark, `prefers-color-scheme` + manual toggle, print forced light                                 |
| A12 | 3D canvas background and drawing colours hard-coded                                                                                       | Viewer3D, elevation, sheets    | Low (blocks A11)                                                                 | S      | Read `--stage-3d`; drawing colours as tokens; text on material fills fixed dark                                |
| A13 | Empty / loading states are bare sentences                                                                                                 | Hardware, Checks, Library, 3D  | Low                                                                              | S      | `.empty` with icon, `.loading` with spinner                                                                    |
| A14 | Disclosure sections use "+ / −", which reads as increment next to counters                                                                | Construction, Materials groups | Low                                                                              | S      | Chevron                                                                                                        |
| A15 | Diagnostics inline in the inspector are coloured bars without an icon                                                                     | space editor                   | Low                                                                              | S      | `.alert` with icon; same component in Output, Sheets, Library                                                  |
| A16 | Hint text 12.3 px                                                                                                                         | everywhere                     | Low (passes contrast)                                                            | S      | 13 px `--fs-xs`                                                                                                |
| A17 | Native `confirm()` for delete / remove / replace                                                                                          | Library, Project               | Low: inconsistent look, but accessible and modal                                 | —      | Kept; flagged for a later styled confirm (needs your decision)                                                 |

Quick wins: A1, A3, A6, A7, A8, A10, A13–A16. Structural: A2, A4, A5, A11/A12.

## 2. Direction: "workshop"

A tool, not a brochure. Ground is melamine white; controls sit on white sheets; ink is graphite; the one primary action
(Parts CSV) is tape-measure yellow like the dimension pills on the drawing, so the thing you read on the drawing and the
thing you take to the shop share a colour. Cutting-mat green marks selection and the current state. Numerals are
Barlow Semi Condensed, tabular, so columns of millimetres line up.

### Tokens (`src/styles.css`, section 1)

| Group    | Tokens                                                                                                                  | Light                                           | Dark                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Surfaces | `--bg` `--surface` `--surface-2`                                                                                        | #eef0ee / #fff / #f6f7f6                        | #15181a / #1e2326 / #252b2e                                  |
| Ink      | `--ink` `--ink-2` (`--ink-3` decorative only)                                                                           | #22272a / #5a625e                               | #e8ebe9 / #a8b1ac                                            |
| Lines    | `--line` `--line-2`                                                                                                     | #cdd3cf / #e1e5e2                               | #343c3f / #2a3134                                            |
| Primary  | `--primary` `--primary-hover` `--primary-soft` `--on-primary` `--link`                                                  | #2d5b4c … #dbe7e1, link #2d5b4c                 | #3a7260 … #24403a, link #8fc7b2                              |
| Accent   | `--accent` `--accent-hover` `--accent-soft` `--on-accent`                                                               | #f2c230 / #ebb81c / #fdf3cf / #3a2e00           | same, soft #3d3415                                           |
| Feedback | `--error` `--error-fill` `--error-soft`; `--warn` …; `--ok` …                                                           | #b3261e / #b3261e / #f8e1df; #9a5b00 …; #2d5b4c | text #ff9a90, fill unchanged, soft #3a1f1d; #f0b55a; #8fc7b2 |
| Top bar  | `--bar-bg` `--bar-ink` `--bar-ink-2` `--bar-line` `--bar-hover`                                                         | #22272a …                                       | #0f1213 …                                                    |
| Drawings | `--floor` `--el-back` `--stage-3d` `--sheet-bg` `--sheet-usable` `--on-material`                                        | #b9c0bb …                                       | #3a4347 … (text on material fills stays #22272a)             |
| Type     | `--font` Barlow, `--num` Barlow Semi Condensed; `--fs-xs/sm/md/lg/xl/2xl` = 13 / 14 / 15 / 17 / 20 / 24 px; `--lh` 1.45 |                                                 |                                                              |
| Space    | `--s-1…8` = 4 8 12 16 20 24 32                                                                                          |                                                 |                                                              |
| Shape    | `--r-sm` 4, `--r` 6, `--r-lg` 10, `--r-pill`                                                                            |                                                 |                                                              |
| Depth    | `--shadow-1/2/3` (card, menu, dialog); `--backdrop`                                                                     |                                                 |                                                              |
| Motion   | `--t-fast` 120 ms, `--t-base` 180 ms, ease-out; everything off under `prefers-reduced-motion`                           |                                                 |                                                              |
| Layout   | `--side` 360, `--out` 400, `--control-h` 38, `--touch` 40                                                               |                                                 |                                                              |

Contrast (computed, WCAG 2.2 AA ≥ 4.5:1 for text): ink-2 on surface-2 5.85, on bg 5.48; white on primary 7.74
(dark 5.59); white on warn fill 5.43; white on error fill 6.54; bar-ink-2 on bar 7.0; dark ink-2 on surface 7.21;
dark link 8.3; dark error 7.76; dark warn 8.66; on-accent on accent 7.98; error on error-soft 5.24; warn on warn-soft
4.63; dark error/warn on their soft fills 7.4. `--ink-3` is never used for text.

Dark mode rules: follows the system; the toggle in the title row stores a choice in `localStorage` (`fb:theme`, this
device only — ADR-002). `@media print` always uses the light set (dark overrides are wrapped in `@media screen`),
checked: body #fff / #000, panel stroke #22272a while the page is in dark mode. The 3D canvas reads `--stage-3d`.
Material swatches keep their real colours in both themes; text drawn on them is always dark.

Iconography: inline SVG, 24-unit grid, 1.75 stroke, round caps — the same construction as the brand mark. 32 icons in
`src/ui/icons.tsx` (actions, feedback, template glyphs). No icon font, no dependency.

## 3. Components and states (`src/styles.css` sections 3–6, `src/ui/controls.tsx`)

| Component                             | Class / export                                                                                                                           | States covered                                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Button                                | `.btn` + `primary` (one per screen: Parts CSV) / `solid` / `outline` / `ghost` / `danger` / `link` / `icon` / `sm` / `block` / `loading` | default, hover, active, focus-visible (2 px ring, accent on dark bar), disabled (50 %), loading (spinner, text hidden)                                       |
| Millimetre field                      | `MmField` → `.mm`                                                                                                                        | default, hover, focus-within ring, invalid (red border + message linked by `aria-describedby`), hint                                                         |
| Select / text input                   | `select`, `.input`, `.mat-name`                                                                                                          | default, hover, focus; custom chevron; dark variant                                                                                                          |
| Segmented (radio group)               | `Segmented` → `.segmented`                                                                                                               | on (primary fill), hover, focus-visible inside; wraps at narrow widths                                                                                       |
| Counter                               | `Counter` → `.counter`                                                                                                                   | hover, disabled at min/max, live `output`                                                                                                                    |
| Toggle                                | `Toggle` → `.toggle`                                                                                                                     | native checkbox, accent colour                                                                                                                               |
| Steps rail (wizard-ready)             | `Steps`, `Step` → `.steps`                                                                                                               | per step: `done` (green number), tone `ok` / `warn` / `error` (status colour), `aria-current="step"` (current), `disabled`; `.wizard-footer` for Back / Next |
| Section card                          | `Section` → `.section` + `.card-title`                                                                                                   | —                                                                                                                                                            |
| Collapsible group                     | `Group` (with `id`) → `.group`, `revealGroup(id)`                                                                                        | open / closed chevron; opened and scrolled to from the rail                                                                                                  |
| Row button (template, library, piece) | `.row-btn` with `.glyph` `.sub` `.chev`                                                                                                  | hover, `on` / `aria-pressed` / `aria-current` (primary border + soft fill)                                                                                   |
| Alert                                 | `.alert.error` / `.warning` / `.info` / `.ok`                                                                                            | icon + text; used inline, in tabs, in lists                                                                                                                  |
| Badge                                 | `.badge.error` / `.warning` / `.neutral`                                                                                                 | —                                                                                                                                                            |
| Tabs                                  | `.tabs`                                                                                                                                  | on (primary underline), hover, focus-visible; horizontal scroll on narrow                                                                                    |
| Status                                | `.status.saving` / `.saved` / `.failed`                                                                                                  | dot (pulse while saving), text, failed always visible                                                                                                        |
| Empty / loading                       | `.empty` (+ `.ok`, `.center`), `.loading`                                                                                                | icon or spinner                                                                                                                                              |
| Table                                 | `table.cut`                                                                                                                              | sticky head (desktop), row hover / `on` (accent-soft), focus ring                                                                                            |
| Menu                                  | `.menu` (details)                                                                                                                        | open, hover, Escape, outside click                                                                                                                           |
| Dialog                                | `Dialog` with `footer` → `.dialog`, `.dialog-body`, `.dialog-footer`                                                                     | open animation (not under reduced motion), backdrop, Escape, close button                                                                                    |
| Toast                                 | `.toast`                                                                                                                                 | update prompt                                                                                                                                                |

## 4. Screens, before → after (screenshots in the session log; same paths at 360 / 390 / 1280 / 1600 px, light and dark)

**Top bar.** Before: name, text status, nine text buttons wrapping into two rows on phones; "Saved" ambiguous. After:
name + status dot (A1), undo/redo as icon buttons, New / Library / Materials with icons, Export menu with icons and
sub-labels, Print, Parts CSV (the only yellow), theme toggle on the title row. Labels collapse to icons under 1320 px
(A3). Phone: same three rows as before, nothing hidden (F18).

**Whole-piece inspector.** Before: title, three sizes, link, segmented, then groups with + / −. After: the steps rail
on top (A5) — _1 Size 800×900×450 · 2 Inside 4 drawers · 3 Build Overlay · 4 Boards PAL 18 white · 5 Cut Ready_ — each
jumps to its section or tab; "Inside" turns amber when the interior is empty, "Cut" red with the number of problems.
Groups use chevrons (A14) and have ids so the rail can open them.

**Space editor.** Before: a flat list. After: three sections — Contents, Doors and handles (with a hint when there are
no fronts yet), Divide this space (A4); diagnostics as alerts with icons (A15); breadcrumb kept.

**Output.** Parts tab shows the part count; sticky headers (A6); blocked state as an alert; Checks empty state with a
tick; each check row has an icon (same colours as before, nothing softened — ADR-008).

**New / Add a piece.** Project card on top, then a two-column grid of templates with glyphs (A7); footer carries the
"already saved" note. Library: rows with glyphs, Duplicate / Delete as small icon-labelled buttons, Import in the footer
(A8). Materials: one card per board, sheet fields in two columns, Add in the footer (A9).

**Project panel.** Pieces as row buttons with chevrons; the selected piece in a titled card with "Edit this piece" as
the solid action.

**Drawings.** Unchanged geometry (ADR-004 / 0014); colours via tokens so they follow the theme (A12). Print sheet
unchanged.

**3D look and Render (ADR-067, ADR-068, 2026-10-24).** The 3D toolbar adds **Look** (`.segmented.small`:
_Simple · Realistic_, kept in `localStorage` `fb:look`; Realistic by default at ≥ 1024 px) and a **Render** button
(camera icon) that opens _Render a picture_: size segmented, hint, a `.status.saving` progress line, the picture in
`.render-frame`, Start / Cancel / Render again / **Save PNG** in the footer, and an error alert when WebGL 2 is
missing. In Realistic the selection is the green tint only (no outline). Materials gains **Finish** (_Matte · Satin ·
Gloss_) under _Has grain_.

**Shell and editor modes (ADR-078, ADR-079, 2026-10-24).** These replace the top bar and the phone action bar
described above. Audit and wireframes are in `docs/research/2026-10-24-ui-redesign-audit.md`.

- _Places._ **Projects** (the bare address and `#projects`: Home and the Library dialog merged, with Import a
  file and Clean up unused pictures), **Catalog** and **Editor**. They are tabs in the top bar (`nav.places`) on
  wider screens and a fixed one-row bottom nav at ≤ 760 px. Feature Research moved into ⋯.
- _App bar, one row._ It shows the path to what is open: the name; `‹ Project › piece` for a piece in a project;
  or the variant plus **Save to template** / **Cancel** for a template variant. The template's family name is
  hidden on phones. It also holds the status dot, Undo, Redo, **Settings** (ADR-080), the theme toggle and ⋯ **More**.
- _⋯ More._ New…, **Files** (Design or Project file, Front view drawing, Fusion 360 script, Import a file) and
  Feature Research. Catalog template import/export sits in its own _Template files_ menu. The banners are gone.
- _Modes._ A segmented control under the bar: **Compose · Build & Preview** (ADR-080; remembered per device in
  `fb:mode`, an old `configure` opens Compose). Build & Preview carries the Checks count.
  - Compose: the space or piece editor.
  - Build & Preview: 3D plus the outputs.
- _Settings (ADR-080)._ The sliders button in the app bar, and _Settings for <name>_ on each Projects and Single
  pieces row, open the **Settings** dialog (full screen on phones): what was Configure — the whole-piece editor
  with the steps rail, _Boards, sheets and saw cut_ and Fasteners; for a project: run parts, saw cut and save as a
  template. Changes apply at once. From the list, the row becomes the one open now.
- _View captions (ADR-080)._ The plan's and the front view's captions, and the plan's Snap line, sit behind an
  info button at the view's top-right (_About the plan_, _About the front view_): hover or focus with a mouse,
  tap on touch; outside tap or Esc closes. While dragging, the live snap note shows over the plan.
- _View switch (ADR-081)._ `.segmented.small` _View_ in the stage tools: **Front · 3D · Both** (**Plan · 3D ·
  Both** in a project). Both splits the stage: side by side, stacked when the stage is taller than wide. 3D and
  Both are disabled without WebGL (title: _3D preview is not available in this browser_). A mode change resets
  the view: Both from 1500 px, else 3D in Build & Preview and the drawing in Compose.
- _Desktop._ The left panel shows Compose. Build is always the right column. Build & Preview turns the centre to
  3D (Both from 1500 px).
- _Phone._
  - Compose: the drawing fills the screen, with a bottom sheet over the nav. Its peek row reads _Selected: …_ or
    _Tap a space to edit it_; the sheet steps aside while placing or drawing. A piece chosen in a project opens
    the sheet; a space of a single piece does not (N82, user 2026-10-26): the drawing keeps its height with the
    quick counts above the selection, and the peek row opens the editor. Open, the sheet takes at most 40 dvh
    and the quick-counts card hides (the editor has the same counters).
  - Build & Preview: the View switch and an **Options** menu in one row (Doors and fronts, Exploded 3D, Reset
    view, Look, Render; N82), 3D (42 vh, mounted only here) over the output tabs; Both stacks the drawing over
    3D in a 72 vh stage.
- _Touch and type (N82)._ Under `pointer: coarse` every control is at least 44 × 44 px (buttons, segmented,
  tabs, counters, fields, menu rows, summaries, breadcrumbs); a mouse keeps `--control-h` 38. No text is set
  below `--fs-xs` (13 px): badges, chips, tags, step meta and the quick-counts card use it. The result tabs
  wrap to a second row rather than scroll, so Checks is always in sight.
- _Follow-up (N87, user 2026-10-26)._
  - _Yellow:_ one yellow action per screen: Create a new project (Projects), New piece (Catalog), Next / Done in
    dialogs, Download CSV (editor). Catalog variant cards use an outline **Open**; the current place tab is green.
  - _Quick counts on a phone_ (G-058): the card docked under the 3D view (G-070) has a **Quick counts** button
    that folds it to one row; open by default, the choice kept on this device (`fb:counts3d`). Wide screens
    show no fold button.
  - _Brand:_ the mark is a link to Projects; on a phone outside the editor the bar also reads **Furniture
    Builder**.
  - _Projects:_ **Clean up unused pictures** moved to ⋯ More › Files. Row buttons stay on the row's line; a
    small phone drops the row glyph.
  - _Catalog:_ the sticky filter row takes the page colour; on a phone the safety choice, **Save this piece as
    a template** and **Template files** fold under **More catalog actions**; variant kinds read **Interior
    only** / **New construction**; a room lists its own families first; Start from says **N ready items**.
  - _Wizard:_ **Type** comes before **Size**; Skip's title says what it does.
  - _Settings:_ on a phone the steps rail runs in rows of three.
  - _Results:_ the Parts summary says **Edge bands are not named yet.** once when no board names one; on a
    phone the Hardware item column takes the room. An empty project says **Add pieces under Compose to see
    them in 3D.** and Checks says **Nothing to check yet.**
  - _Drawing:_ space labels have a wider halo so a door's dashed line does not run through the words.
  - _3D:_ the viewer mounts only while the editor is the page shown (ADR-014).
- _Output actions._ **Download CSV** (the one primary button) and **Print** sit on top of the Parts tab, and
  are still disabled while there are errors (ADR-008).
- _Gaps page (ADR-101)._ ⋯ More › **Gaps** opens `#gaps`, built like Feature Research: heading **Gaps**, a hint
  saying the ledger is the one built into this version of the app, **Back to the editor**, status tiles (Open,
  Acknowledged, Moved to an ADR, Done, Marked by you), a search box, status filter chips (Open on by default) and
  **Copy decisions (N)**, the page's one yellow button. Each gap is a card that expands to every ledger field, with
  **Acknowledge** and **Make ADR** (pressed state, tap again to clear) and **Your note** for Open and ADR gaps.
  Copy decisions shows the text in **Decisions to paste to Claude** and copies it when the browser allows. At
  ≤ 520 px the field list stacks label over value.

## 5. Rollout

Shipped as one slice on `ccr-38ebfeec-gnv63w` because the tokens, components and screens share one stylesheet; each
phase below is still separable by file if a revert is needed:

1. Tokens + base (`styles.css` §1–2, `useTheme.ts`, `main.tsx`) — no markup changes required; old class names were
   kept where cheap (`.link`, `.danger-link`, `.hint`, `.group`, `.mm`, `.segmented`, `.counter`, `.tabs`, `.dialog`).
2. Components (§3–6, `controls.tsx`, `icons.tsx`, `Templates.tsx`).
3. Screens (`App.tsx`, `Inspector.tsx`, `Dialogs.tsx`, `Output.tsx`, `Project.tsx`, `Sheets.tsx`, `Viewer3D.tsx`).

Verification run: `npm run lint && npm run typecheck && npm test && npm run build` (94 tests). Scripted Chromium at
360 / 390 / 1280 / 1600 px in light and dark: 47 screens each, no page errors, no horizontal page scroll; print emulation
in dark mode renders the light print sheet. Not run: a real phone, a screen reader, the deployed site.

### Open questions (your decision)

- A17: replace native `confirm()` dialogs with the styled dialog (adds ~40 lines; keeps keyboard behaviour).
- Keep the theme toggle in the title row, or move it to a settings menu once one exists (catalog N14 may add one).
- The steps rail is a section map today. Should the New dialog become a guided flow (size → inside → boards) for
  first-time users? It would add steps to the frequent path, so it is not done without approval.
- Phone top bar still takes three rows; a bottom action bar would free space but changes the layout users know.

## Feature inventory (every original feature accounted for)

| Feature                                                                                                      | Status                                                    |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Name field, autosave status                                                                                  | kept; name in the app bar path (ADR-078)                  |
| Undo / Redo (buttons + shortcuts)                                                                            | kept (icon buttons, same titles)                          |
| New, Saved (library), Materials, Parts CSV, Print, Export menu (SVG, Fusion, design / project file)          | kept; ⋯ › New / Files, Projects page, Settings, Parts tab |
| Front / Plan / 3D / Both switch, Doors and fronts, Exploded 3D, Reset view                                   | kept                                                      |
| Elevation: tap spaces, breadcrumb, selection, dimensions                                                     | kept                                                      |
| Inspector: all fields for cabinet, corner, desk, space, split, drawer heights, handles, runner settings      | kept, regrouped                                           |
| Output tabs: Parts, Sheets, Hardware, Checks; row ↔ 3D highlight; CSV blocked by errors                      | kept                                                      |
| Projects: list, add, edit, update from saved, quantity, turn, position, gap, remove, kerf; plan + room front | kept                                                      |
| Library: open, duplicate, delete, import                                                                     | kept                                                      |
| Materials: colour, name, thickness, grain, sheet, trim, stock, add; kerf                                     | kept                                                      |
| Print sheet, update toast, no-WebGL message                                                                  | kept                                                      |
| New: theme toggle (light / dark, device-local)                                                               | added                                                     |
