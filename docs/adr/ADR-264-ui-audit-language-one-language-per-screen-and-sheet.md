# ADR-264: UI audit — Language: one language per screen and per printed sheet

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 18, **Language** (`src/ui/info/features.ts:1393-1406`). The full
sub-flow map (5 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-18-language.md](../research/ui-audit-18-language.md).

Summary of the map: both switches are in ⋯ More (`src/ui/shell/LanguageMenu.tsx:37-79`); the UI language is fixed
at load (`src/langInit.ts`, ADR-153, ADR-229) and the print language is kept per device with no reload (ADR-157).
Code texts cannot miss their Russian entry (the type check), and built-in data is covered by
`tests/i18n-data.test.ts`. Reachable at 390 and 1280 px.

What breaks is where a stored English data text meets a screen or a sheet: names shown raw, names put raw into
messages, a label key `tr()` cannot reach, and the cut sheet's front view drawn in the app's language. ADR-155 settled
that built-in data stays English and is shown through `tr()`; ADR-157 that the print language applies to "printed
sheets, drawings' labels".

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                                                                                                                                                                               |
| ------ | ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D18-F1 | Proven       | major    | In Russian, new pieces and projects are named and listed in English (`ProjectsPage.tsx:193`, `App.tsx:571-586`); reproduced: "New project", name field "Sideboard".                                                                                                                                                   |
| D18-F2 | Proven       | major    | The cut sheet's front view labels spaces in the app's language (`PrintSheet.tsx:59`, `Elevation.tsx:27-37`); reproduced: "3 drawers" on a Romanian sheet.                                                                                                                                                             |
| D18-F3 | Proven       | minor    | "Flap fitting: {name}" never translates; its Russian entry is unreachable (`cabinet.ts:719`, `index.ts:110-126`); reproduced in node.                                                                                                                                                                                 |
| D18-F4 | Proven       | minor    | Problem messages put stored board and piece names in raw (`rules.ts:88-92`, `project.ts:1018,1533,1614`); reproduced: «PAL 18 white» in a Russian message.                                                                                                                                                            |
| D18-F5 | Proven       | minor    | With storage blocked, Русский reloads the page in English and says nothing (`LanguageMenu.tsx:16-24`); reproduced: reload 1, stored null, no alert.                                                                                                                                                                   |
| D18-F6 | Proven       | —        | The cut sheet's "De verificat" warnings are in the app's language (`PrintSheet.tsx:172-174`); needs a user answer, see Open questions.                                                                                                                                                                                |
| D04-F5 | Proven       | minor    | Moved here from [ADR-250](ADR-250-ui-audit-aligning-along-each-wall-alone-on-a-phone.md), merged with F4: `pieceName` (`src/core/project.ts:791-797`) returns the stored English name, used by 37 core messages (align, distribute, locks, moves); in Russian: "Не сдвинуто: Base cabinet (изделие 2) закреплено…".   |
| D08-F8 | Code-evident | minor    | Moved here from [ADR-254](ADR-254-ui-audit-boards-every-board-change-told-truly.md), merged with F4: Apply-material, common-panel and shared-sides messages name pieces untranslated (`src/core/finish.ts:408-415`, `src/ui/MaterialDialog.tsx:282-288`, `src/core/common.ts:120-131`, `src/core/shared.ts:124-140`). |

## Decision

One rule: **every text on a screen is in the app's language and every text on a sheet in the print language; stored
built-in names stay English and are translated where they are shown.**

1. **F1:** stored names are shown through `tr()` wherever they are shown raw today: the Projects page rows and their
   labels (`ProjectsPage.tsx:193-233`), the app bar title and "Selected: …" (`App.tsx:571-575`) and the name field's
   start value (`App.tsx:586`; a name the user types is kept as typed). Every create path stores the English text:
   `ProjectsPage.create` uses `newProject()`'s default when the name is empty, and room presets store their English
   names (`roomPresets.ts:93,114,130`, `english()` of the key). `tr()` leaves user-typed names unchanged.
2. **F2:** `Elevation` takes a `print` flag; with it the space labels use `pt()` with new Romanian keys and their
   Russian and English entries in `print-text.ts` (empty, shelves, drawers, hanging). `PrintSheet` passes it.
3. **F3:** `trLoose` also tries the key `"{prefix}: {name}"` for a text "prefix: rest" when that key exists, filling
   `name` with the rest; core only, no model change. The test lists every hardware label with free text in it
   (`cabinet.ts:719`, `panelset.ts:137`, `panel.ts:97`) and checks each in Russian; any that still fails gets a key.
4. **F4 (with D04-F5, D08-F8):** the `t()` calls in `src/core` that put a stored board or piece name into a message pass it through
   `tr()` (a no-op for user-typed names); for pieces this is done once, in `pieceName` (`src/core/project.ts:791-797`),
   and the messages of `finish.ts`, `common.ts`, `shared.ts` and `MaterialDialog.tsx` name pieces through it.
