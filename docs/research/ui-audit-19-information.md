# UI audit 19 — Information: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Information (`src/ui/info/features.ts:1407-1443`, 7 feature lines)
- ADR: [ADR-266](../adr-done/ADR-266-ui-audit-information-honest-pages-and-banners.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom and node tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 390 and 1280 px). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The three pages are reached from ⋯ More
(`src/ui/shell/MoreMenu.tsx:255-266`) and by hash (`#info`, `#research`, `#gaps`, `src/ui/App.tsx:157-183`); they are
lazy (`App.tsx:74-76`) and rendered at `App.tsx:895-899`.

| #   | Feature line (features.ts)                   | Sub-flow: entry → steps → end state                                                                                                                                         | Code                                                                                                      | Covering test                                                              | P/D |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --- |
| 1   | Information and guides page (:1410)          | ⋯ → Information and guides → Features tree (domains open on desktop, closed on a phone) → a domain → its features with ADRs → Back to the editor                            | `src/ui/Info.tsx:10-68`, data `src/ui/info/features.ts`                                                   | `tests/find-it/info.test.tsx`                                              | P D |
| 2   | Feature Research (:1412)                     | ⋯ → Feature Research → Features / Competitors tabs → filters, sort, group → a feature → decision, implementation status, notes (`setMarks` → IndexedDB)                    | `src/ui/Research.tsx:89-214,610-900,1029-1300`, store `src/store/researchStore.ts:47-92`                  | `tests/i18n-research*.test.ts`, `tests/find-it/research-built-rows.test.tsx`, `research-batch-4.test.tsx` | P D |
| 3   | Gaps page (:1418)                            | ⋯ → Gaps → counts, search, status and rating filters → a gap → Acknowledge / Make ADR / note (saved after 400 ms) → Copy decisions                                          | `src/ui/Gaps.tsx:43-452`, core `src/core/gaps.ts`, storage `src/store/libraryStore.ts`                    | `tests/gaps-page.test.ts`, `tests/find-it/gaps-ratings.test.tsx`           | P D |
| 4   | Gap marks in a file (:1425)                  | Gaps → Export marks → `gap-marks-<date>.json`; Import marks → file → `readGapMarksFile` → newer mark wins → "Imported N marks, skipped M."                                 | `Gaps.tsx:129-176`, core `gaps.ts:225-301`                                                                | `tests/gap-marks-file.test.ts`, `tests/find-it/band-list-gap-marks.test.tsx` | P D |
| 5   | Info buttons (:1432)                         | ⓘ beside a heading or label → tap (touch) or hover / focus (mouse, keyboard) → popover `role="note"` → tap outside, second tap or Esc closes, focus back on the button      | `src/ui/controls.tsx:470-561`                                                                             | `tests/find-it/info-tip.test.tsx`                                          | P D |
| 6   | Arrow keys in segmented controls (:1434)     | Tab → the chosen option → ←/→/↑/↓, Home, End move and choose, wrapping                                                                                                      | `controls.tsx:110-145` (`rovingTab`, `rovingKeys`), `Segmented` `controls.tsx:148-200`; hand-written groups (ADR-202 item 9) | `tests/roving-segmented.test.tsx`                                          | P D |
| 7   | Light and dark themes (:1440)                | Top bar → moon / sun → `setTheme` → `data-theme` on `<html>`, kept in `localStorage` (`fb:theme`)                                                                          | `App.tsx:816-826`, `src/store/useTheme.ts`                                                                | not found in the repo (no test names `setTheme` or "Switch to the dark theme") | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / reload, double tap, edge input, i18n
(the Gaps page is not translated by user rule, CLAUDE.md), accessibility (role, label, focus, keyboard), 390 px,
ADR-008, selector stability, persistence and import/export round-trip. Only what failed is listed. Classes: **Proven**
(reproduced, output quoted), **Code-evident** (cited, not run), **Suspected**.

### D19-F1 — Information and guides offers "Back to the editor" with nothing open (Proven, minor)

