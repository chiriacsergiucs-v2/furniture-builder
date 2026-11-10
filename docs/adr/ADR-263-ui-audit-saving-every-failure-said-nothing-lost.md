# ADR-263: UI audit — Saving, backup and sharing: every failure said, nothing lost, one tap one copy

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 16, **Saving, backup and sharing**
(`src/ui/info/features.ts:1334-1369`). The full sub-flow map (11 feature lines, entry → steps → end state, code and
tests per row) and the evidence are in [docs/research/ui-audit-16-saving.md](../research/ui-audit-16-saving.md).

Summary of the map: autosave and the header status (`src/ui/App.tsx:386-462,749-756`); ⋯ More → Files: Project or
Design file, Copy code, Share link, Import a file, Clean up unused pictures, Saved data and backup
(`src/ui/shell/MoreMenu.tsx:121-235`); the Saved data panel, device-only notice and backup reminder
(`src/ui/SavedData.tsx`); share links and the shared item preview (`src/ui/ShareDialogs.tsx`). All are reachable at
390 and 1280 px.

The storage rules are settled: never delete rows the app cannot read and nothing deletes saved data without the
user's decision (ADR-012); restore adds copies only (ADR-133); a save is made before something opens and a failure
is said, one tap makes one thing (ADR-193, ADR-248). Import a file and Open from code keep them; restore, export,
the shared item copy and the picture clean-up do not.

## Findings

| Id      | Class        | Severity | Finding                                                                                                                                                      |
| ------- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D16-F1  | Proven       | major    | Restore a .zip, Restore from backup and Download backup say nothing when the device refuses (`SavedData.tsx:105-113`); reproduced: no message, unhandled.    |
| D16-F2  | Proven       | major    | Clean up unused pictures offers pictures a kept project version uses (`db.ts:600-615` skips `projectVersions`); reproduced: `["img-wall"]`.                  |
| D16-F3  | Proven       | major    | Shared item Open a copy: a failed save says nothing; two clicks before it closes save two copies (`ShareDialogs.tsx:189-204,217`).                           |
| D16-F4  | Proven       | minor    | Copy code / Copy link say "copied" when the browser refused (`ShareCode.tsx:14,77-91`); reproduced: "Code copied.".                                          |
| D16-F5  | Proven       | minor    | A file that is not a backup restores as "Restored 0 items as new copies." in the success style (`SavedData.tsx:62-76,284-285`).                              |
| D16-F6  | Proven       | major    | Project file / Design file download nothing and say nothing when a picture or 3D model cannot be read (`MoreMenu.tsx:105-108,122-166`).                      |
| D16-F7  | Code-evident | minor    | The reminder's Back up now hides a failed backup; reminder and notice settings are written unchecked (`SavedData.tsx:300,402,455-465`).                      |
| D16-F8  | Code-evident | minor    | Share link: Make a link stays disabled and Stop sharing fails in silence when the online part cannot load (`ShareDialogs.tsx:49-56,100-107`).                |
| D17-F3  | Moved here   | minor    | Account › Shared links: Stop sharing fails without a word and a failed list hides the section (`AccountDialog.tsx:458-483`); from ADR-264, reproduced there. |
| D16-F9  | Code-evident | polish   | "Last backup: 1 days ago." and "It has problems to fix: 1 errors." in English (`SavedData.tsx:453`, `ShareDialogs.tsx:252`).                                 |
| D16-F10 | Rejected     | —        | `.filter(…).length` inside the device-only notice's selector (`SavedData.tsx:347-349`); see Cross-examination.                                               |

## Decision

One rule for everything that writes, reads or copies saved data: **a failure is said where the user tapped, nothing
is deleted that a saved thing still names, and one tap makes one copy.**

1. **F1:** `run` catches and sets `{ ok: false, text }`: "The restore stopped: this browser’s storage refused a save.
   {n} items were restored before it." (`restoreFiles` returns the count done so far with the error), "The backup
   could not be made in this browser." for Download backup.
2. **F2:** `unusedImageIds` also searches `projectVersions` (as text, like the other tables); the confirm text is
   unchanged and becomes true.
3. **F3:** `open` gets an in-flight ref and `try/catch`; a failure shows "The copy could not be saved in this
   browser’s storage." (the ADR-193 sentence's wording) in the dialog and keeps it open.
4. **F4:** `copy` returns whether it worked; on a refusal the dialog says the Share link dialog's sentence.
5. **F5:** a restore that finds no backup file says "No backup files found in {name}. Choose a backup .zip made by
   this app." as a warning.
6. **F6:** the Project file and Design file exports catch and say "The file could not be made: pictures or 3D models
   could not be read from this browser." through the app notice (`setNotice`, as Clean up does).
7. **F7:** the reminder's Back up now shows the backup's error in the toast (or opens Saved data, which shows it);
   the two `setSetting` calls catch and say "The setting could not be saved on this device.".