5. **F5:** when saving the language fails, `switchLang` does not reload and the menu says "The language could not be
   saved in this browser’s storage." (`role="alert"`, `t()` with its Russian entry).
6. **F6:** waits for the user (Open questions).

## Alternatives considered

- **F1: store the Russian name when made in Russian** — matches "keeps the name the user sees" literally, but a
  later switch to English shows Russian names, and saved data stops being English (ADR-155 line 21).
- **F2: hide the labels on the print** — the shop loses which space holds drawers; the labels are four texts.
- **F3: store a label key and its parameters on each hardware line** — exact, but changes the model shape
  (`src/core/types.ts`, ADR-011) for a lookup the existing `tr()` can make.
- **F5: reload anyway (today)** — the user sees nothing change and is told nothing (ADR-008: never ignore input
  silently).

## Scope

- In scope: F1–F5 as decided; tests for each.
- Out of scope: F6 until the user answers; translating names the user typed (G-304, user decision 2026-11-05);
  Romanian plural forms in `pt()`.

## Consequences

- Positive: a Russian user sees Russian names and messages; the panel shop gets one language per sheet.
- Negative / risks: F1 shows "Буфет" for a piece the user named "Sideboard" by typing it in Russian; `tr()` cannot
  tell the two apart. Tests that read raw names on the Projects page in English are unaffected (`tr()` is the
  identity in English).

## Done when

- [ ] In Russian, a project from New… and a catalog piece show Russian names on the Projects page, in the title and in the name field, and English after switching back; both create paths store the English name (test).
- [ ] With the print language Romanian, Russian and English, the cut sheet's front view labels are in that language (test).
- [ ] In Russian, a named flap fitting's hardware line reads "Механизм клапана: …", and every free-text hardware label is translated (core test).
- [ ] In Russian, the shelf-span warning names the board «ЛДСП 18 белая» (core test).
- [ ] With storage blocked, Русский does not reload and shows the alert, in English and Russian (test).
- [ ] In Russian, an align or lock message and an Apply-material message name a built-in piece in Russian, e.g. «Нижний шкаф» (D04-F5, D08-F8; core test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Open questions

1. **F6 — language of the cut sheet's warnings.** The "De verificat" list prints each warning in the app's language
   under a heading in the print language. Which?
   - Keep the app's language (today).
   - Print each warning in the print language (a Romanian, Russian and English entry for every warning text).
   - Print only the number of warnings and "see the Checks tab in the app", in the print language.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates, for behaviour an implemented ADR intends, for
conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                                      | Proposer                                                                                                                                                                                                                | Verdict                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| D18-F1 | ADR-155 keeps saved names English, and G-304 says user-typed names are not translated; maybe intended. Could belong to Projects (domain 14). | These are the catalog's own names, not typed ones; the project panel already shows them through `tr()` (`Project.tsx:237,373`), the Projects page and title do not, and two create paths store two languages. Language. | Accepted                            |
| D18-F2 | Overlaps Output (domain 13); the front view is shared with the editor.                                                                       | The print language is this domain's line (`features.ts:1400`); ADR-157 names "drawings' labels". A flag on `Elevation` keeps one drawing. Reproduced on the default Romanian sheet.                                     | Accepted                            |
| D18-F3 | Rare: only a named flap fitting.                                                                                                             | A dictionary entry nobody can reach is a defect in the rule itself, and the same pattern sits in two more labels; the fix is in `tr()`, no model change.                                                                | Accepted                            |
| D18-F4 | ADR-156 translated the message templates; names are data, and checks belong to domain 11.                                                    | ADR-155 shows built-in board names through `tr()`; the message is the one place the same board reads «PAL 18 white». The fix is one `tr()` per name, in the messages ADR-156 made.                                      | Accepted                            |
| D18-F5 | Storage is rarely blocked; ADR-153 chose the reload.                                                                                         | The reload stays; it only waits for a saved choice. The code comment already admits the dead end (`LanguageMenu.tsx:21`).                                                                                               | Accepted                            |
| D18-F6 | Every warning in three languages is a large table for a sheet section.                                                                       | Mixed languages on one sheet go against ADR-157, but the cost and the shop's need are the user's call.                                                                                                                  | Needs user decision                 |
| D04-F5 | Found while auditing Aligning; the messages are Aligning's.                                                                                  | The defect is the language of a stored name, the same cause as F4; one fix in `pieceName` covers every domain. Reproduced in ADR-250's round with the Russian dictionary loaded.                                        | Accepted (moved in, merged with F4) |
| D08-F8 | Found while auditing Boards and edges.                                                                                                       | Same cause and fix as D04-F5; the selection card already shows `tr(pieceName(...))` (`src/ui/Selection.tsx:138`).                                                                                                       | Accepted (moved in, merged with F4) |

No finding moved to another domain ADR. Decided without asking: F1 translates where names are shown and keeps the
stored data English (ADR-155), not the other way round.
