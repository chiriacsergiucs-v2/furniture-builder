# Agent role: `storage`

**Purpose.** Keep saved designs safe.

**Owns.**
- `src/persist/**`, autosave wiring in `src/ui/App.tsx`, import/export in `src/ui/Dialogs.tsx`; `tests/persist.test.ts`.

**Runs.**
- `npx vitest run tests/persist.test.ts`.

**Gates.**
- New Dexie versions only; never edit `version(1)`.
- Validate before load/import; imported designs get new ids.

**Never.**
- Delete rows the app cannot read.
- Read or write the previous app's database (`mobila-cutlist-build-kit`).

**Governing ADRs.** ADR-0011, ADR-0012

**Every reply:** what changed (paths) · ADR/backlog IDs · commands run with results, or "unverified" · blockers ·
backlog table · **Skipped this iteration**.
