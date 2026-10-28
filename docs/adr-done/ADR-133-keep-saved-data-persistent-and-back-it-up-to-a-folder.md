# ADR-133: Keep saved data persistent and back it up to a folder

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-012
- Design: docs/ui-design.md (Settings dialog, Section card, Alert, Status)
- Backlog: N134
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28): "new ADR for persistent storage and folder backup". Everything is saved in IndexedDB
only (ADR-012: "Clearing site data deletes saved designs; export is the backup"). `navigator.storage.persist()` is
never called in `src/` (grep, 2026-10-28), so the browser may evict the data under storage pressure. No backup
exists beyond one-file exports per design or project. This needs no server and no change to ADR-002.

## Decision

Settled:

- **Persistent storage.** The app calls `navigator.storage.persist()` (when: G-239) and reads
  `navigator.storage.persisted()` and `estimate()`. Settings › **Saved data** shows "Kept: the browser will not
  clear your saved data on its own" or "Not kept: the browser may clear saved data when space runs low. Back up to
  a folder." plus the space used. A refusal is shown, never hidden.
- **Folder backup.** Settings › Saved data › **Choose backup folder** uses the File System Access API
  (`showDirectoryPicker`) where the browser has it; **Back up now** writes the backup; a status line reads
  "Last backup: <date, time> — <n> items" or the error. Each file is the same JSON the app's Import reads today,
  so a backup can be opened item by item without the app.
- The folder handle is kept on the device in a new Dexie table (next free version, add-storage-version skill;
  earlier versions untouched). Browsers ask again for permission after a restart; the app then shows **Allow
  backup folder** instead of failing silently.
- **Restore from backup** reads a folder (or file set), validates each document (ADR-011) and reports skipped
  files by name. It never deletes or overwrites a saved row (ADR-012).
- Pure planning (`planBackup(rows) → files`, `planRestore(files, rows) → actions`) lives in `src/core`.

**Answers (user, 2026-10-28):**

- `persist()` is called **at the first save** (G-239).
- A backup holds **everything the user made**: every saved table (G-240).
- Layout: **one importable file per item**, in a subfolder per table (G-241).
- Backups run **automatically after changes** while the app is open, and from **Back up now** (G-242).
- Without folder access: **Download backup (.zip)** with the same layout (G-243).
- Restore makes **new copies** with new ids and skips items identical to one already saved (G-244).

## Alternatives considered

- **Export buttons only (today)** — one file at a time; nothing reminds or automates.
- **OPFS (origin private file system)** — still inside the browser's storage; cleared with site data.
- **A cloud drive** — needs ADR-126 and a third party; the folder can itself be a synced folder the user chooses.

## Scope

- In scope: persist request and status, folder backup, fallback, restore, Settings section, tests, browser find-it.
- Covered elsewhere: reminders (ADR-141, proposed), the device-only banner (ADR-140, proposed).

## Consequences

- Positive: saved work survives eviction and site-data clearing when a backup exists.
- Negative / risks: folder access differs by browser; permission prompts after restarts.
- Harder to change later: the backup layout once users keep backups.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] `persist()` result and storage estimate shown in Settings › Saved data (jsdom test with a stubbed API).
- [x] `planBackup` covers every row of the chosen tables; unreadable rows are copied as they are (test).
- [x] `planRestore` never deletes or overwrites a saved row; invalid files are listed (test).
- [x] Dexie upgrade test: version 10 rows, including an unreadable one, survive (persist test).
- [ ] Browser find-it on the production build at 390 and 1280 px: Settings › "Saved data", "Choose backup folder",
      "Back up now", "Last backup:"; the fallback shown where folder access is missing (light — catch-up).

## Implementation (2026-10-28)

`src/core/backup.ts` (`planBackup`, `planRestore`), `src/persist/backup.ts` (persist, folder handle in Dexie v11
`settings`, writes one file per item and removes the backup's own files of deleted items, auto backup 4 s after a
save, .zip download and restore), `src/ui/SavedData.tsx` (Settings › Saved data, and ⋯ › Saved data and backup).
Answers: persist at the first save (G-239); everything (G-240); one file per item (G-241); automatic and Back up now
(G-242); .zip where folders are missing (G-243); restore as new copies, identical ones skipped (G-244, G-282).
Tests: `tests/backup.test.ts`, `tests/saved-data.test.tsx`. Browser: the panel renders in the production build at
1280 px (Chromium has folder access); the folder picker itself was not driven (needs a user gesture).

## Open questions

- None open. Answered 2026-10-28, one by one: G-239 at the first save; G-240 everything; G-241 one file per item; G-242 both; G-243 .zip download; G-244 new copies.
