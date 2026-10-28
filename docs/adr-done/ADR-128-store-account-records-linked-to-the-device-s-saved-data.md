# ADR-128: Store account records linked to the device's saved data

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-127
- Design: n/a
- Backlog: N129
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28): "New adr for save user templates and created pieces in db". Today every record is a
row in the Dexie database `furniture-builder` (`src/persist/db.ts`, version 10): `designs`, `projects`,
`templates`, `images`, `models`, `decors`, `prices`, `projectTemplates`, `projectVersions` and others. A design is a
self-contained validated JSON document (ADR-011, design `schemaVersion` 3); a local template is
`{ id, shadows?, revision, family }` (ADR-034). The server needs a shape for these records and a way to know which
local row matches which server record.

## Decision

Settled:

- **Server records hold the same documents.** One record per item: `{ id, owner, kind, name, body, bodySchema,
revision, updatedAt, deletedAt? }`. `body` is the document exactly as exported today (design JSON, or a template
  family); `kind` names the document type. The server never stores generated geometry (ADR-011).
- **Server access rule:** a record is readable and writable only by its owner, enforced by the backend (ADR-127),
  except reads through a share link (ADR-132).
- **Validation both ways:** a body is checked with `validateDesign` / the template checks before upload and after
  download; a body that fails is never written to Dexie and is reported (ADR-008, ADR-012).
- `revision` increases by one on every accepted write; a write that names an older revision is a conflict
  (ADR-129).
- Built with the add-storage-version skill. Existing local rows are not changed by the upgrade.

**Answers (user, 2026-10-28):**

- **Records** (G-221): library pieces (`designs`), local templates (`templates`) and the pictures (`images`) they use. Pieces inside projects, projects and other tables stay on the device.
- **Link** (G-222): a separate Dexie table in the next free version; documents unchanged, no `schemaVersion` bump; the link never travels in exports or design codes.
- **Limits** (G-223): `validateDesign`'s caps per document, plus a total size cap per account set once Supabase's free quota is verified (G-220).

## Alternatives considered

- **One server row per Dexie table row, same columns** — couples the server to every future Dexie version.
- **Store a whole-device backup blob per user** — no per-item sharing (item 6) and no per-item conflicts.
- **Embed the server id in the design document** — see the open question (G-222).

## Scope

- In scope: the record shape, the access rule, the local link, validation, storage tests.
- Covered elsewhere: when records move (ADR-129, ADR-137), sharing (ADR-132).

## Consequences

- Positive: export files, design codes and server bodies are one format.
- Negative / risks: a new Dexie version; server and app must agree on `bodySchema` readers.
- Harder to change later: the record shape once users have data in it.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Record shape and access rule written in the backend (migration file in the repo, reviewed).
- [x] A Dexie upgrade test opens a version-10 database with an unreadable row; every row survives (persist test).
- [x] An invalid server body is never stored locally and is reported, never thrown (test).
- [x] Round trip: local design → server body → local copy is deep-equal except ids and dates (test).

## Implementation (2026-10-28)

Records: `records (id, owner, kind design|template|image, name, body jsonb, body_schema, revision,
updated_at, deleted_at)`, owner-only by row-level security; writes through `save_record` with a revision check;
caps by trigger (G-278). Local link: Dexie v11 `accountLinks [accountId+table+localId]` (G-222; documents unchanged,
no `schemaVersion` bump), shared with ADR-133's `settings`. Pictures used by pieces and templates go too (G-221);
pieces inside projects do not. Evidence: `bash tools/supabase/test-sql.sh` (PostgreSQL 16, 2026-10-28) — ALL SERVER
CHECKS PASSED; `tests/backup.test.ts` (v10 → v11 upgrade keeps every row, an unreadable one too);
`tests/sync.test.ts` (an invalid account body is refused and not stored; template round trip).

## Open questions

- None open. Answered 2026-10-28, one by one: G-221 pieces, templates and their pictures; "created pieces" = library pieces only; G-222 separate Dexie table; G-223 design caps plus a total cap.
