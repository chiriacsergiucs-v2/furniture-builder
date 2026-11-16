# Furniture Builder — UI/UX architecture and flow audit

- Date: 2026-11-15. Branch `ccr-a3647523-kcb8dd` at the commit that adds this file. Gap G-508.
- Prepared for: a software architect and an external audit firm, to optimize the existing flows.
- Scope: the current state only. Nothing was redesigned or changed in the app. Recommendations are marked as proposals.
- Standards used for ratings (user's choice): WCAG 2.2 AA and Nielsen's ten usability heuristics (H1–H10).

## 1. Executive summary

Furniture Builder is a phone-first, offline PWA with six pages (Projects, Catalog, Editor, plus Information, Gaps and Research behind the More menu). It has two modes (Compose, Build & Preview) and one responsive breakpoint that matters (760 px). On a phone the left inspector becomes a three-stop bottom sheet and the mode row is replaced by a fixed bottom navigation. On a desktop the Editor is a three-column grid (360 px inspector, flexible drawing, 400 px results panel).

What works well, measured or read in code:
- No horizontal page scroll at 390 px or 1280 px on Projects, Catalog or Editor (measured, section 4).
- Every interactive element in the captured screens has an accessible name (measured: 0 of the interactive elements captured were unnamed).
- Destructive actions ask first (delete project, remove piece, replace, reset assembly, clean pictures; code citations in section 6).
- Disabled export actions carry a reason, and "Front view drawing" shows it as visible text.
- The phone sheet has a keyboard-operable slider handle with `aria-valuetext`.

The main findings (full register in section 8):
1. **Tap targets are smaller than the project's own 44 px rule on touch** (F-03, Medium). Measured with touch emulation at 390 px: Catalog card actions are 38 and 30 px tall, header icon buttons 38 px, language chips 32 px, and the 2D/3D/Both switch 20 px tall.
2. **The phone More menu hides its last three entries below its fold** (F-01, Medium). Information and guides, Feature Research and Gaps are reachable only by scrolling inside the menu, with no scroll cue.
3. **Reasons for disabled actions are in `title` tooltips only** for Download CSV, Print, the Create button in the wizard and the Move toggle (F-04, Medium). Tooltips do not show on touch.
4. **Export gating is inconsistent** (F-05, Medium): CSV, Print, Client sheet, SVG and Fusion are blocked on errors; project file, design file and the review pack are not. This needs a decision, not a fix.
5. **Several actions have two or three entry points and several labels** (F-06, F-07, Low): Import, Shopping, New piece and materials.
6. **Maintainability** (F-10, F-11, Medium for the architect): dead CSS from a retired action bar, two conflicting sheet-height rules, 27 repeated 760 px media blocks in one 7,682-line stylesheet, and design docs that no longer match the shell.

Not covered: dark theme, the 3D view (not captured), the wizard's steps, all dialogs except New, the Gaps, Research and Information pages, and every state that needs saved data. Section 2 lists the limits.

## 2. Method, sources and limits

Evidence labels used throughout:
- **[M]** measured in a browser during this audit, with the commands in the next list.
- **[C]** read in code by me and the line checked.
- **[R]** reported by a read-only code-mapping pass over a group of files, with a file:line citation. I checked a sample of these citations against the code (marked ✔ where I did); unchecked ones are labelled [R].
- **[D]** stated in a repository document, not verified by me.

What was run:
- `pnpm build:ci`, then `pnpm preview`, then `pnpm browser:capture` (toggle `browser-on-demand`, scheduled by the user). Chromium, with touch and the mobile flag at 390×812 and a mouse at 1280×900.
- For every place in the "Places" navigation (Projects, Catalog, Editor): the default screen, the open More menu, and the open "Start something new" dialog. Output: 18 screenshots and 18 element-box JSON files in `docs/research/ui-capture/`, plus `summary.json`.
- A separate Playwright check of the More menu at 390×812, 390×667 and 360×640.
- Code reading over `src/ui`, `src/ui/shell`, `src/viewer`, `src/store`, `src/styles.css`, `docs/ui-design.md` and `docs/architecture.md`, split between three read-only passes.

Limits you should weigh:
- The app was captured at its first start with no saved projects. The Editor showed a default "Chest of drawers" piece. Saved-data states, long lists and error states were not captured.
- Light theme only. The design document gives computed contrast ratios [D, `docs/ui-design.md:65`]; I did not recompute them.
- The 3D view was not captured, and its toolbar facts are [R] only.
- The element map records only landmarks, headings and interactive elements. Sizes are the element's own box, not an enlarged hit area.
- "Tab order" in the tables is the document order of focusable elements. It is not a recorded keyboard walk.
- File:line numbers in [R] items can drift by a few lines; the checked ones did not.

## 3. UI architecture

**Component tree** [C ✔ `src/ui/App.tsx:614`; the rest [R] from `App.tsx:615-1151`]:
- `div.app.page-{page}` holds, in order:
  - `header.bar`: brand link, the Places navigation, an editor-only name field or crumb, save status, the estimate chip (not on phone), `SyncStatus`, and the tools (Undo, Redo, Settings, Material, account, theme, More).
  - `.modes`: the Compose / Build & Preview radiogroup (editor only; hidden on phone).
  - a dismissible notice.
  - the page body: `ProjectsPage`, or lazily loaded Catalog, Research, Gaps and Info.
  - `main.work.mode-{mode}`: always mounted but hidden outside the Editor. It holds `aside.side` (inspector or project panel, with the sheet handle and peek row on phone), `section.stage` (drawing, 3D, tool row, quick-count dock) and `Output` (results).
  - dialogs, the confirm host and the print roots.

**Navigation model**
- Six pages: `projects | editor | catalog | research | gaps | info` [C ✔ `App.tsx:160`]. Only the first three are in the Places navigation; the others are reached from More [R `App.tsx:189-193, 841-843`].
- The page lives in `location.hash` and is read on start and on `hashchange` [R `App.tsx:162-176`]. Projects strips the hash with `replaceState`, so going to Projects adds no history entry; going to any other page pushes one [R `App.tsx:181-182`]. No `popstate` handler was found [R].
- The open piece, project and template edit are not in the URL. They live in the Zustand store and are restored from the last project or design id at start [R `App.tsx:395-420`].
- Two modes only, `compose` and `build`, stored in `localStorage` key `fb:mode` [R `src/store/uiStore.ts:13-23, 88-94`].
- The 2D / 3D / Both choice is local component state; it resets only when the width crosses 1500 px [R `App.tsx:274, 287-290`].
- The viewport class comes from `useMediaQuery('(max-width: 760px)')` [C ✔ `App.tsx:263`].
- "Move" and "Select" are toggles in the 3D toolbar, not modes [R `src/viewer/Viewer3D.tsx:613-646`].

**Single piece versus project.** `inProject = project && !editingItemId`. A single piece shows the Inspector and the elevation drawing; a project shows `ProjectPanel` and `PlanView`. Undo and redo use separate stacks for each [R `App.tsx:245-252`].

**Where things live in the stylesheet** [C]: one file, `src/styles.css`, 7,682 lines, with tokens at the top (`--side: 360px` at line 85), a coarse-pointer block at lines 95-100, and 27 `@media (max-width: 760px)` blocks spread through the file.

## 4. Viewport and layout: phone and desktop

### 4.1 Breakpoints

| Breakpoint | What changes | Evidence |
|---|---|---|
| ≥ 1181 px (target 1280) | Header is one row. `.work` is a three-column grid: inspector 360, drawing flexible, results 400. The Compose / Build & Preview row sits under the header, at most 600 px wide. | [R] `styles.css:85-86, 1376-1384, 1534-1539, 5204-5217`; [M] header 1280×46, aside 360×807 |
| ≤ 1180 px | `.work` becomes two columns; results move under the drawing. | [C ✔] `styles.css:2701` |
| ≤ 1320 px | Hides `.actions .lbl`. **Dead rule**: no `className="actions"` exists in `src/ui`. | [R] `styles.css:2712-2718`; [C] grep for `className="actions"` found nothing |
| ≤ 760 px (target 390) | Phone layout: sticky header, fixed bottom navigation, bottom-sheet inspector, mode row hidden, results collapsed until a tab is tapped. | [C ✔] `styles.css:5352-5354` (`.modes {display:none}`); [R] `styles.css:2725-2730, 5304-5327, 5404` |
| ≤ 600, ≤ 520, ≤ 480, ≤ 440 px | Tab wrapping, projects-list row menu (520), backup grids (480), places labels (440). | [R] `styles.css:4920, 6670, 496, 4241` |
| `pointer: coarse` | `--control-h` 38 → 44 px, and a 44 px minimum block for buttons, segmented controls, tabs, menu items and summaries. | [R] `styles.css:95-100, 6149`; [D] `docs/ui-design.md` "Control rule (ADR-114)" |
| ≥ 1500 px (script) | The default view becomes Both when WebGL is available. | [R] `App.tsx:270`, `viewChoice.ts:30-32` |

### 4.2 Regions at 1280 px (Editor, measured)
1. **Header bar** 0–46 px: brand icon (16,4), Places tabs (54–360), name field (372, 381 px wide), estimate chip, then Undo, Redo, Settings, Material, theme and More at x = 1036–1264, each 38×38.
2. **Mode row** y 50–88: "Compose" and "Build & Preview", 295×28 each.
3. **Inspector** `aside` x 0–360, y 93–900: the "Compose" heading with an info button, and an "Edit the interior" row.
4. **Drawing** x 360–880: the 2D/3D/Both switch (381,106) and the "Doors and fronts" checkbox, then the elevation with its yellow 900 and 800 mm dimension pills.
5. **Results** x 880–1280: tabs Parts, Sheets, Hardware, Assembly, Shopping list, Checks (the sixth wraps to a second row), then Download CSV, Print, Client sheet and the parts table.

### 4.3 Regions at 390 px (Editor, measured)
1. **Header** sticky, 0–46: the name field (114 px wide, cut to "Chest of dr…"), then Undo, Redo, Settings, Material, theme and More, 38×38 each.
2. **Tool row** y 50–80: 2D/3D/Both (20 px tall), "Fronts" checkbox and an "Options" menu (93×30).
3. **Drawing** fills the middle.
4. **Sheet** `aside` fixed at y 696–752 (peek row, 56 px): handle, the text "Tap a space to edit it" and a chevron.
5. **Bottom navigation** fixed at y 752–812: Projects, Catalog, Editor.
The page is 390×812 with no horizontal scroll [M].

### 4.4 The phone bottom sheet
- Three stops: `peek` (56 px row), `half`, `full` [C ✔ `src/ui/SheetHandle.tsx:5, 8`].
- Resize: drag the handle (`role="slider"`, 44 px wide, snaps to the nearest stop; under 8 px moved is a tap that toggles peek and half), arrow keys, Home and End, or tap the peek button [R `SheetHandle.tsx:68-122`, `App.tsx:919-928`].
- Selecting a piece or space opens it to half; placing, drawing a room or tapping a check collapses it to peek [R `App.tsx:305-345`].
- Half height is 40 dvh [C ✔ `styles.css:6107`]. An earlier rule sets 52 dvh [C ✔ `styles.css:5420`]; the later one wins (finding F-10).
- Peek text by situation [R `App.tsx:575-589`]: "{n} pieces selected", "Selected: {name}", "{name}: {n pieces}", "Selected: {label}" or "Tap a space to edit it".

### 4.5 Overlays and menus

| Overlay | Open / close | Focus and ARIA | Evidence |
|---|---|---|---|
| More menu (`<details>`) | Click the summary. Closes on Escape, outside click, and after any item. | Escape returns focus to the summary. No `role="menu"`, no arrow-key navigation. | [C ✔] `shell/MoreMenu.tsx:59, 116`; [R] `MoreMenu.tsx:58-77, 109-112` |
| `Dialog` (modal) | `showModal()`. Escape and a backdrop click close it. | Native modal trap; `aria-label` = title; close button labelled "Close". The wizard ignores the backdrop. | [C ✔] `Dialogs.tsx:218`; [R] `Dialogs.tsx:173-238`, `Wizard.tsx:633` |
| Sheet dialog (phone Settings and Material) | Non-modal `<dialog open>` inside the sheet. | Focus moves in; no trap. | [R] `Dialogs.tsx:111-146` |
| Confirm / text prompt | Store-driven `askConfirm` and `askText`. | Opener refocused; Cancel is the default for danger. | [R] `Confirm.tsx:49-71` |

Measured: the New dialog is 600×852 at (340,24) on desktop and 354×796 at (18,8) on phone, both `position: fixed`.

### 4.6 Keyboard
A global handler runs only on the Editor page, never inside inputs, dialogs or an open More menu [C ✔ `editorShortcuts.ts:2`; R `App.tsx:471-558`]. Ctrl/Cmd+Z, Shift+Z and Y undo and redo; Delete or Backspace removes a selected piece (with a confirm); Ctrl/Cmd+D duplicates; Ctrl/Cmd+A selects all pieces in a project; Escape goes up one level.

## 5. Component position tables (measured)

The tables below come from the element-box JSON in `docs/research/ui-capture/` (the full JSON also lists every heading and interactive element, with visibility and in-viewport flags; on pages taller than three screens, such as the Catalog, it keeps only the first two screens and records `totalElements` and `truncatedBelowY`). Coordinates are CSS pixels from the page's top-left. Names are accessible names, cut to 42 characters. "tab" is the position in document tab order. The Catalog tables show only the top of a page that is 15,128 px (1280) or 27,606 px (390) tall.


**Editor, 1280 px** (viewport 1280×900; page 1280×900; horizontal scroll: no; screenshot `editor-1280.png`)

| Element | Name | x,y | w×h | position | tab |
|---|---|---|---|---|---|
| header | Furniture BuilderProjectsCatalog118Edit… | 0,0 | 1280×46 | static |  |
| a | Furniture Builder, go to Projects | 16,4 | 26×38 | static | 1 |
| nav | Places | 54,4 | 306×38 | static |  |
| a | Projects | 59,9 | 96×28 | static | 2 |
| a | Catalog118 | 159,9 | 110×28 | static | 3 |
| a | Editor | 273,9 | 82×28 | static | 4 |
| input | Name of this piece | 372,5 | 381×36 | static | 5 |
| button | No prices yet — Open the Shopping list | 924,8 | 100×30 | static | 6 |
| button | Undo | 1036,4 | 38×38 | static | 7 |
| button | Redo | 1074,4 | 38×38 | static | 8 |
| button | Settings | 1112,4 | 38×38 | static | 9 |
| button | Material | 1150,4 | 38×38 | static | 10 |
| button | Switch to the dark theme | 1188,4 | 38×38 | static | 11 |
| summary | More | 1226,4 | 38×38 | static |  |
| button/radio | Compose | 21,55 | 295×28 | static | 28 |
| button/radio | Build & Preview | 316,55 | 295×28 | static |  |
| main | Tap a space to edit itComposeEdit the i… | 0,93 | 1280×807 | static |  |
| aside | Compose | 0,93 | 360×807 | static |  |
| header | Compose | 16,109 | 327×25 | static |  |
| h2 | Compose | 16,109 | 82×25 | static |  |
| button | About compose | 102,103 | 38×38 | static | 30 |
| button | Edit the interior4 drawers | 16,150 | 327×59 | static | 31 |
| button/radio | 2D | 381,106 | 41×20 | static | 32 |
| button/radio | 3D | 422,106 | 41×20 | static |  |
| button/radio | Both | 464,106 | 55×20 | static |  |
| input | Doors and fronts | 540,107 | 18×18 | static | 33 |
| button/tab | Parts30 | 889,93 | 78×38 | static | 35 |
| button/tab | Sheets | 967,93 | 62×38 | static |  |
| button/tab | Hardware | 1029,93 | 79×38 | static |  |
| button/tab | Assembly | 1108,93 | 79×38 | static |  |
| button/tab | Shopping list | 1187,93 | 78×38 | static |  |
| button/tab | Checks | 889,130 | 64×38 | static |  |
| button | Download CSV | 897,180 | 180×38 | static | 36 |
| button | Print | 1085,180 | 180×38 | static | 37 |
| button | Client sheet | 897,226 | 367×38 | static | 38 |
| button | About the parts list | 1193,268 | 38×38 | static | 39 |

**Editor, 390 px** (viewport 390×812; page 390×812; horizontal scroll: no; screenshot `editor-390.png`)

| Element | Name | x,y | w×h | position | tab |
|---|---|---|---|---|---|
| header | Furniture BuilderProjectsCatalog118Edit… | 0,0 | 390×46 | sticky |  |
| nav | Places | 0,752 | 390×60 | fixed |  |
| a | Projects | 8,757 | 122×51 | relative | 2 |
| a | Catalog118 | 134,757 | 122×51 | relative | 3 |
| a | Editor | 260,757 | 122×51 | relative | 4 |
| input | Name of this piece | 12,5 | 114×36 | static | 5 |
| button | Undo | 150,4 | 38×38 | static | 6 |
| button | Redo | 188,4 | 38×38 | static | 7 |
| button | Settings | 226,4 | 38×38 | static | 8 |
| button | Material | 264,4 | 38×38 | static | 9 |
| button | Switch to the dark theme | 302,4 | 38×38 | static | 10 |
| summary | More | 340,4 | 38×38 | static |  |
| main | Tap a space to edit itComposeEdit the i… | 0,46 | 390×706 | static |  |
| aside | Compose | 0,696 | 390×56 | fixed |  |
| button | Tap a space to edit it | 48,697 | 330×56 | static | 29 |
| button/radio | 2D | 17,55 | 41×20 | static | 32 |
| button/radio | 3D | 58,55 | 41×20 | static |  |
| button/radio | Both | 100,55 | 55×20 | static |  |
| input | Doors and fronts | 189,56 | 18×18 | static | 33 |
| summary | Options | 285,50 | 93×30 | static |  |

**Projects, 1280 px** (viewport 1280×900; page 1280×900; horizontal scroll: no; screenshot `projects-1280.png`)

| Element | Name | x,y | w×h | position | tab |
|---|---|---|---|---|---|
| header | Furniture BuilderProjectsCatalog118Edit… | 0,0 | 1280×46 | static |  |
| a | Furniture Builder, go to Projects | 16,4 | 26×38 | static | 1 |
| nav | Places | 54,4 | 306×38 | static |  |
| a | Projects | 59,9 | 96×28 | static | 2 |
| a | Catalog118 | 159,9 | 110×28 | static | 3 |
| a | Editor | 273,9 | 82×28 | static | 4 |
| button | Switch to the dark theme | 1188,4 | 38×38 | static | 5 |
| summary | More | 1226,4 | 38×38 | static |  |
| main | Projects | 160,46 | 960×360 | static |  |
| header | ProjectsCreate a new projectNew single … | 176,70 | 928×125 | static |  |
| h1 | Projects | 197,91 | 87×29 | static |  |
| button | About projects | 288,87 | 38×38 | static | 22 |
| button | Create a new project | 197,136 | 198×38 | static | 23 |
| button | New single piece | 403,136 | 172×38 | static | 24 |
| button | Open from code | 732,136 | 166×38 | static | 26 |
| h2 | Choose a project | 176,219 | 146×25 | static |  |

**Projects, 390 px** (viewport 390×812; page 390×812; horizontal scroll: no; screenshot `projects-390.png`)

| Element | Name | x,y | w×h | position | tab |
|---|---|---|---|---|---|
| header | Furniture BuilderProjectsCatalog118Edit… | 0,0 | 390×52 | sticky |  |
| a | Furniture Builder, go to Projects | 12,4 | 160×44 | static | 1 |
| nav | Places | 0,752 | 390×60 | fixed |  |
| a | Projects | 8,757 | 122×51 | relative | 2 |
| a | Catalog118 | 134,757 | 122×51 | relative | 3 |
| a | Editor | 260,757 | 122×51 | relative | 4 |
| button | Switch to the dark theme | 290,4 | 44×44 | static | 5 |
| summary | More | 334,4 | 44×44 | static |  |
| main | Projects | 0,52 | 390×515 | static |  |
| header | ProjectsCreate a new projectNew single … | 16,68 | 358×279 | static |  |
| h1 | Projects | 33,85 | 87×29 | static |  |
| button | About projects | 124,77 | 44×44 | static | 22 |
| button | Create a new project | 33,130 | 324×44 | static | 23 |
| button | New single piece | 33,182 | 324×44 | static | 24 |
| button | Open from code | 33,286 | 324×44 | static | 26 |
| h2 | Choose a project | 16,367 | 146×25 | static |  |

**Catalog (top of the page), 1280 px** (viewport 1280×900; page 1280×15128; horizontal scroll: no; screenshot `catalog-118-1280.png`)

| Element | Name | x,y | w×h | position | tab |
|---|---|---|---|---|---|
| header | Furniture BuilderProjectsCatalog118Edit… | 0,0 | 1280×46 | static |  |
| a | Furniture Builder, go to Projects | 16,4 | 26×38 | static | 1 |
| nav | Places | 54,4 | 306×38 | static |  |
| a | Projects | 59,9 | 96×28 | static | 2 |
| a | Catalog118 | 159,9 | 110×28 | static | 3 |
| a | Editor | 273,9 | 82×28 | static | 4 |
| button | Switch to the dark theme | 1188,4 | 38×38 | static | 5 |
| summary | More | 1226,4 | 38×38 | static |  |
| main | Catalog | 0,46 | 1280×15081 | static |  |
| header | Catalog118 items in 43 families · 108 o… | 16,66 | 1248×52 | static |  |
| h1 | Catalog | 16,66 | 79×29 | static |  |
| button | About the catalog | 99,62 | 38×38 | static | 22 |
| button | New piece | 1145,66 | 119×38 | static | 23 |
| button/tab | Templates | 21,139 | 84×20 | static | 24 |
| button/tab | Saved on this device | 105,139 | 149×20 | static |  |
| button/tab | Brands | 254,139 | 62×20 | static |  |
| button/radio | By room | 1125,139 | 70×20 | static | 25 |
| button/radio | By type | 1195,139 | 64×20 | static |  |
| input | Search the catalog | 45,191 | 1210×24 | static | 26 |
| input | I check safety-regulated items myself | 16,249 | 18×18 | static | 27 |
| button | About safety-regulated items | 274,239 | 38×38 | static | 28 |
| summary | Template files | 1132,242 | 132×32 | static |  |

**Catalog (top of the page), 390 px** (viewport 390×812; page 390×27606; horizontal scroll: no; screenshot `catalog-390.png`)

| Element | Name | x,y | w×h | position | tab |
|---|---|---|---|---|---|
| header | Furniture BuilderProjectsCatalog118Edit… | 0,0 | 390×46 | sticky |  |
| a | Furniture Builder, go to Projects | 12,4 | 160×38 | static | 1 |
| button | Switch to the dark theme | 302,4 | 38×38 | static | 5 |
| summary | More | 340,4 | 38×38 | static |  |
| main | Catalog | 0,46 | 390×27500 | static |  |
| header | Catalog118 items in 43 families · 108 o… | 16,66 | 358×102 | static |  |
| h1 | Catalog | 16,66 | 79×29 | static |  |
| button | About the catalog | 99,61 | 38×38 | static | 22 |
| button | New piece | 16,130 | 119×38 | static | 23 |
| button/tab | Templates | 21,189 | 84×20 | static | 24 |
| button/tab | Saved on this device | 105,189 | 56×20 | static |  |
| button/tab | Brands | 161,189 | 62×20 | static |  |
| button/radio | By room | 267,189 | 54×20 | static | 25 |
| button/radio | By type | 322,189 | 47×20 | static |  |
| input | Search the catalog | 45,241 | 320×24 | static | 26 |
| summary | More catalog actions | 16,292 | 173×44 | static |  |
| summary | Template files | 16,376 | 132×32 | static |  |
| nav | Jump to a group | 16,352 | 358×99 | static |  |
| a | Living room 33 | 16,352 | 105×30 | static | 31 |
| a | Bedroom 39 | 125,352 | 90×30 | static | 32 |
| a | Dining room 19 | 219,352 | 105×30 | static | 33 |
| a | Home office 16 | 16,386 | 106×30 | static | 34 |

**More menu open, 390 px, Editor** (`editor-more-menu-390.png`; measured separately, see finding F-01)

| Element | Name | x,y | w×h |
|---|---|---|---|
| button | Design file to open on another device | 17,142 | 356×57 |
| button | Front view drawing SVG | 17,199 | 356×57 |
| button | Fusion 360 script not yet tested in Fusion | 17,256 | 356×57 |
| button | Copy code a code or link to open on anothe | 17,312 | 356×57 |
| button | Clean up unused pictures no piece or proje | 17,425 | 356×57 |
| button | Saved data and backup keep, back up and re | 17,482 | 356×57 |
| button | English | 25,578 | 66×32 |
| button | Русский | 95,578 | 74×32 |
| button | Română | 25,645 | 72×32 |
| button | Русский | 101,645 | 74×32 |
| button | English | 179,645 | 66×32 |
| button | Information and guides every feature, by d | 17,690 | 356×57 |
| button | Feature Research papers and decisions | 17,746 | 356×57 |
| button | Gaps what is not built yet | 17,803 | 356×57 |
| button | Tap a space to edit it | 48,697 | 330×56 |


**Reading the Catalog numbers:** the 390 px Catalog page is 27,606 px tall with 723 mapped elements; at 1280 px it is 15,128 px with 640 [M]. I found no pagination or virtualization in `src/ui/CatalogPage.tsx` (a grep for `virtual`, `slice(0` and `limit` returned nothing) [C], so every template card is in the page at once (F-09).

## 6. Flow maps

Evidence for each flow is cited in the step or its closing line. Flows are grouped as Start, Edit, Results and Files. `ST` is a store action, `C` a component.

### 6.1 Start

**F1. First visit.** The bare address opens Projects (empty state: "No projects saved yet. Create a new project or a single piece, or import a file.") with four buttons: Create a new project, New single piece, Import a file, Open from code [M `projects-1280.png`; R `shell/ProjectsPage.tsx:292-335`]. The More menu and the bottom navigation are the other ways out.

**F2. New piece, step by step.** More → New… (or Projects → New single piece, or Catalog → New piece) → "Start something new" dialog with five rows: New piece step by step, Project with several pieces, Fill a wall, Fill the room, Room preset, then a "Start from" template list [M `editor-new-dialog-390.png`; R `Dialogs.tsx:322-350`].
1. Step by step opens the wizard with a steps rail (Type … Review) and a footer of Back, Use defaults, Next, and on Review "Create piece", "Add to project" or "Update piece" [R `Wizard.tsx:586-1054`].
2. Create is disabled while the design has errors; the stated reason is a `title` [C ✔ `Wizard.tsx:1049`; inline problem lists may add text, not fully read].
3. Closing a dirty wizard asks "Close the wizard? Your answers stay as a draft…". A backdrop tap never closes it; there is no Cancel button [R `Wizard.tsx:604-633, 1020`].

**F3. Start from a project.** Create a new project → name prompt (`askText`) → saved and opened in the Editor; a failed save shows an error and opens nothing [R `ProjectsPage.tsx:108-123`]. "Add a piece" inside a project opens a piece list dialog: drag (mouse) or 300 ms long-press (touch) onto the plan, or tap an item and then the plan [R `PieceList.tsx:32-60`, `pieceDrag.ts:15`].

### 6.2 Edit (Compose)

**F4. Size the piece.** Nothing selected: the inspector shows "Compose" and "Edit the {name}" rows. One tap on the drawing selects the whole piece and shows "Size of the whole piece" with millimetre fields [R `Inspector.tsx:213-263`, `PieceSize.tsx:36-40`]. A field commits on blur or Enter, Escape restores, an invalid draft stays marked ("Whole number from {min} to {max}."), and the − and + buttons clamp [R `controls.tsx:52-105`]. Decimals are not accepted [R `controls.tsx:61`]. Locked axes disable the field with a hint [R `PieceSize.tsx:56-67`].

**F5. Select a space.** A tap on the elevation drills one level per tap at the same spot (piece → space → smaller space) [R `Elevation.tsx:160-170`, `designStore.ts:499`]. Leaf spaces are keyboard buttons with labels like "{what} space, {w} by {h} mm"; Enter drills [R `Elevation.tsx:196-214`]. Escape goes up one level; crumbs and (phone only) an "Up one level" button do the same [R `App.tsx` Escape handler, `Inspector.tsx:359-410`]. No drag-box select exists; multi-select exists only in a project (Select toggle, Shift/Ctrl click, Ctrl+A) [R].

**F6. Divide a space.** A leaf shows "Divide this space" with Side by side and Stacked; a split space shows "Division" with a part count and Share or Fixed sizes. Removing parts that hold contents asks first [R `Inspector.tsx:473-490, 833-1000, 859, 983`].

**F7. Change contents and fronts.** Section "Contents" has Empty, Shelves, Drawers, Hanging; changing away from a non-empty kind asks to reset its settings. "Doors and handles" offers None, Door, Doors, Sliding, Flap. "Layouts" is closed by default and asks before replacing [R `Inspector.tsx:497-645`, `Editors.tsx:44, 290`].

**F8. Move, turn, align (project).** Plan drag, arrow keys (10 mm, 100 mm with Shift), the rotate slider handle (a slider with `tabIndex=-1`) and "Turn 90°" buttons, R and Shift+R in 3D, "Move to" buttons that explain themselves when unavailable, and a multi-selection card with Duplicate, Turn, Mirror, Group, Align and Distribute [R `Project.tsx:320-440, 617-618`, `MoveTo.tsx:44-88`, `Selection.tsx:35-300`, `Viewer3D.tsx:486-499, 613-727`].

**F9. Replace, duplicate, delete.**
- Replace (⋯ → Replace…): the dialog closes first, then, if the piece was edited after it was added, a confirm appears; cancelling leaves no dialog open [C ✔ `Replace.tsx:37-50`].
- Duplicate: Ctrl/Cmd+D, the selection card, a phone peek button, or "Add a linked copy" [R `App.tsx:517-534`, `Project.tsx:1173`].
- Delete: a confirm ("Remove "{name}" from this project?"), Cancel is the default on Enter [R `Project.tsx:796-806`].

**F10. Undo and redo.** Header buttons (named "Undo" and "Redo") and Ctrl/Cmd+Z/Y. Piece and project stacks are separate; capped at 100 steps; no on-screen announcement of what was undone [R `App.tsx:248-252`, `designStore.ts:113`].

**F11. 2D, 3D, Both.** A radiogroup. 3D and Both are disabled without WebGL, with a reason shown as text [R `App.tsx:984`]. Placing a piece or drawing a room forces 2D forward [R `viewChoice.ts:44`].

**F12. Save to catalog.** A project piece's ⋯ menu → Save to catalog → name, room, type → "Saved to the catalog. Open in Catalog". A single piece in Compose has no entry for this [R `Project.tsx:1027`, `SaveToCatalog.tsx:49-132`].

**F13. Problems.** In a project, tapping a problem opens a banner with repair choices and an Apply step that is one undo step; on a single piece, problems show inline in the inspector, in Checks and as a badge [R `ProblemBanner.tsx:36-41`, `Project.tsx:1553`, `Inspector.tsx:459`].

### 6.3 Results (Build & Preview)

**F14. Cut list and results tabs.** Tabs in order: Parts (count badge), Sheets, Hardware, Assembly, Shopping list, Checks (error count badge) [R `Output.tsx:41-59`]. On a phone, results stay collapsed until a tab is tapped; tapping the active tab collapses again; the bottom navigation gains a "Cut list" place that opens Checks when there are errors, else Parts [R `Output.tsx:33-35, 76`, `App.tsx:657-678`].

**F15. Download CSV, Print, Client sheet.** Primary yellow "Download CSV", then "Print" and "Client sheet" [M `editor-1280.png`]. Both CSV and Print are disabled when the design has errors; the reason is the button's `title` [C ✔ `Output.tsx:132-139, 156-162`]. The CSV and the printed sheet use the print language (Romanian by default) [R `Output.tsx:134-181`, `PrintClient.tsx:46-93`].

**F16. Materials and edge bands.** Two paths: the Material swatch button in the header opens a dialog to pick parts by role and apply a board; Settings (sliders button) has a boards panel with edge-band naming and a link that closes Settings and opens the Material dialog [R `App.tsx:810-824`, `MaterialDialog.tsx:86-105`, `Dialogs.tsx:626-638, 910`, `BoardBand.tsx:26-70`].

**F17. Sheets, Hardware, Assembly, Shopping.** Sheets lay out boards and say when a layout failed its own check; Hardware lists items with a guidance tip and fastener counts; Assembly steps can be reordered and renamed, "Reset the steps" asks first; Shopping has prices, CSV, print, seller products and an estimate chip in the header that opens it [R `Sheets.tsx:17-124`, `Output.tsx:381-425`, `Assembly.tsx:184-315`, `Shopping.tsx:96-282`, `App.tsx:769`].

### 6.4 Files, projects and settings

**F18. Open, rename, duplicate, delete.** Open by tapping a row ("Open now" marks the current one); rename in the editor header only; duplicate makes "{name} (copy)" without opening it; delete asks, with a second ask for kept versions, and is disabled for the open item (reason in `title`). On a phone (≤ 520 px) the row buttons fold into a ⋯ menu [R `ProjectsPage.tsx:36-269`; C ✔ delete `title` at `ProjectsPage.tsx:259-269`].

**F19. Import and export.** Import a file is in More and on Projects; it validates, shows up to three errors, blocks on errors, gives imported items new ids, and treats project templates separately. Export entries in More depend on context: project file and "Hand to a professional…" in a project; design file, Front view drawing (SVG) and Fusion 360 script on a single piece (SVG and Fusion disabled on errors, with a visible reason) [R `shell/MoreMenu.tsx:121-286`, `importFile.ts:18-109`; C ✔ `MoreMenu.tsx:186-198`].

**F20. Language.** More → Language (reloads the page; designs are autosaved; the user chose this in ADR-153) and Print language (applies at once) [C ✔ `shell/LanguageMenu.tsx:12-26` for the reload; R `LanguageMenu.tsx:31-47, 571-577`].

**F21. History and versions.** Project only: Save a version, Edit history, restore (asks, keeps the current state as a version first), delete a version (asks), and deleted projects' versions restore as a new project [R `History.tsx:106-345`].

**F22. Catalog.** Source tabs Templates, Saved, Brands; search "Search the catalog"; group by room or type with a jump list; Open or Add per card, safety-regulated items need "I check it myself" first [M `catalog-390.png`; R `CatalogPage.tsx:92-166, 426, 660`].

**More menu items** [R `MoreMenu.tsx:121-286`]: New…; Fill the room… (project with a room); Project file and Hand to a professional… (project); Design file, Front view drawing, Fusion 360 script (single piece); Share link (signed in, not in a project); Copy code; Import a file; Clean up unused pictures; Saved data and backup; Assistant (only if a backend is configured); Language; Print language; Information and guides; Feature Research; Gaps.

## 7. UX behaviour details

- **Feedback after actions:** duplicate shows no message and does not open the copy [R `ProjectsPage.tsx:136-143`]; undo shows no announcement [R]; project settings changes show "applied to {n} pieces" [R `ProjectSettings.tsx:45-58`].
- **Empty states:** Projects has one [M]; Hardware and Checks have them; Parts and Shopping with zero lines were not found [R, Suspected].
- **Phone vs desktop differences:** inspector as a sheet (phone) vs a column; mode row vs bottom navigation; results collapsed vs always shown; Options menu holds secondary 3D tools on phone; Settings and Material open inside the sheet on phone, as dialogs on desktop [R].
- **Offline:** the app declares "Works offline." and precaches `js, css, html, svg, woff2` [R `vite.config.ts:42, 49`]. Online features (account, share, assistant) need a configured backend and show offline messages [R `AccountDialog.tsx:91`, `ShareDialogs.tsx:159-164`].
- **Language of output:** the printed sheets, CSV and Client sheet use the print language, which is separate from the UI language [R].

## 8. Findings register

Severity: High = blocks a task or breaks a standard; Medium = a real obstacle with a workaround; Low = inconsistency or polish. "Heur." is the Nielsen heuristic (H1 visibility, H2 match to the real world, H3 user control, H4 consistency, H5 error prevention, H6 recognition over recall, H7 flexibility, H8 minimalist design, H9 recover from errors, H10 help). Status: **Proven** = measured [M] or code read and checked [C ✔]; **Reported** = from a code-mapping pass [R], citation not yet checked by me; **Suspected** = needs a person or a test to confirm.

| ID | Finding | Evidence | Flow | WCAG 2.2 / Heur. | Severity | Status |
|---|---|---|---|---|---|---|
| F-01 | On a phone the More menu is `position: fixed` with `max-height` and `overflow: auto`. Its content is 837 px but only 682 px show at 390×812 (537 px at 390×667, 510 px at 360×640). "Information and guides", "Feature Research" and "Gaps" start at y 690, 746 and 803 and are reachable only by scrolling inside the menu; the bottom navigation covers that area. No scroll cue. | [M] menu check; [C ✔] `styles.css:5280-5289` | More menu, F19, F22 | H6, H7 | Medium | Proven |
| F-02 | The More menu has no `role="menu"`, no arrow-key navigation and no explicit focus return after an item opens a dialog (it relies on native dialog restore). It works as a disclosure. | [C ✔] `MoreMenu.tsx:59-69, 116`; [R] | All | 4.1.2, 2.1.1 (disclosure pattern is acceptable) | Low | Proven (absence) |
| F-03 | Touch targets are below the project's own 44 px rule (`docs/ui-design.md` Control rule, ADR-114) with a coarse pointer emulated. At 390 px: Catalog Open and More buttons 38 px tall (183 and 130 on the page), About this family and Edit template 30 px (68 each), header icon buttons 38×38, Language and Print language chips 32 px, 2D/3D/Both 20 px tall, "Doors and fronts" checkbox 18×18, Options 93×30. Projects page buttons do meet 44 px. | [M] all `*-390.json` files | Everywhere | 2.5.8 (24 px AA): the 20 px switch and 18 px checkbox pass only through the spacing exception, to be checked by hand; 2.5.5 (44 px, AAA) fails. H5 | Medium | Proven |
| F-04 | The reason a primary action is disabled is only a `title` tooltip for Download CSV and Print (errors), the wizard's Create button, and the Move toggle with Exploded on. Tooltips do not appear on touch. "Front view drawing" shows its reason as visible text, so the pattern is inconsistent. | [C ✔] `Output.tsx:132-139, 156-162`; `Wizard.tsx:1049`; `Viewer3D.tsx:618-626`; `MoreMenu.tsx:186-198` | F2, F15 | H1, H9; 3.3.1 and 3.3.3 when an error blocks a task | Medium | Proven |
| F-05 | Export gating differs. CSV, Print, Client sheet, SVG and Fusion are blocked on errors; project file, design file, Copy code and the review pack are not (the review pack shows a hint instead). | [C ✔] `Output.tsx:132-139`; `MoreMenu.tsx:186-198`; `ReviewPack.tsx:134-142` | F15, F19 | H4 | Medium | Proven; needs a rule decision (saving vs exporting) |
| F-06 | One action, several entry points: Import (More and Projects), Shopping (tab and header chip), New piece (Projects, More, Catalog), Materials (header swatch and Settings, linked by a button). | [R] `MoreMenu.tsx:235`, `ProjectsPage.tsx:301`, `App.tsx:769`, `Dialogs.tsx:626-638` | F2, F16 | H4, H8 | Low | Reported |
| F-07 | One action, several labels: "Edit this piece" (button), "Open in the piece editor" (menu) and "Edit {name}" (peek); "Delete" (multi-select) against "Remove from project" (single). | [R] `Project.tsx:380-382, 544, 796-806, 1015-1017`; `Selection.tsx:140-149` | F8, F9 | H4 | Low | Reported |
| F-08 | The Replace dialog closes before its "edited after it was added" confirm, so cancelling leaves no dialog and the user must start again. | [C ✔] `Replace.tsx:37-50` | F9 | H3, H9 | Low | Proven |
| F-09 | The Catalog renders every card at once: 27,606 px tall at 390 px and 723 mapped elements; no pagination or virtualization found. Performance on low-end phones is untested. | [M] page size; [C] grep of `CatalogPage.tsx` | F22 | H7 (efficiency) | Medium | Proven (size); impact Suspected. **Fixed 2026-11-16 (N304):** paged, 15,996 px at 390 px |
| F-10 | Dead and conflicting CSS. 17 selectors that start with `.actions` (for example `styles.css:1460-1526, 2712-2718, 2767-2769`) have no matching element: no `className="actions"` was found in `src/ui`; `.work.mode-compose.sheet-open .side` sets `max-height` twice (52 dvh at 5420 and 40 dvh at 6107, the later wins); 27 `@media (max-width: 760px)` blocks repeat across one 7,682-line file; some comments still describe the retired action bar. | [C ✔] `styles.css:5420, 6107`; grep for `className="actions"`; [R] `styles.css:2712-2718`; [C ✔] `.actions` selectors at `styles.css:1460, 1507, 2767` | Architecture | Maintainability | Medium | Proven |
| F-11 | Design documents drift from the code: `docs/ui-design.md` still describes a three-row phone top bar and a mode row on phones, and says a space does not open the sheet past peek (code opens it to half); `docs/architecture.md` is 34 lines and omits the shell, pages, modes and the sheet. | [R] `docs/ui-design.md:156-157, 183-185, 301`; [C] `docs/architecture.md` length | Architecture | — | Medium | Reported |
| F-12 | Discovery of tap-to-drill: the visible hint is "Tap a space to edit it"; how repeated taps go one level deeper is behind an info tip. | [R] `Inspector.tsx:182-184, 217-221`, `App.tsx:588` | F5 | H6, H10 | Low | Reported |
| F-13 | On a phone, Delete and the lock options have no direct control: the peek row offers Edit, Duplicate and Turn, and the rest sits in ⋯. | [R] `Project.tsx:540-570, 922-1017` | F8, F9 | H7 | Low | Reported |
| F-14 | Keyboard: only leaf spaces are tab stops on the elevation; the rotate handle is `tabIndex=-1` with R or buttons as the alternative; typed rotation is switched off. Alternatives exist, so 2.1.1 is likely met. | [R] `Elevation.tsx:185-214`, `Project.tsx:573, 617-618` | F5, F8 | 2.1.1 | Low | Reported |
| F-15 | No skip link was found. Landmarks exist (header, nav, main, aside, measured), which can satisfy 2.4.1, and the header adds about 12 tab stops before the content. | [M] landmarks and tab order; [R] no skip link | All | 2.4.1 | Low | Suspected |
| F-16 | Language switching reloads the page without an on-screen notice (a user decision in ADR-153). | [C ✔] `LanguageMenu.tsx:12-26` | F20 | H1 | Low | Proven; decision recorded |
| F-17 | Browser Back: Projects uses `replaceState`, so Back from Projects can leave the app; no `popstate` handler found. | [R] `App.tsx:172-184` | Navigation | H3 | Low | Suspected |
| F-18 | Error repair banner only on the project plan; a single piece shows problems inline. Two patterns for the same problem. | [R] `Project.tsx:1553`, `Inspector.tsx:459` | F13 | H4 | Low | Reported |
| F-19 | Save to catalog is not available while editing a single piece in Compose. | [R] `Project.tsx:1027` | F12 | H7 | Low | Reported |

Findings I looked for and dropped:
- The Gaps page title is not translated. That is a user rule (CLAUDE.md, 2026-10-29), not a defect.
- Unnamed controls: my first pass flagged one checkbox in the Catalog; it sits inside a label and is named. After fixing the tool, 0 unnamed.

## 9. Open questions and "not found in the repo"

Needs a person:
1. Is a file save (project file, design file) meant to be blocked by errors like an export? (F-05)
2. Are 38 px header buttons and 32 px language chips acceptable on touch, or should they follow the 44 px rule? (F-03)
3. Should the More menu split into two groups or scroll with a cue on phones? (F-01)

Not found in the repo (within what was read): a skip link; focus moving to the page heading on navigation; a `popstate` handler; drag-box select; a Parts-tab empty state for zero parts; a rename action in the Projects list; a Move toggle on the 2D plan.

Not covered by this audit: the 3D view, the wizard's steps, the Settings and Material dialogs, Gaps, Research, Information, Account, Share and the Assistant beyond their entry points, dark theme, and any state that needs saved data.

## 10. Appendix: file index

- Captures: `docs/research/ui-capture/*.png` and `*.json`, `summary.json` (18 screens: Projects, Catalog, Editor × 390 and 1280 px × default, More menu, New dialog).
- Capture tool: `tools/capture/capture.mjs`, `tools/lib/harness.mjs`; run with `pnpm browser:capture`.
- Shell and layout: `src/ui/App.tsx`, `src/ui/shell/*.tsx`, `src/ui/SheetHandle.tsx`, `src/ui/Dialogs.tsx`, `src/ui/Confirm.tsx`, `src/ui/editorShortcuts.ts`, `src/ui/viewChoice.ts`, `src/styles.css`.
- Editor: `src/ui/Elevation.tsx`, `Inspector.tsx`, `Selection.tsx`, `Editors.tsx`, `Wizard.tsx`, `MoveTo.tsx`, `Variables.tsx`, `Replace.tsx`, `PieceSize.tsx`, `PieceList.tsx`, `ProblemBanner.tsx`, `src/viewer/*`.
- Results, projects, catalog: `src/ui/Output.tsx`, `Sheets.tsx`, `Shopping.tsx`, `Assembly.tsx`, `Project.tsx`, `ProjectSettings.tsx`, `History.tsx`, `CatalogPage.tsx`, `ReviewPack.tsx`, `src/ui/shell/ProjectsPage.tsx`, `MoreMenu.tsx`, `LanguageMenu.tsx`, `importFile.ts`.
- Design documents: `docs/ui-design.md`, `docs/architecture.md`, `docs/backlog.md`, `docs/product/product-context.md`.
