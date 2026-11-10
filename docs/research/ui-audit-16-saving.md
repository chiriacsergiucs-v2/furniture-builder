# UI audit 16 — Saving, backup and sharing: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Saving, backup and sharing (`src/ui/info/features.ts:1334-1369`, 11 feature lines)
- ADR: [ADR-263](../adr-done/ADR-263-ui-audit-saving-every-failure-said-nothing-lost.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px; storage failures by `vi.mock` of
  `src/persist/db` and `src/persist/models`; the online part `src/online/client` mocked, so no request leaves the
  test). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. File actions sit in ⋯ More → Files
(`src/ui/shell/MoreMenu.tsx:121-235`); Saved data and backup is `SavedDataDialog` (`src/ui/SavedData.tsx:320-337`).

| #   | Feature line (features.ts)                   | Sub-flow: entry → steps → end state                                                                                                                                   | Code                                                                                                  | Covering test                                                         | P/D |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --- |
| 1   | Autosave on this device (:1337)              | Any edit → 400 ms → `saveDesign` / `saveProject` → header status "Saving…", "Saved on this device" or "Not saved — browser storage unavailable"; last item reopened | `src/ui/App.tsx:386-462,749-756`                                                                      | `tests/persist.test.ts`                                               | P D |
| 2   | Works offline, as an installed app (:1338)   | First visit caches the app (service worker, `registerType: 'prompt'`) → later visits offline                                                                         | `src/main.tsx:21,42`, `vite.config.ts:37-49`                                                          | `tests/precache.test.ts`                                              | P D |
| 3   | Import and export files (:1343)              | (a) ⋯ → Project file / Design file → `withModels` + `withPictures` → `.json`; (b) ⋯ → Import a file → `importFile` (validated, new id) → opens; notice on a problem | (a) `MoreMenu.tsx:122-133,158-169`; (b) `MoreMenu.tsx:211-227`, `shell/importFile.ts:23-114`          | `tests/rotation.test.ts`, `tests/materials.test.ts`                  | P D |
| 4   | Design codes and links (:1349)               | ⋯ → Copy code → code + link → Copy code / Copy link; Projects → Open from code → paste → `importDocument`; a `#open=` link asks, then opens                         | `src/ui/ShareCode.tsx:20-231`                                                                         | `tests/research-batch-4.test.ts`, `tests/find-it/research-batch-4.test.tsx` | P D |
| 5   | Keep saved data persistent (:1350)           | Saved data → status (kept / not kept / unknown, space used) → Keep saved data → `askPersist` → answer shown                                                         | `SavedData.tsx:120-154`, `src/persist/backup.ts:67-99`                                                | `tests/saved-data.test.tsx`                                           | P D |
| 6   | Back up to a folder or a .zip, restore (:1351) | Saved data → Choose backup folder / Allow / Back up now (folder) **or** Download backup (.zip) → Last backup; Restore from backup / Restore a .zip → new copies + message | `SavedData.tsx:155-292`, `backup.ts:295-421`, core `src/core/backup.ts`                               | `tests/backup.test.ts`, `tests/saved-data.test.tsx`                   | P D |
| 7   | Backup reminder (:1357)                      | After saves and the chosen interval → toast "Last backup: n days ago." → Back up now (folder granted: backs up; else opens Saved data) / Later                        | `SavedData.tsx:412-481`, `src/core/backupReminder.ts`                                                 | `tests/backup.test.ts`                                                | P D |
| 8   | Only-on-this-device notice (:1358)           | Saved items, no backup, nothing in an account → notice → Back up / Sign in / Dismiss (7 days)                                                                       | `SavedData.tsx:343-410`                                                                               | `tests/saved-data.test.tsx`, `tests/find-it/accounts.test.tsx`        | P D |
| 9   | Clean up unused pictures (:1359)             | ⋯ → Clean up unused pictures → `unusedImageIds` → confirm "Delete N pictures…" → `deleteImages` → notice                                                            | `MoreMenu.tsx:73-100,228-231`, `src/persist/db.ts:600-617`                                           | `tests/materials.test.ts:212`, `tests/wall-background.test.ts:117`    | P D |
| 10  | Share links (:1360)                          | Signed in → ⋯ → Share link → links listed → Make a link / Copy link / Stop sharing                                                                                  | `MoreMenu.tsx:196-208`, `src/ui/ShareDialogs.tsx:22-132`                                              | `tests/account-ui.test.tsx`, `tests/find-it/accounts.test.tsx`        | P D |
| 11  | Preview a shared item (:1366)                | `#share=<id>` → `SharedItemFor` → front view, size, parts, Show in 3D → Open a copy (`saveDesign` / `saveTemplate`, new id) or Cancel                              | `src/ui/Share.tsx:23-50`, `ShareDialogs.tsx:147-284`                                                  | `tests/account-ui.test.tsx`, `tests/find-it/accounts.test.tsx`        | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / reload, double tap, edge input,
i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008, selector stability,
persistence and file round trip, and the storage rules (ADR-012: never delete rows the app cannot read, nothing
deletes saved data without the user's decision). Only what failed is listed. Classes: **Proven** (reproduced, output
quoted), **Code-evident** (cited, not run), **Suspected**.

### D16-F1 — A restore or backup the device refuses says nothing (Proven, major)

`SavedDataPanel.run` has `try/finally` and no `catch` (`SavedData.tsx:105-113`). Restore a .zip (`:279-287`), Restore
from backup (`:253-257`) and Download backup (`:219-226`) only set a message on success. `restoreFiles` saves item
by item (`backup.ts:378-390`), so a failure part-way leaves the items already restored and reports none of them.
Reproduction: a backup .zip of one piece, the stored piece changed, `saveDesign` rejecting → Restore a .zip →
`D16-F1 … statuses: ["This browser does not say whether it keeps saved data. …","Last backup: … — 1 item"] alerts: []
button disabled: false unhandled: [ 'Error: QuotaExceededError' ]`.

