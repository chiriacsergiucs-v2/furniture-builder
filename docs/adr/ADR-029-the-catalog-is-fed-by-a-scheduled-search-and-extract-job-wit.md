# ADR-029: The catalog is fed by a scheduled search-and-extract job with a local PDF extraction script, gated by PR

- Status: Pending
- Date: 2026-10-22
- Decided by: user request; defaults below await confirmation
- Depends on: none
- Design: n/a
- Related: ADR-002, ADR-004, ADR-008, ADR-010, ADR-011, ADR-016, ADR-027, ADR-028
- Backlog: N16, N17

## Context

The catalog (ADR-027) needs real products. The user asked for a scheduled job that **searches** for manufacturers'
public assembly manuals, **extracts** their data with a PDF extraction script, reconstructs the furniture (IKEA
first; BILLY 800 × 280 × 2020 mm as the benchmark) and feeds the catalog. The app must stay a static offline PWA
with no remote AI or runtime requests (ADR-002).

## Decision

The feed is a pipeline of four stages. Stages 1, 3 and 4 run inside a scheduled Claude Code routine; stage 2 is a
committed, deterministic script the routine (or a person) runs locally. Nothing in it is part of the app bundle.

### 1. Search (job)

- The job searches the web for public assembly manuals and product pages of the allowed brands (default IKEA),
  preferring product types the catalog lacks and that the model can represent (bookcase, chest of drawers,
  wardrobe, sideboard, desk, cabinet).
- Every candidate is recorded in `tools/catalog/candidates.json`:
  `{ id, brand, productName, articleNumber?, manualUrl, productUrl?, foundAt, status, reason? }`,
  `status` = `queued` | `extracted` | `added` | `skipped` | `withdrawn`. The file is the queue: a candidate is
  never searched for or processed twice, and a skip keeps its reason.
- Only manufacturer-hosted URLs are accepted as `manualUrl`/`productUrl`; mirrors and re-uploads are not.

### 2. Extract (script `tools/catalog/extract_pdf.py`)

- Written 2026-10-22 at the user's request (see Addendum); afterwards changed only through a reviewed PR.
- Interface: `python3 -I tools/catalog/extract_pdf.py <manual.pdf> --out <dir>`; input is a local file (the job
  downloads into its scratch directory; the script itself makes no network calls). Python 3, dependencies pinned
  in `tools/catalog/requirements.txt` (pdfplumber for text and vector paths; local Tesseract OCR only when a page
  has no text layer and it is installed, otherwise the page is reported as `ocr-unavailable`).
