# ADR-305: Move deleted projects and pieces to a 30-day Recently deleted list

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-012, ADR-078
- Design: docs/ui-design.md (Projects page)
- Backlog: N431

## Context

G-014: deleting a saved project or single piece on the Projects page
([ADR-078](../adr-done/ADR-078-rebuild-the-app-shell-projects-catalog-and-editor-as-separat.md)) is final ("This
cannot be undone."). The user decided on 2026-11-27: "Recently deleted only": a delete on the Projects page moves the
item to a 30-day "Recently deleted" list, from which it can be restored or deleted forever; no persistent undo stack.
[ADR-051](../adr-done/ADR-051-add-undo-and-redo-for-project-changes.md) (project history is not saved and starts
empty on open) stays as it is. This adds a Dexie table, so it needs a new Dexie version
([ADR-012](../adr-done/ADR-012-local-persistence-in-indexeddb-with-autosave-corrupt-rows-ar.md): never edit a shipped
version, never delete rows the app cannot read).

## Decision

- **Dexie v13** adds one table, `recentlyDeleted: 'key, deletedAt'`, and repeats every v12 table unchanged. No
  upgrade function: no existing row is read or rewritten.
- A row is `{ key: '<table>:<id>', table: 'designs' | 'projects', id, name, deletedAt, row }`, where `row` is the
  stored design or project row exactly as it was, readable or not.
- **Delete** on the Projects page (`moveToRecentlyDeleted`) copies the row into `recentlyDeleted` and removes it from
  its table in one transaction, and reports the design or project as deleted, as the final delete did (ADR-235: the
  folder backup and the account follow it). The confirm says "It stays in Recently deleted for 30 days." instead of
  "This cannot be undone.". The kept-versions question (ADR-203, G-190) is unchanged.
- **Recently deleted** is a folded group on the Projects page, newest first, each row with its name, kind and delete
  date, a **Restore** button and a **Delete forever** button (asks first).
- **Restore** puts the stored row back under its own id, unchanged, and reports it saved. If a row with that id exists
  again, nothing is written and the page says so.
- **Delete forever** removes the one `recentlyDeleted` row, only on the user's confirm.
- **30-day purge rule:** on app start, rows whose `deletedAt` is more than 30 × 24 h before now **and** whose document
  still validates are removed, and the app shows "{n} items deleted more than 30 days ago were removed from Recently
  deleted." A row whose `deletedAt` or document the app cannot read is never purged (ADR-012); it stays listed until
  the user deletes it forever. Nothing is purged at any other time.
- `deleteDesign` and `deleteProject` stay final for their other callers (the account sync, tests).
- `recentlyDeleted` is not in the folder backup or the account (`BACKUP_TABLES` unchanged): it holds items the user
  chose to remove. Pictures an item in the list uses are kept (`unusedImageIds` reads these rows too).

## Alternatives considered

- **A `deletedAt` flag on the designs and projects rows** — every reader (lists, backup, account upload, picture
  cleanup) would have to filter it; a missed reader shows deleted work again.
- **Keep the undo stack per project in IndexedDB** (the gap's first suggestion) — rejected by the user ("Recently
  deleted only").
- **Purge on a timer or when the list is opened** — a purge the user may not see; app start with a shown count is
  explicit.

## Scope

- In scope: the v13 table, move, list, restore, delete forever, the start-up purge and its notice, the Projects page
  group, Russian entries for every new text.
- Out of scope: a persistent undo stack (user decision 2026-11-27, G-014); Recently deleted for project templates,
  kept versions or 3D models (not asked).

## Consequences

- Positive: a mistaken delete on the Projects page can be undone for 30 days, on this device, offline.
- Negative / risks: deleted items keep using device storage, and their pictures, for up to 30 days.
- Harder to change later: a Dexie upgrade cannot be undone; v13 stays in the schema.

## Done when

- [x] Dexie v13 adds `recentlyDeleted`; opening a v12 database keeps every row of every table (storage test).
- [x] Delete moves a design and a project to Recently deleted; they are listed newest first (storage test).
- [x] Restore puts the row back unchanged; a taken id is refused and nothing is written (storage test).
- [x] Delete forever removes the one row (storage test).
- [x] The purge removes readable rows older than 30 days, keeps newer and unreadable rows, and returns the count
      (storage test).
- [x] Projects › Delete → Recently deleted → Restore brings the project back, at 390 and 1280 px (jsdom find-it).
- [x] Every new text has its Russian entry (`pnpm typecheck`).