8. **F8:** `make` and Stop sharing catch and show the error in the dialog's alert; `busy` is cleared in `finally`.
   **D17-F3** (moved from ADR-264): Account › Shared links does the same for Stop sharing, and a failed list says
   "Shared links could not be loaded." instead of hiding the section.
9. **F9:** `{n|# day|# days}` and `{n|# error|# errors}` in the English keys (Russian entries unchanged).
10. **F10:** no change (rejected).

## Alternatives considered

- **F2: never delete a picture a version names, but hide it from the count** — the same result with a less honest
  count; searching one more table is simpler.
- **F1: restore in one transaction, all or nothing** — cleaner, but `saveDesign`/`saveProject` also index and emit
  events per row; a larger change to `src/persist` than saying what happened.
- **F3: disable the button only** — two pointer events can arrive before the render; the ref is what makes it one
  (as ADR-248 F4).

## Scope

- In scope: F1–F9 as decided; tests for each.
- Out of scope: what a restored version does when a picture is already gone (no such case after F2); the service
  worker's update prompt (no finding).

## Consequences

- Positive: every saving, backup and sharing path says its failure; the clean-up keeps what a version needs.
- Negative / risks: F2 reads the versions table on each clean-up (text search, once per tap).

## Done when

- [ ] A refused restore and a refused backup .zip say so and how many items were restored; no unhandled rejection (test).
- [ ] A picture named only by a kept project version is not offered by Clean up unused pictures (storage test).
- [ ] Open a copy saves one copy on two fast clicks, and a refused save is said with the dialog kept open (test).
- [ ] A refused clipboard is said in Copy code for the code and the link (test).
- [ ] Restoring a file that is not a backup says so as a warning (test).
- [ ] Project file with a failing model or picture read says why; no unhandled rejection (test).
- [ ] The reminder shows a failed backup; Share link and Account › Shared links errors are said and leave the buttons usable; English plurals read right (test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates, for behaviour an implemented ADR intends, for
conflicts with the hard rules, for over-engineering and for missing tests.

| Id      | Skeptic                                                                               | Proposer                                                                                                                                                                              | Verdict  |
| ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D16-F1  | Storage refusing a restore is rare.                                                   | Rare, but restore is what the user runs after losing data; a silent half-restore is the worst moment to say nothing. Reproduced: no message, unhandled rejection.                     | Accepted |
| D16-F2  | ADR-048 (lines 55-56) scans "stored design, project or template": as decided.         | ADR-048 predates versions (ADR-123); a version is a stored project, and ADR-012 lets nothing delete saved data the user did not choose; the confirm text would be untrue. Reproduced. | Accepted |
| D16-F3  | `user.dblClick` made one copy; and the shared preview belongs to Account (domain 17). | Two clicks before the render made two (reproduced); ADR-193 and ADR-248 F4 settle the guard. The feature line is in this domain (`features.ts:1366`).                                 | Accepted |
| D16-F4  | Clipboard refusal is the browser's business.                                          | The app already says it in the Share link dialog (`ShareDialogs.tsx:57-64`); saying "copied" when nothing was copied is untrue. Reproduced.                                           | Accepted |
| D16-F5  | The message is accurate: zero items.                                                  | Styled as success (`alert ok`) right after the user chose a wrong file; ADR-133's restore is for recovery, the user needs to know the file was not a backup. One branch.              | Accepted |
| D16-F6  | Duplicate of D13-F5 (review pack).                                                    | Same cause, different flow and domain: D13-F5 is the review pack dialog, this is the menu's file export, which has no dialog to say it in. Reproduced.                                | Accepted |
| D16-F7  | Folder backups are desktop Chromium only.                                             | Still the main backup path there; a failed backup that comes back as "No backup yet." misleads. Code-evident: `SavedData.tsx:426,455-465`.                                            | Accepted |
| D16-F8  | The online part is opt-in; offline the user would not be signed in.                   | A signed-in session persists offline (ADR-134); `online()` is a dynamic import (`accountStore.ts:125`) and `busy` stays set (`ShareDialogs.tsx:50-53`), a dead end.                   | Accepted |
| D17-F3  | Moved from ADR-264 (Account): same Stop sharing pattern as D16-F8.                    | Share links are this domain's feature line (`features.ts:1360-1366`); one fix pattern for both dialogs.                                                                               | Accepted |
| D16-F9  | Polish.                                                                               | Two keys, Russian entries already plural (`ru/shell.ts:314`, `ru/account.ts:143-144`).                                                                                                | Accepted |
| D16-F10 | The rule says no `.filter()` inside a selector.                                       | The rule exists to keep references stable; this selector returns a number, which compares equal between renders. Not a re-render bug.                                                 | Rejected |

No question needs the user: every accepted fix follows an implemented ADR's rule (ADR-012, ADR-133, ADR-193). Decided
without asking: F2 searches versions rather than deleting around them.