ADR-120 item 5 (line 23): "Back to the editor … shows only when a design is open." Feature Research and Gaps keep it
(`designOpen`, `Research.tsx:152`, `Gaps.tsx:191`); `InfoPage` takes no `designOpen` and always shows it
(`Info.tsx:55-58`; `App.tsx:899` passes only `onDone`). Reproduction at 390 px from the bare app:
`D19-F1 info Back to the editor shown: true`, `research … shown: false`, `gaps … shown: false`; tapping it lands on
`#editor` with the start-up placeholder (`D19-F1 after Back: hash #editor`).

### D19-F2 — Import marks says "Imported 1 mark" when nothing changed (Proven, minor)

`readGapMarksFile` counts every valid known row as imported, including rows older than the device's mark that are not
applied (`gaps.ts:290-298`); the page prints that count (`Gaps.tsx:170-173`). Reproduction (device mark newer than
the file's): `D19-F2 {"apply":0,"imported":1,"skipped":0} → message: Imported 1 mark, skipped 0.` The user believes the
other device's mark arrived. ADR-212 item 2 fixed the words "Imported N marks, skipped M" but not what N counts; ADR-244
asks that a result never be reported as applied when it was not.

### D19-F3 — The Results tab bar has no arrow keys and six Tab stops (Proven, minor; Moved to ADR-260 in FLOW 02)

The Results tabs (`src/ui/Output.tsx:56-75`) are `role="tablist"` / `role="tab"` without `rovingKeys` or `rovingTab`:
`D19-F3 tabs [["Parts16","true",0],["Sheets","false",0],…]` (every tab `tabIndex` 0) and
`after ArrowRight: focused "Parts16" selected ["Parts16"]`. The Research sections and the Catalog Source tablists do have
them (`Research.tsx:164-188`, `CatalogPage.tsx:151`). ADR-202 item 9 listed the groups it covered and did not name the
Results tabs; the tablist also has no accessible name.

### D19-F4 — Research section tabs have no tab panel (Code-evident, minor)

`Research.tsx:164-188` gives the buttons `role="tab"` and `aria-selected` but no `aria-controls`, and the content below
(`Research.tsx:189-210`) has no `role="tabpanel"`; the Results tabs show the full pattern (`Output.tsx:66,76-80`). A
screen reader announces tabs that control nothing.

### D19-F5 — A storage error banner stays after later saves succeed (Proven, minor)

`setMarks` sets `error` on a failed save and never clears it on a later success (`researchStore.ts:84-91`).
Reproduction (first `saveResearchMarks` rejects, the second resolves):
`D19-F5 after failed save error: Your decision could not be saved on this device.` and
`D19-F5 after successful save error: Your decision could not be saved on this device.` The Gaps page does the same with
"Your mark could not be saved on this device." (`Gaps.tsx:72-73`, Code-evident). Both banners then say something
untrue until the page is left.

## Checked, no finding

- Information page: every name and detail goes through `t()` with a `Key` type (`features.ts:7-25`, `Info.tsx:14,20-21`),
  so a line without a Russian entry fails the type check; phone starts closed, desktop open (`Info.tsx:37-38`).
- Info buttons: hover / focus with a mouse and a tap on touch, Esc returns focus — the ADR-080 behaviour kept by
  ADR-113 line 22-23; a click while hovering keeps it open, as decided.
- Segmented controls: every `role="radiogroup"` and `role="tablist"` in `src/ui` and `src/viewer` uses `rovingKeys`
  except the wizard type radios (own arrow handling, ADR-202 item 9 → ADR-194) and the Results tabs (D19-F3).
- Gap marks: the read waits for stored marks before any write (`Gaps.tsx:58-70`); a pending note is flushed on
  `pagehide` and unmount (`Gaps.tsx:75-90`); an imported newer mark cancels a pending older note (`Gaps.tsx:156-162`).
- Research page: shipped papers show even when storage fails, with the warning (`researchStore.ts:53-72`).
- Themes: the choice is kept on the device only (`useTheme.ts:41-51`, ADR-030 line 21); there is no way back to
  "follow the system" once a theme is picked, which ADR-030 does not ask for — not a finding.
- Visible text on the Information and Research pages goes through `t()`/`tr()`; the Gaps page is English by user rule.
