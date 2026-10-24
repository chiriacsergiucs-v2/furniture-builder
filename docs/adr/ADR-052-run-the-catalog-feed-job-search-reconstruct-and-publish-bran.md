# ADR-052: Run the catalog feed job: search, reconstruct and publish brand entries through a pull request

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-22 (ADR-029 request); answers 2026-10-23; split out of ADR-029 on 2026-10-24
- Depends on: ADR-029
- Design: n/a
- Related: ADR-002, ADR-004, ADR-008, ADR-010, ADR-011, ADR-027, ADR-028
- Backlog: N16

## Context

ADR-029 decided a four-stage catalog feed and built stage 2, the extraction script. This ADR is the scheduled
job's part: **search** for manuals, **reconstruct** products as designs, **publish** them through a pull request,
so the Catalog's *Brands* tab (ADR-027) gets real products. The weekly routine "Furniture catalog feed" exists
outside the repository; on 2026-10-23 its runs stopped because ikea.com was refused by the environment's network
policy and web search was not available.

## Decision

### 1. Search

- The job searches the web for public assembly manuals and product pages of the allowed brands (default IKEA),
  preferring product types the catalog lacks and that the model can represent (bookcase, chest of drawers,
  wardrobe, sideboard, desk, cabinet).
- Every candidate is recorded in `tools/catalog/candidates.json`:
  `{ id, brand, productName, articleNumber?, manualUrl, productUrl?, foundAt, status, reason? }`,
  `status` = `queued` | `extracted` | `added` | `skipped` | `withdrawn`. The file is the queue: a candidate is
  never searched for or processed twice, and a skip keeps its reason.
- Only manufacturer-hosted URLs are accepted as `manualUrl`/`productUrl`; mirrors and re-uploads are not.

### 3. Reconstruct

- From `extraction.json` and the manual itself, the job builds the part list (tracking each part across steps,
  never double-counting a part shown in several steps), hardware with printed quantities, assembly order, and maps
  it to a valid `Design` using the existing roots (cabinet, desk, corner) and the space tree, built by
  `buildModel()` with zero errors.
- A product that cannot be represented without distorting it (bed frames, angled or curved parts, constructions
  the space tree cannot express) is **not** added; its candidate gets `status: skipped` and the reason. An
  imported-assembly product root is out of scope until a separate ADR approves it.

### 4. Publish

- Output: `src/core/catalog/brands/<catalogId>.json` (a `Design` with the ADR-028 `catalog` field and a `revision`)
  and `<catalogId>.evidence.json`.
- **Evidence, no invented facts (ADR-010).** For every value used: source (extraction fact id / page / printed
  label, or product-page field), status `identified` / `geometrically resolved` / `manufacturing verified` (three
  states, never a percentage), derivation dependencies, the manual's `sha256` from the extraction, and the list of
  unresolved fields. Values the model needs but the sources do not give (e.g. board thickness not printed) use the
  app defaults **and are listed as unresolved**; the card and editor show *Dimensions not verified for cutting* for
  any entry with unresolved fields. Documented hardware is recorded with its printed quantity; the app's hardware
  schedule stays guidance (ADR-010) until a hardware ADR maps documented hardware into the model.
- **Gate: a pull request.** Each run works on branch `claude/catalog-feed`, keeps one open PR, never pushes
  `main`. An entry reaches users only after a human merges it and the site is deployed (pushed ≠ merged ≠
  deployed). At most 2 new entries per run.
- **Revisions.** Changing a shipped entry bumps its `revision`; entries are never deleted once shipped, only
  marked withdrawn, so `origin` links (ADR-028) never dangle.

## Alternatives considered

- **Auto-merge job output** — rejected: unreviewed manufacturer data would ship as fact.
- **Fetch the catalog from a remote source at runtime** — rejected by ADR-002.

## Scope

- In scope: the routine's instructions, `tools/catalog/candidates.json`, brand entries and evidence files, the
  catalog test for entries.
- Out of scope: the extraction script (ADR-029), the brand facet on the Catalog page (ADR-027).

## Consequences

- The catalog grows only as fast as PRs are reviewed; `candidates.json` makes skipped products visible.
- Needs web search and outbound access to ikea.com in the routine's environment (the user sets the network policy).

## Answers (2026-10-23, from the user)

- Cadence — **weekly**, Monday 08:39 Europe/Bucharest, at most 2 new entries per run.
- Brands — **IKEA only**.

## Done when

- [ ] `tools/catalog/candidates.json` exists and every processed candidate has a status (and a reason when skipped)
- [ ] A test asserts every brand entry validates, builds with no errors, carries `catalog.brand` and an origin,
  and has an evidence file covering overall width, height and depth
- [ ] The first entry, IKEA BILLY 80, builds at 800 × 280 × 2020 mm with every value traced to the manual or
  listed as unresolved; the card shows *Dimensions not verified for cutting* while any field is unresolved
- [ ] The job's output reaches `main` only through a merged pull request (`git log main`)
- [ ] Find-it test: Catalog → *Brands* shows the entry at phone and desktop widths and *Use this piece* opens a copy
