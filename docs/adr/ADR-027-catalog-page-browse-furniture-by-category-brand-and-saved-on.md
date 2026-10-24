# ADR-027: Catalog page: browse furniture by category, brand and "Saved on this device"

- Status: Pending
- Date: 2026-10-22
- Decided by: user request; defaults below await confirmation
- Depends on: ADR-052
- Design: docs/ui-design.md
- Related: ADR-002, ADR-004, ADR-011, ADR-012, ADR-022, ADR-028, ADR-029; amended by ADR-032 (Templates source, Room/Type grouping)
- Backlog: N14

## Context

The user asked for a catalog page listing pieces of furniture by **category**, **brand** and **saved by the user**.
Today the only list is _Saved on this device_ (`LibraryDialog` in `src/ui/Dialogs.tsx`), a flat list of the local
library (ADR-012), plus the built-in templates in _New_. There are no accounts (ADR-002), so "the user" means this
browser's library.

## Decision

- **One page, two read-only sources.** The catalog is a projection over (a) **shipped catalog entries** — design
  documents bundled with the app (ADR-029) — and (b) the **local library** (`listDesigns()`). Nothing new is
  fetched at runtime; shipped entries are lazy-loaded bundle chunks, so the service worker precaches them like the
  rest of the app.
- **Facets.** Category (from ADR-028 `catalog.category`, else derived from the product kind: cabinet → Cabinet,
  desk → Desk, corner → Corner unit), brand (`catalog.brand`; local pieces without one show under _My designs_),
  source (_Catalog_ / _Saved on this device_), plus a name search. Facet counts and filtering are computed in
  memory from the listed rows, outside Zustand selectors (stable references rule).
- **Cards are projections of `buildModel()`.** Overall size, part count and the diagnostic badge come from the
  built model (ADR-004), never from stored numbers. A shipped entry with errors is shown with its diagnostics and
  cannot be exported (ADR-008).
- **Opening a catalog entry makes a local copy.** _Use this piece_ saves a new design (new id, ADR-011) with its
  origin recorded (ADR-028) and opens it in the editor; _Add to project_ embeds a copy (ADR-022). Shipped entries
  are never edited in place.
- **Entry point.** A _Catalog_ button next to _New_ and _Saved_; _Saved on this device_ stays as is (delete,
  duplicate, file import live there).

## Alternatives considered

- **Copy shipped entries into Dexie on first run** — rejected: duplicates data, and app updates could not fix an
  entry without rewriting user rows (ADR-012).
- **Remote catalog fetched from a server or the GitHub API** — rejected by ADR-002.
- **Fold the catalog into the template list in _New_** — rejected: templates are parametric starting points,
  catalog entries are specific products with a source.

## Consequences

- Every catalog card runs `buildModel()`; with tens of entries this is cheap (pure, integer maths). If the catalog
  grows past a few hundred entries, cards build on demand while scrolling.
- Shipped entries add to the bundle; each is a small JSON chunk loaded only when the page opens.

## Evidence (repository files)

- Today: `src/ui/Dialogs.tsx` (`LibraryDialog`, `NewDialog`), `src/persist/db.ts` (`listDesigns`),
  `src/core/project.ts` (`makeItem`). Nothing implements the catalog yet.

## Compliance check

When accepted: a test lists shipped entries plus local designs, filters by category and brand, and checks each card
size equals the `buildModel()` bounds; opening an entry saves a design with a new id and an `origin`; the shipped
entry is unchanged.

## Open questions (defaults used until answered)

1. Category list — default: Bookcase, Wardrobe, Chest of drawers, Cabinet, Sideboard, Desk, Corner unit, Other.
2. Should _Saved on this device_ entries appear in the catalog by default, or only those the user marks
   _Show in catalog_? Default: all saved pieces appear under source _Saved on this device_.

## Implementation (2026-10-23)

Built as amended by ADR-032: the _Catalog_ button opens one page with three sources — **Templates** (shipped
families merged with local templates), **Saved on this device** (opens a saved piece) and **Brands** (empty state:
no entries until the ADR-029 feed adds some). The category facet is the Room / Type grouping of ADR-032; there is no
brand facet yet because there are no brand entries. Cards show size, parts and checks from `buildModel()`. Opening or
adding makes a copy with its origin; shipped entries are never edited in place.

Evidence: `src/ui/Catalog.tsx` (`CatalogDialog`, `FamilyCard`, `SavedList`), `tests/catalog.test.ts`, `tests/store.test.ts`.
Not built: brand facet and the ADR-029 brand entries.

Verification 2026-10-23 (branch `feat/catalog-templates`): `npm run lint`, `npm run typecheck`, `npm test` (157 passed), `npm run build` passed; `FUZZ_N=30000` fuzz passed (cabinets with the new fronts and flags, and frames); scripted headless Chromium against the production build at 1280 and 390 px, 18/18 checks, no page errors, no sideways scroll. Six code mutations each fail a test. Not checked on a real phone, with a screen reader, or on the deployed site.

## Answers (2026-10-23, from the user)

1. Category list — superseded by the user's instruction of 2026-10-22: the Catalog groups **by room (default) or by type** (ADR-032).
2. Saved pieces — **all saved pieces appear** under _Saved on this device_ (default kept).
   Approved, not Accepted: the brand facet waits for the first brand entries from the feed (ADR-052, split out of
   ADR-029 on 2026-10-24).

## Done when

- [x] One Catalog page with _Templates_, _Saved on this device_ and _Brands_, grouped by room or type, with a name
      search (`src/ui/Catalog.tsx`, `tests/catalog.test.ts`)
- [x] Card size, part count and check badge come from `buildModel()`, not stored numbers
- [x] Opening or adding any entry makes a copy with a new id and its origin; the shipped entry is unchanged
      (`tests/store.test.ts`, `tests/catalog.test.ts`)
- [ ] _Brands_ has a brand facet: each brand with its count, choosing one filters the list; a test runs it on brand
      entries and checks every card's size equals the `buildModel()` bounds
- [ ] Find-it test: from the bare app, Catalog → _Brands_ → a brand → the entry, at phone and desktop widths
