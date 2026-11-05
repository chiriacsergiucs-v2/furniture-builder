# ADR-172: A running cost estimate in the editor and a seller price refresh from a new export

- Status: Implemented
- Date: 2026-11-04
- Implemented: 2026-11-05
- Depends on: ADR-062, ADR-064, ADR-161, ADR-162
- Design: docs/ui-design.md (section 4, the editor header)
- Backlog: N175
- Agreed: 2026-11-04 "Now do the high appreciation features, similar way"; answers "Running estimate + scheduled
  seller price refresh", then "You upload a new export; the workflow converts it"

## Context

The research feature _Live price/cost estimate_ (rank 24, appreciation High, P1/P2) is _in progress_: "live supplier
prices (N58, ADR-063 deferred)". Built: the Shopping list tab's estimate from the user's own price list (ADR-062)
and the bundled seller's prices with their extraction date (ADR-161, Regency, `extracted: 2026-10-29`). The
research's point is a **running** price for the whole ensemble. A live supplier feed still needs a supplier
contract (ADR-063 Deferred, G-009); the Regency catalog came from an export file the user supplied, with no known
URL, and scraping the shop was rejected (ADR-063). User (2026-11-04): a running estimate plus a refresh where the user
uploads a new export and a workflow converts it.

## Decision

- **Running estimate chip:** the editor header (next to "Saved on this device", App.tsx) shows **Estimate: 4 812
  lei** for the open project or piece, from the same `estimate(lines, prices, seller)` as the Shopping list
  (ADR-062, ADR-161), updated on every change through the derived view (ADR-004; no second computation path). With
  prices missing it reads **Estimate: 4 812 lei · 3 missing**; with none priced, **No prices yet**. Tapping it opens
  Build & Preview › Shopping list. On a phone the chip sits in the mode row's free space, text only ("4 812 lei");
  the full text is its accessible name. Memoised on the shopping lines, so a drag does not recompute prices per
  frame.
- **Seller price refresh:** workflow `.github/workflows/seller-prices.yml`, `workflow_dispatch` with one input
  **export_url** (an https URL to a new Regency export file, schema_version 3.0, for example an asset of a release
  of this repository the user uploads). The job downloads it, runs the ADR-161 converter
  (`tools/sellers/regency.mjs`), re-marks the shipped pictures (`regency-pictures.ts mark`, ADR-162), writes the
  export's own date as `extracted`, and pushes a branch with a pull request as the Seller pictures workflow does
  (ADR-162). Nothing is pushed to `main`; the user merges. A product that left the export is dropped from the
  catalog; a design that still references it reads _price missing_ (ADR-161). No request from the app; ADR-002 and
  ADR-126 are unchanged, ADR-063 stays Deferred.
- The estimate names the seller and its date as today; a refreshed catalog shows the new date at once.
- Research record: _Live price/cost estimate_ becomes Verified with the note "running estimate; seller prices from
  the user's export, refreshed by a workflow; no live supplier feed (ADR-063)".

## Alternatives considered

- **A scheduled weekly refresh** — nothing to fetch: the export has no URL (user, 2026-11-04).
- **A supplier API** — needs a named supplier and a contract (ADR-063 Deferred, G-009).
- **Price in the parts table per row** — the research asks for the running total; row prices are G-339.

## Scope

- In scope: the chip (project and piece, both widths), the workflow, converter date handling, a test of the chip's
  text states, a converter test for the date and dropped products.
- Out of scope: a per-row price column in Parts (G-339); a price history or change report between exports
  (G-340); any live feed (G-009).

## Consequences

- Positive: the cost is always in view; a new export is one workflow run away.
- Negative / risks: the chip is one more header element at 390 px; the workflow needs a reachable URL and Actions
  that may push branches (as ADR-162's does).
- Harder to change later: none; the chip reads what the Shopping list reads.

## Done when

- [x] The chip shows "Estimate: N lei", "· M missing" and "No prices yet" from the derived view for a piece and a
      project; tapping it opens Shopping list (jsdom find-it, 390 and 1280 px)
- [x] The chip's value equals the Shopping list's estimate for the same project (test)
- [x] `seller-prices.yml` runs the converter on the input URL, keeps picture marks, sets `extracted` from the export
      and opens a pull request (workflow file reviewed; converter tests for the date and a dropped product)
- [x] Russian entries for every new text; the feature tree gains "Running cost estimate" (ADR-158)
