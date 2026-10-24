# ADR-034: Templates are editable on the Catalog page; edits are saved as local templates, shipped ones never change

- Status: Implemented
- Date: 2026-10-22
- Implemented: 2026-10-23
- Decided by: user request; defaults below await confirmation
- Depends on: none
- Design: n/a
- Related: ADR-011, ADR-012, ADR-027, ADR-032, ADR-033
- Backlog: N24

## Context

The user asked for a UI page with all furniture templates, editable. Templates are shipped with the app (ADR-032);
there is no backend (ADR-002); app updates must be able to fix a shipped template without rewriting user rows
(ADR-012, ADR-027).

## Decision

- **Shipped families are read-only.** _Edit_ on a shipped family or variant creates a **local template** that
  shadows it on this device: `{ id, shadows?: familyId, revision, family }` stored in a new Dexie table
  `templates` (a new Dexie version; shipped versions are never edited).
- **What can be edited:** family name, aliases, rooms and function (grouping), the configurations text, variant
  names/order/default, and each variant's design — opened in the normal editor (elevation + inspector) in a
  _Template_ mode whose Save writes back to the local template, not the library. Variants can be added (still ≤ 5,
  ADR-033), duplicated or deleted. Root and `support` are not editable.
- Card-level quick edits (name, rooms) are inline; everything else is in a side panel or the editor.
- **Badges and reset.** A shadowing template shows _Edited on this device_; _Reset to shipped_ deletes only the
  local row after confirmation. When the app ships a newer `catalogVersion` of a shadowed family the card says
  _Shipped template updated_ and offers _Compare_ / _Keep mine_ / _Use shipped_; nothing is replaced silently.
- **New families** can be created from any saved design (_Save as template_), tagged with rooms and function.
- Local templates are exported and imported as a JSON file validated like designs (`validateDesign` per variant
  plus the family checks); unreadable rows are skipped and kept (ADR-012).
- Start from and the Catalog read the merged view: local templates first, shadowed shipped ones hidden.

## Alternatives considered

- **Edit shipped templates in place in Dexie** (copy all on first run) — rejected: duplicates data, and fixes in an
  update could not reach users without rewriting their rows.
- **Read-only catalog** — rejected: the user asked for editable templates.

## Consequences

- One Dexie version bump with an additive table; `storage` reviews the upgrade (never deletes rows).
- Designs inserted from a local template record its id and revision in `catalog.origin` (ADR-028).

## Evidence (repository files)

- Today: `src/persist/db.ts` (designs, projects), `src/ui/Dialogs.tsx` (library list, import/export). No templates
  table exists.

## Compliance check

When accepted: storage tests show the upgrade keeps every existing row; edit → reload → the local template wins;
_Reset_ removes only that row; a corrupt template row is skipped and still present; the shipped family object is
deep-equal before and after editing.

## Open questions (defaults used until answered)

1. Should local templates appear in _Start from_ above shipped ones (default) or mixed in by room/type order?

## Implementation (2026-10-23)

Dexie version 3 adds the `templates` table (versions 1 and 2 untouched). Editing a shipped family creates a local
template that shadows it; names, other names, rooms, type, structure and configuration text, variant names, order
(first = default), duplicate and delete (1–5) are edited in the Catalog page; _Edit design_ opens the variant in the
normal editor in template mode (banner: _Save to template_ / _Cancel_; nothing is written to the library). _Save this
piece as a template_ makes a new family. _Reset to shipped_ deletes only the local row. A newer shipped
`catalogVersion` shows _Keep mine_ / _Use shipped_ with the variant counts; _Compare_ is that count line only. Local
templates export and import as one JSON file, each validated. Open question 1: local templates come first (default).

Evidence: `src/persist/db.ts` (v3, `saveTemplate`, `listTemplates`, `deleteTemplate`), `src/core/catalog/local.ts`,
`src/store/templatesStore.ts`, `src/store/designStore.ts` (`editTemplateVariant`, `finishTemplateEdit`),
`src/ui/Catalog.tsx` (`TemplateEditor`, `ShippedUpdated`); `tests/templates-local.test.ts` (v2 → v3 upgrade keeps
rows incl. an unreadable one; local wins; reset removes one row; corrupt row skipped and kept; shipped data unchanged),
`tests/store.test.ts` (template edit mode).

Verification 2026-10-23 (branch `feat/catalog-templates`): `npm run lint`, `npm run typecheck`, `npm test` (157 passed), `npm run build` passed; `FUZZ_N=30000` fuzz passed (cabinets with the new fronts and flags, and frames); scripted headless Chromium against the production build at 1280 and 390 px, 18/18 checks, no page errors, no sideways scroll. Six code mutations each fail a test. Not checked on a real phone, with a screen reader, or on the deployed site.

## Answers (2026-10-23, from the user)

1. The user's templates are **mixed in by room / type** (not listed first): an edited family keeps the shipped one's place, new own families follow (`mergeCatalog`, test in `tests/templates-local.test.ts`).
