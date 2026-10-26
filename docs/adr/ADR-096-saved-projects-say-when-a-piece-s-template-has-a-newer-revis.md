# ADR-096: Saved projects say when a piece's template has a newer revision

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-028, ADR-034
- Design: docs/ui-design.md (Plan view)
- Backlog: N94
- Agreed: not yet

## Context

The user, 2026-10-26: "New adr 9". Item 9 of the fit review: _Versioned save/reload of entire ensembles_ (rank 10,
value 4.7, In Progress, missing "template versions and connections"). The paper: "Store template versions,
instance parameter overrides and connection metadata — not merely a flattened mesh" (line 134). Each project piece
already embeds its design with `catalog.origin.revision`, the family's `catalogVersion` when it was taken
([ADR-028](../adr-done/ADR-028-catalog-metadata-and-origin-link-live-in-the-design-document.md)), and edited templates already say "The shipped template was updated" (ADR-034). What is
missing is telling the user when a piece's template has moved on. Connections are not stored anywhere (ADR-070);
groups come with [ADR-097](ADR-097-select-several-pieces-and-keep-them-as-groups.md).

## Decision

- **Show the revision:** the selected-piece card names its template and revision ("From _Base cabinet: 2 doors_,
  revision 3"). Pieces without a catalog origin say "Your own design".
- **Say when it is newer:** when the template (shipped `catalogVersion`, or the template edited on this device) has a
  higher revision than the piece's `origin.revision`, the card shows **Template updated (revision 3 → 4)** and the
  project panel lists how many pieces have a newer template.
- **Two actions:** **Keep mine** hides the notice for that revision (the project item records
  `templateSeen: <revision>`, project `schemaVersion` raised to the next free version, older ones still load);
  **Replace with the new revision** runs the replace of [ADR-098](ADR-098-replace-a-piece-with-a-compatible-catalog-alternative.md) with the same item.
- A pure function `templateStatus(item, families, locals)` in `src/core` decides the notice; nothing is changed
  automatically (projects keep copies, ADR-022/ADR-028).
- Saving and reloading keep the revision, the dismissal and, once ADR-097 ships, the groups.

## Alternatives considered

- **Pieces reference templates instead of copying** (research's model) — rejected by ADR-022/ADR-028: library edits
  must never change saved projects by themselves.
- **Silently update pieces** — would change cut lists without the user's decision (CLAUDE.md storage rule).

## Scope

- In scope: revision shown, newer-revision notice, Keep mine, the link to Replace, storage.
- Out of scope: a history of older project versions to go back to (G-083).

## Consequences

- Positive: the user knows which pieces are out of date and decides per piece.
- Negative / risks: depends on ADR-098 for the replace action; until then the notice offers Keep mine only.

## Done when

- [ ] `templateStatus` reports up to date / newer / own design correctly, incl. device-edited templates (unit tests)
- [ ] Keep mine survives save and reload; older project versions load (storage test)
- [ ] Find-it at 1440 and 390 px: a project piece from an older template shows "Template updated" and Keep mine
      hides it; an up-to-date piece shows its revision; no page errors

## Open questions

1. Should saved designs in the Library show the same notice? Used until answered: yes (G-084).
