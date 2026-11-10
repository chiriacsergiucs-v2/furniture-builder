# UI audit 18 — Language: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Language (`src/ui/info/features.ts:1393-1406`, 5 feature lines)
- ADR: [ADR-264](../adr/ADR-264-ui-audit-language-one-language-per-screen-and-sheet.md)
- Method: code reading with file:line citations; reproductions run as throwaway tests outside the repo (vitest with
  a scratch config; jsdom over `tests/find-it/setup.tsx` for the UI, node for core texts). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. Both switches are in the More menu
(`src/ui/shell/MoreMenu.tsx:253`, `src/ui/shell/LanguageMenu.tsx:37-79`). The UI language is read before any module
loads (`src/langInit.ts:13-22`) and fixed for the page; texts come from `t()`/`tr()` (`src/core/i18n/index.ts:92-136`)
and print text from `pt()` (`src/core/i18n/print.ts:41-44`).

| #   | Feature line (features.ts)                              | Sub-flow: entry → steps → end state                                                                                                                      | Code                                                                                                      | Covering test                                                                    | P/D |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --- |
| 1   | English or Russian (:1396)                              | ⋯ More → Language → English / Русский → `localStorage fb:lang` → page reload → `langInit` sets the language and loads the Russian chunk → app in Russian | `LanguageMenu.tsx:16-24,44-55`, `langInit.ts:13-22`, `index.ts:51-57` (ADR-229)                           | `tests/find-it/language.test.tsx`, `tests/i18n.test.ts`                         | P D |
| 2   | Every screen translated (:1397)                         | Any screen in Russian: code texts through `t()` with a Russian entry (type-checked), generated part names through `tr()`                                 | `index.ts:92-95`, `src/core/i18n/ru/*.ts`                                                                 | `tests/i18n.test.ts`, `pnpm typecheck` (a key without Russian fails)             | P D |
| 3   | Catalog, wizard and research translated (:1398)         | Catalog, Start from, wizard, research in Russian through `tr()`; stored data stays English                                                              | `index.ts:130-136`, `ru/data-*.ts`                                                                        | `tests/i18n-data.test.ts`, `i18n-wizard.test.ts`, `i18n-research*.test.ts`        | P D |
| 4   | Problem messages translated (:1399)                     | Diagnostics, notices and storage messages built with `t()` at the time they are made, shown in the space editor and Checks                              | `src/core/*` `t()` calls, `Inspector.tsx:466`                                                             | `tests/i18n.test.ts:85`                                                        | P D |
| 5   | Print language: Romanian, Russian or English (:1400)    | ⋯ More → Print language → Română / Русский / English → `fb:print-lang`, no reload → cut sheet, client sheet, assembly, CSV, review pack in that language | `LanguageMenu.tsx:27-35,57-76`, `print.ts`, `print-text.ts`, `PrintSheet.tsx`                             | `tests/i18n-print.test.ts`, `tests/ro.test.ts`, `language.test.tsx:36-46`        | P D |

## Bug hunt

Each check below was applied to every sub-flow: storage blocked / reload, unsaved work, edge input (names with
numbers, user-typed names), i18n (every visible text in the language chosen for that screen or sheet), accessibility
(role, label, `lang`, pressed state), 390 px, persistence. Only what failed is listed. Classes: **Proven**
(reproduced, output quoted), **Code-evident** (cited, not run), **Suspected**.

### D18-F1 — In Russian, new pieces and projects are named and listed in English (Proven, major)

The catalog shows "Буфет" but the piece is made with the data name "Sideboard"; New… → Project with several pieces
makes "New project" (`Dialogs.tsx:190`, `newProject()` default `src/core/project.ts:555`). Those names are shown raw on
the Projects page (`src/ui/shell/ProjectsPage.tsx:193`, also in its labels `:214-233`), in the app bar title and
"Selected: …" (`App.tsx:571-575`) and in the name field (`App.tsx:586`), while the project panel shows the same names
through `tr()` (`Project.tsx:237,373`). The Projects page's own Create stores the translated `t('New project')`
(`ProjectsPage.tsx:111`), and room presets store `t(...)` names (`src/core/catalog/roomPresets.ts:93,114,130`), so a
project made in Russian keeps a Russian name after a switch to English. ADR-155 lines 21-22: the data stays English,
and "a design saved while Russian is chosen keeps the name the user sees".
Reproduction (Russian UI): `D18-F1 stored project names [ 'New project' ]`,
`D18-F1 Projects page shows [ 'New project', 'New project: 0 изделий', 'Настройки: New project' ]`; Start from →
"Буфет…" → `D18-F1b design.name Sideboard textboxes [ 'Sideboard' ]`.