### D16-F2 — Clean up unused pictures offers pictures that a kept project version still uses (Proven, major)

`unusedImageIds` searches designs, projects, templates and project templates (`db.ts:600-615`), not
`projectVersions`, which hold whole projects (`src/core/projectVersion.ts:13-19`, saved `db.ts:353-357`). The confirm
says "no saved piece, project or template uses" them (`MoreMenu.tsx:84-90`); restoring that version afterwards finds
its picture gone. ADR-048's clean-up (lines 55-56) predates versions (ADR-123).
Reproduction: a picture `img-wall` and a kept version whose project names it, nothing else →
`D16-F2 unused ids: ["img-wall"]`.

### D16-F3 — Preview a shared item: Open a copy says nothing when the save fails and can save two copies (Proven, major)

`open` awaits `saveDesign` / `saveTemplate` with no catch and no in-flight guard (`ShareDialogs.tsx:189-204`), started
with `void` (`:217`). ADR-193's rule for a new project (saved first, a failure said, one tap one thing) is not kept.
Reproduction (online part mocked): two clicks before the dialog closes → `D16-F3 designs added by a double tap: 2
["Chest of drawers#a4d5","Chest of drawers#4cd7"]` (a `user.dblClick` gave 1: the first save finished before the
second click); `saveDesign` rejecting → `dialog still open: true alerts: [] unhandled: [ 'Error:
QuotaExceededError' ]`.

### D16-F4 — Copy code and Copy link say "copied" when the browser refused (Proven, minor)

`copy` swallows a refusal (`ShareCode.tsx:14`) and the buttons set "Code copied." / "Link copied." anyway
(`:77-91`). The Share link dialog says "This browser did not allow copying. Select the link and copy it."
(`ShareDialogs.tsx:57-64`).
Reproduction: `navigator.clipboard.writeText` rejecting → `D16-F4 status after refused copy: ["Code copied."]`.

### D16-F5 — Restoring a file that is not a backup reports success (Proven, minor)

`unzipStore` returns no files for a non-zip (`src/core/zip.ts:100-123`); `restoreText` then says "Restored 0 items as
new copies." and `ok: !p.skipped.length` styles it as success (`SavedData.tsx:62-76,284-285`).
Reproduction: `kitchen-project.json` picked in Restore a .zip → `D16-F5 message: Restored 0 items as new copies.
class: alert ok`.

### D16-F6 — Project file and Design file download nothing and say nothing when a picture or 3D model cannot be read (Proven, major)

`run` closes the menu and starts the export with `void` (`MoreMenu.tsx:105-108`); `withModels` / `withPictures`
rejections are not caught (`:122-133,158-166`). Clean up in the same menu does catch and say
(`MoreMenu.tsx:97-99`).
Reproduction: project, `withModels` rejecting → ⋯ → Project file → `D16-F6 downloads: [] alerts: [] unhandled: [
'Error: UnknownError' ]`.

### D16-F7 — The backup reminder's Back up now hides a failed backup (Code-evident, minor)

With a granted folder the toast closes and runs `void backupNow()` (`SavedData.tsx:455-465`); a failure is recorded
(`backup.ts:311-318`) but only Saved data shows `status.error` (`SavedData.tsx:233-238`); the reminder's re-check
ignores an errored status (`:426`) and comes back as "No backup yet." or "Last backup: n days ago.". The reminder
interval and the notice dismissal are written with `void setSetting` and no catch (`:300,402`).

### D16-F8 — Share link: Make a link sticks and Stop sharing fails in silence when the online part cannot load (Code-evident, minor)

`make` sets `busy` and awaits `online()` outside any `try` (`ShareDialogs.tsx:49-56`): a rejection leaves the button
disabled and the dialog says nothing. Stop sharing awaits `online()` and `stopShare` with no catch (`:100-107`).
`online` is a dynamic import (`src/store/accountStore.ts:125`), which fails offline when the chunk is not cached.

### D16-F9 — English plurals: "Last backup: 1 days ago." and "It has problems to fix: 1 errors." (Code-evident, polish)

`SavedData.tsx:453` and `ShareDialogs.tsx:252` use `{n}` without plural forms; the Russian entries have them
(`src/core/i18n/ru/shell.ts:314`, `ru/account.ts:143-144`).

### D16-F10 — The device-only notice filters inside a Zustand selector (Code-evident; Rejected in FLOW 02)

`SavedData.tsx:347-349` calls `.filter(…).length` inside `useAccount(…)`.

## Checked, no finding

- Import a file: validated before anything is stored, new ids, every failure named (`shell/importFile.ts:23-114`).
- Open from code: guarded by `busy`, errors shown under the field with `aria-invalid` (`ShareCode.tsx:127-198`); a
  `#open=` link asks first and clears the hash (`:209-230`).
- Restore adds new copies only; rows the app cannot read are copied as they are and never overwritten
  (`backup.ts:159-164,355-390`), as ADR-133 decided.
- Clean up keeps pictures named by unreadable rows: rows are searched as text (`db.ts:605-614`), and the open piece or
  project is kept (`MoreMenu.tsx:75-77`).
- Autosave: a failed save is said in the header (`App.tsx:150-155,440-443,456-461`); nothing is written before the
  last item is reopened (`:386-413`).
- Keep saved data: the browser's answer is shown, never hidden (`SavedData.tsx:140-149`, `backup.ts:81-88`).
- Shared item preview: validated before it is shown; the size and parts come from `buildModel` and `cutlist`
  (`ShareDialogs.tsx:136-185`), not from UI geometry.
- Every visible text in the files read goes through `t()`.
