---
name: add-storage-version
description: Change what the app saves on the device — a new Dexie version, table or index, or a new design-document shape — without losing or rewriting anyone's saved designs. Use when the user or an ADR needs new saved data, a new IndexedDB table or index, a schemaVersion bump, or a change to import/export files.
---

# Add a storage version

Project: **Furniture Builder** — everything is saved on the user's device in IndexedDB
(Dexie database `furniture-builder`, `src/persist/db.ts`) and in exported design/project
files (ADR-011, ADR-012). There is no server copy: a storage mistake loses the user's work.

## Workflow

1. **Read** the ADR, ADR-011, ADR-012 and `src/persist/db.ts` (every `this.version(n)`).
2. **Pick the smallest change:**
   - a new optional field on a design → no Dexie version; old documents stay valid
     (ADR-028 is the example);
   - a new table or index → a new `this.version(n + 1).stores({...})` that repeats every
     existing table (ADR-034, ADR-048, ADR-049 are examples);
   - a changed document shape → bump `schemaVersion`, keep the reader for every older
     version and upgrade on load (see `upgradeDesign` in `src/core/design.ts`).
3. **Never** edit a shipped `version(n)`, delete rows the app cannot read, or rewrite
   saved designs in an upgrade without the user's explicit decision. Skip corrupt rows and
   report them.
4. **Import/export:** validate before load (`validateDesign`), imported designs get new
   ids, exported files carry everything they need (pictures are embedded, ADR-048).
5. **Tests** in `tests/persist.test.ts`: open a database written by each older version and
   upgrade it; unreadable rows survive; round-trip export → import.
6. **Verify** with the `verify` skill.
7. **Report:** the version added, what an existing user's data looks like after the upgrade,
   and whether it is reversible (a Dexie upgrade is not: say so).
