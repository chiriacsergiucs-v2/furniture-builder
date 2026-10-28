# ADR-133: Keep saved data persistent and back it up to a folder

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-012
- Design: docs/ui-design.md (Settings dialog, Section card, Alert, Status)
- Backlog: N134
- Acceptance: browser

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

- [ ] `persist()` result and storage estimate shown in Settings › Saved data (jsdom test with a stubbed API).
- [ ] `planBackup` covers every row of the chosen tables; unreadable rows are copied as they are (test).
- [ ] `planRestore` never deletes or overwrites a saved row; invalid files are listed (test).
- [ ] Dexie upgrade test: version 10 rows, including an unreadable one, survive (persist test).
- [ ] Browser find-it on the production build at 390 and 1280 px: Settings › "Saved data", "Choose backup folder",
      "Back up now", "Last backup:"; the fallback shown where folder access is missing.

## Open questions

- Ask the browser to keep data at the first save, or only from a button? Suggested: at the first save, state in
  Settings (+2 %) (G-239).
- Backup contents: everything you made, or pieces, projects and templates only? Suggested: everything (+10 %,
  +25 % value) (G-240).
- Layout: one importable file per item in subfolders, or one .zip? Suggested: one file per item (+5 %) (G-241).
- Trigger: Back up now, automatic after changes, or both? Suggested: both (+15 %) (G-242).
- Browsers without folder access (e.g. iPhone Safari, Firefox; verify on MDN): a .zip download, or nothing?
  Suggested: .zip (+5 %) (G-243).
- Restore as new copies or by id replacing rows? Suggested: new copies, skipping identical items (G-244).