- Output `<dir>/extraction.json`, deterministic for the same file (sorted keys, no timestamps):
  - `source`: file `sha256`, page count, PDF metadata title;
  - per page: text spans with bounding boxes, vector path count and bounding boxes of drawing regions, raster image
    count;
  - candidate facts, each with page and bounding box: **dimension strings** (numbers with `mm`/`cm` or dimension
    lines' labels), **part labels** (letters/numbers placed next to parts), **quantity callouts** (`2x`, `×8`),
    **hardware article numbers** (e.g. six-digit IKEA fitting numbers), **step numbers**;
  - `warnings`: pages without text, OCR unavailable, ambiguous callouts.
- The script reports what is printed; it never infers sizes from drawing scale and never fills defaults. Page
  images are not written out.
- Tests: `python3 -I -m unittest discover tools/catalog` against small PDFs the test generates itself (no
  third-party manuals in the repo): same input → byte-identical output; dimension, quantity and label patterns
  found with the right page and box; a page without text yields a warning, not a crash.

### 3. Reconstruct (job)

- From `extraction.json` and the manual itself, the job builds the part list (tracking each part across steps,
  never double-counting a part shown in several steps), hardware with printed quantities, assembly order, and maps
  it to a valid `Design` using the existing roots (cabinet, desk, corner) and the space tree, built by
  `buildModel()` with zero errors.
- A product that cannot be represented without distorting it (bed frames, angled or curved parts, constructions
  the space tree cannot express) is **not** added; its candidate gets `status: skipped` and the reason. An
  imported-assembly product root is out of scope until a separate ADR approves it.

### 4. Publish (job → PR)

- Output: `src/catalog/entries/<catalogId>.json` (a `Design` with the ADR-028 `catalog` field and a `revision`)
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

### Boundaries

- The app only ships and reads `src/catalog/entries/`; it never contacts a manufacturer, a model or a server.
  `tools/catalog/` is not imported by `src/` and is not in the build.
- **No copyrighted material in the repo.** No PDFs, page images, traced drawings or `extraction.json` files are
  committed; only measured facts, part counts, hashes, the public URLs and article numbers. Brand names are used
  only to identify the source.
- **Verification per run:** `npm run lint && npm run typecheck && npm test && npm run build`,
  `python3 -I -m unittest discover tools/catalog`, `npm run docs:check`; a TS test asserts
  every entry validates, builds without errors, has an evidence file covering overall width, height and depth, and
  that no `.pdf`/image file exists under `src/catalog/` or `tools/catalog/`.

## Alternatives considered

- **Extraction by the job ad hoc, no committed script** — rejected by the user: results are not reproducible and
  not reviewable; the script makes the printed facts checkable from the manual's hash.
- **Extraction script in TypeScript with pdf.js** — possible later for an in-browser importer; Python/pdfplumber
  gives vector paths and OCR hooks with less code, and the script never ships.
- **PyMuPDF** — rejected: AGPL licence in an MIT repository, and version 2.0 pulls in onnxruntime and layout
  models the script does not need.
- **Browser PDF importer that users run themselves** — a separate feature; not required to feed the catalog and
  not decided here.
- **Fetch the catalog from a remote source at runtime** — rejected by ADR-002.
- **Commit the manuals or extraction output** — rejected: third-party copyright; URL plus hash is the reference.
- **Auto-merge job output** — rejected: unreviewed manufacturer data would ship as fact.

## Consequences

- The catalog grows only as fast as PRs are reviewed.
- Some products cannot enter until the model grows (beds, irregular parts); `candidates.json` makes the gap
  visible.
- The job needs Python, pdfplumber and outbound access to the manufacturer's site in its cloud environment.

## Evidence (repository files)

- `tools/catalog/extract_pdf.py`, `tools/catalog/test_extract_pdf.py` (10 tests on PDFs the test writes),
  `tools/catalog/requirements.txt`, `tools/catalog/README.md`.
- Stages 1, 3 and 4 are not built. The routine is configured outside the repository (Claude Code routine
  "Furniture catalog feed", weekly).

## Addendum 2026-10-22: extraction script written (user request, backlog N17)

The user asked for the script now rather than in the first job run. Built as stage 2 above with pdfplumber instead
of the PyMuPDF default (licence and weight). Tested only on PDFs the test generates and on one unrelated local PDF
(identical output on two runs); not yet run on a real assembly manual, because ikea.com is blocked by the build
environment's network policy (proxy 403). OCR path not exercised (no Tesseract installed).

## Compliance check

When accepted: `tools/catalog/extract_pdf.py` and its tests pass; running it twice on the same PDF gives identical
output; `tools/catalog/candidates.json` lists every processed candidate with a status; the catalog test passes for
every entry; no `.pdf`/image file in the repo under `src/catalog/` or `tools/catalog/`; `git log main` shows feed
commits only via merged PRs.

## Open questions (defaults used until answered)

1. Cadence — default weekly, Monday 08:39 Europe/Bucharest, at most 2 new entries per run.
2. Brands beyond IKEA — default IKEA only until the user names others.
3. OCR — default optional local Tesseract; pages without a text layer are reported, not guessed.

## Answers (2026-10-23, from the user)

1. Cadence — **weekly**, Monday 08:39 Europe/Bucharest, at most 2 new entries per run (default kept).
2. Brands — **IKEA only** (default kept).
3. OCR — optional local Tesseract (default kept).
The scheduled task "Furniture catalog feed" runs with these settings; its instructions were updated on 2026-10-23 to
publish into `src/core/catalog/brands/` (listed in the Catalog's *Brands* tab). It needs web search, which is not
available in every session; a run without it reports that and stops.
