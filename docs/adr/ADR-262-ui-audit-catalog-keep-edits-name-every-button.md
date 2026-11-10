# ADR-262: UI audit — Catalog and templates: an import never loses an edit, every failure and button is named

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 15, **Catalog and templates** (`src/ui/info/features.ts:1269-1333`).
The full sub-flow map (13 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-15-catalog.md](../research/ui-audit-15-catalog.md).

Summary of the map: every sub-flow starts on the Catalog page (`src/ui/CatalogPage.tsx:90-506`): Templates (browse,
search, cards, Edit template, Save this piece as a template, Template files), Saved on this device, and Brands; a
project piece reaches Save to catalog from its More actions (`src/ui/SaveToCatalog.tsx:17-53`). All are reachable at
390 and 1280 px; on a phone the catalog actions fold under "More catalog actions" (`src/ui/Catalog.tsx:178-189`).

ADR-195 settled that no template edit is lost silently and that a failed read is said, never shown as an empty list;
ADR-203 made an import ask before it replaces an edited family. The import's replace path and the Brands list do not
keep those rules.

## Findings

| Id     | Class       | Severity | Finding                                                                                                                                                    |
| ------ | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D15-F1 | Proven      | major    | "Use the imported one" removes the edit before saving the import (`CatalogPage.tsx:249,252`); with a refused write both are gone: reproduced, 0 rows left. |
| D15-F2 | Proven      | minor    | A JSON file that is not a templates file says "0 templates imported." (`CatalogPage.tsx:219-220`).                                                         |
| D15-F3 | Proven      | minor    | Brands shows "No saved piece has a board of this maker yet." when the saved pieces could not be read (`CatalogPage.tsx:928,1011`).                         |
| D15-F4 | Proven      | minor    | 183 buttons named "Open" and 68 "Edit template", none naming its item (`CatalogPage.tsx:652-662,742-746`).                                                 |
| D15-F5 | Proven/Code | minor    | Template editor: every variant row has the same labels; problems are not tied to fields; only three are shown (`CatalogPage.tsx:1186-1263`).               |

## Decision

One rule for the catalog: **an import never loses an edit, a failure is said as a failure, and every control says
which item it acts on.**

1. **F1:** on "Use the imported one", `importLocal` saves the imported template first and removes the device's other
   edits of that family only when the save succeeded. When it fails, nothing is removed and the summary counts it as
   not imported; the storage alert says why (ADR-195).
2. **F2:** a file whose JSON has no `templates` array says the existing sentence "That file could not be read as a
   templates file." (no new text). Files written by Export my templates keep importing as before.
3. **F3:** a failed read of the saved pieces shows the existing alert "Designs saved on this device could not be
   read." in the brand's section instead of the empty sentence; the decors still show.
4. **F4:** the card's Open / Add button gets `aria-describedby={nameId}`, as More and I check it myself already have;
   Edit template and About this family get `aria-describedby` pointing to the family heading.
5. **F5:** each variant row's controls are named with the row: "Variant {n} name", "Variant {n} summary", and the
   buttons described by the row (`t()` with Russian entries); the Name field and the Rooms group get `aria-invalid`
   with their problem under them; the summary alert lists every problem, not the first three.

## Alternatives considered

- **F1: keep the old edit as a separate family** — ADR-203 rejected keeping both (two near-identical families).
- **F1: a Dexie transaction for remove + save** — `templatesStore` saves and removes one row per call; save-first gives
  the same safety without a new store action.
- **F2: require `kind: 'mobila-templates'`** — older files without it would stop importing.
- **F4: visible item names on the buttons ("Open Bookcase")** — longer buttons on a compact card (ADR-118); the
  description says it to a screen reader without changing the layout.

## Scope

- In scope: F1–F5 as decided; tests for each.
- Out of scope: the header total against room sums (G-362, ADR-195); renaming the export file or its `kind`.

## Consequences

- Positive: the replace-on-import choice can no longer end with neither version; catalog buttons are usable by name.
- Negative / risks: F1 briefly holds two edits of one family until the old one is removed (the merge already lets the
  last one win, `local.ts:85`, ADR-195 out of scope G-363). F5 changes labels that `tests/find-it/catalog.test.tsx`
  may query.

## Done when

- [ ] Use the imported one with a refused write keeps the device's edit, imports nothing, and says the storage alert (test).
- [ ] A JSON file without `templates` says "That file could not be read as a templates file." (test).
- [ ] Brands with a failed saved-pieces read shows "Designs saved on this device could not be read." and not the empty sentence (find-it).
- [ ] Every card's Open / Add and every family's Edit template has a description naming its item (find-it).
- [ ] In the template editor each variant's inputs have distinct names; an empty Name is `aria-invalid`; a fourth problem is listed (test, English and Russian).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of other findings and of ADR-248), for
behaviour an implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                       | Proposer                                                                                                                                                                                                         | Verdict  |
| ------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D15-F1 | The user chose to replace the edit (ADR-203), and the storage alert is shown. | They chose to replace it with the import, which never arrived; the alert says the save failed, not that the edit is gone. ADR-195 item 2 and CLAUDE.md (no deletion without the user's decision). Reproduced.    | Accepted |
| D15-F2 | The file is valid JSON; zero is true.                                         | The file is not a templates file and the sentence for that exists (`CatalogPage.tsx:257-259`); "0 imported" tells the user the import ran. No new text, old files unaffected.                                    | Accepted |
| D15-F3 | Brands is about decors; the pieces list is secondary.                         | ADR-195 item 2 fixed the same failure on the Saved list ("never as an empty list"); here it still reads as none. Reproduced; the alert text exists.                                                              | Accepted |
| D15-F4 | Cards sit in a named article and list; context is enough.                     | A screen reader's button list drops that context; the same cards' More and I check it myself already carry the item name (`CatalogPage.tsx:600,639`). Reproduced: 183 × "Open", 0 described.                     | Accepted |
| D15-F5 | Save is disabled anyway; three problems at a time is a design choice.         | Save disabled with problems that do not point to a field leaves keyboard and screen-reader users searching; D01-F5 applied the same field rule to the creating forms. Reproduced labels and `aria-invalid=null`. | Accepted |

No question needs the user: every accepted fix follows an implemented ADR's rule (ADR-195, ADR-203) or reuses an
existing sentence. Decided without asking: F1 saves first instead of a transaction; F4 uses a description, not
visible text.