### D18-F2 — The printed cut sheet's front view labels its spaces in the app's language (Proven, major)

The cut sheet draws the editor's `<Elevation />` (`PrintSheet.tsx:59`), whose space labels come from `t()`
(`Elevation.tsx:27-37,247`). ADR-157 Decision: the print language "applies to printed sheets, drawings' labels".
Reproduction (UI English, print Romanian, the default): `D18-F2 print headings: ["Vedere frontală","Listă de piese",…] |
front-view labels: ["12 shelves","3 drawers","1 shelf","Lateral stânga","Spate","Despărțitor"]`.

### D18-F3 — "Flap fitting: {name}" is never translated; its Russian entry is dead (Proven, minor)

`cabinet.ts:719` writes the hardware label as a literal `Flap fitting: ${fl.fitting}`. The dictionary has
`'Flap fitting: {name}'` (`src/core/i18n/ru/data-parts.ts:220`), but `tr()` fills placeholders only from numbers and
splits "A: B" only into two known texts (`index.ts:110-126`), so the key is never reached; the Hardware tab shows it
through `tr(h.label)` (`src/ui/Output.tsx:403`).
Reproduction (node, Russian): `tr("Flap fitting: Blum Aventos") = "Flap fitting: Blum Aventos"`,
`tr("Flap fitting: HK-XS 20K2301") = "Flap fitting: HK-XS 20K2301"`. Other literal labels with free text in them:
`src/core/panelset.ts:137` ("Screws: {a} to {b}"), `src/core/panel.ts:97` ("{label} fixing kit").

### D18-F4 — Problem messages put stored board and piece names in untranslated (Proven, minor)

Messages built with `t()` take a board or piece name as is: `rules.ts:88-92` (`name: m.name`), `project.ts:1014-1018`,
`:1533`, `:1614`. Built-in board and piece names are English data shown elsewhere through `tr()` (ADR-155).
Reproduction (node, Russian, every catalog cabinet with adjustable shelves): `Пролёт полки 1162 мм велик для «PAL 18
white» 18 мм …`, while `tr("PAL 18 white") = "ЛДСП 18 белая"`, the name the board list shows.

### D18-F5 — With storage blocked, Русский reloads the page in English and says nothing (Proven, minor)

`switchLang` swallows the failed `setItem` and reloads anyway (`LanguageMenu.tsx:16-24`, comment "the reload stays
in the old language"). The user taps Русский, the page reloads, nothing changed, no reason given.
Reproduction (390 px, `Storage.prototype.setItem` throwing): `D18-F5 reload called 1 stored null alerts []`.

### D18-F6 — The cut sheet's "De verificat" list is in the app's language (Proven, needs a user answer)

Warnings are printed as `w.message` (`PrintSheet.tsx:172-174`), made with `t()` in the UI language, under a heading
in the print language. Reproduction (UI English, print Romanian): `"De verificat" … warning lines: ["Choose the
lift-up system for this 539×718 mm front from its datasheet and name it here."]`. Printing every warning in three
languages means a Romanian and English entry per warning text (`print-text.ts` holds print text only today).

## Checked, no finding

- Russian code texts: a `t()` key without a Russian entry fails `pnpm typecheck` (`index.ts:21,92`), so screens cannot
  gain an untranslated code text unnoticed.
- Built-in data: catalog, templates, samples, boards, fastener types and rules are covered by
  `tests/i18n-data.test.ts:65-104`. Generated texts after twelve common space edits on every catalog cabinet (sliding,
  flap, niche, sink notch, fixed front, adjustable shelves, hanging, drawers behind doors, bar handles): all Russian
  except F3, F4 and the product term "clip-on" kept in the hinge name.
- The switch buttons carry `lang` and `aria-pressed` (`LanguageMenu.tsx:46-51,62-68`); the page sets
  `document.documentElement.lang` (`langInit.ts:19`).
- Unsaved work on the reload: autosave runs 400 ms after a change (`App.tsx:430-448`), shorter than opening the menu
  and tapping; a failed save already shows its state. Not reproduced as a loss.
- Print language: no reload, kept per device (`LanguageMenu.tsx:27-35`), the client and assembly sheets draw
  `PieceElevation` with no space labels (`PrintClient.tsx:52`, `Assembly.tsx:496`).
- The Gaps page is not translated by the user's rule (CLAUDE.md, 2026-10-29); not a finding.
