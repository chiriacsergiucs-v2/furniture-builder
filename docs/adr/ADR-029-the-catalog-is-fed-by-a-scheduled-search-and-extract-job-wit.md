# ADR-029: The catalog is fed by a scheduled search-and-extract job with a local PDF extraction script, gated by PR

- Status: Pending
- Date: 2026-10-22
- Decided by: user request; defaults below await confirmation
- Depends on: none
- Design: n/a
- Related: ADR-002, ADR-004, ADR-008, ADR-010, ADR-011, ADR-016, ADR-027, ADR-028
- Backlog: N17

## Context

The catalog (ADR-027) needs real products. The user asked for a scheduled job that **searches** for manufacturers'
public assembly manuals, **extracts** their data with a PDF extraction script, reconstructs the furniture (IKEA
first; BILLY 800 × 280 × 2020 mm as the benchmark) and feeds the catalog. The app must stay a static offline PWA
with no remote AI or runtime requests (ADR-002).

On 2026-10-24 this ADR was split (ADR-050 size rule): it keeps the pipeline decision, the extraction script and the
boundaries; the job's search, reconstruct and publish stages are [ADR-052](ADR-052-run-the-catalog-feed-job-search-reconstruct-and-publish-bran.md).

## Decision

The feed is a pipeline of four stages: **1. search**, **2. extract**, **3. reconstruct**, **4. publish**. Stages 1, 3
and 4 run inside a scheduled Claude Code routine (ADR-052); stage 2 is a committed, deterministic script the routine
(or a person) runs locally. Nothing in it is part of the app bundle.

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

### Boundaries

- The app only ships and reads `src/core/catalog/brands/`; it never contacts a manufacturer, a model or a server.
  `tools/catalog/` is not imported by `src/` and is not in the build.
- **No copyrighted material in the repo.** No PDFs, page images, traced drawings or `extraction.json` files are
  committed; only measured facts, part counts, hashes, the public URLs and article numbers. Brand names are used
  only to identify the source.
- Every run (ADR-052) verifies with the `verify` skill and `python3 -I -m unittest discover tools/catalog`.

## Alternatives considered

- **Extraction by the job ad hoc, no committed script** — rejected by the user: results are not reproducible and
  not reviewable; the script makes the printed facts checkable from the manual's hash.
- **Extraction script in TypeScript with pdf.js** — possible later for an in-browser importer; Python/pdfplumber
  gives vector paths and OCR hooks with less code, and the script never ships.
- **PyMuPDF** — rejected: AGPL licence in an MIT repository, and version 2.0 pulls in onnxruntime and layout
  models the script does not need.
- **Browser PDF importer that users run themselves** — a separate feature; not required to feed the catalog and
  not decided here.
- **Commit the manuals or extraction output** — rejected: third-party copyright; URL plus hash is the reference.

## Consequences

- The job needs Python, pdfplumber and outbound access to the manufacturer's site in its cloud environment.
- The script is only trusted once it has been run on a real manual; until then N17 stays partially done.

## Evidence (repository files)

- `tools/catalog/extract_pdf.py`, `tools/catalog/test_extract_pdf.py` (10 tests on PDFs the test writes),
  `tools/catalog/requirements.txt`, `tools/catalog/README.md`.
- Stages 1, 3 and 4 (the weekly routine): ADR-052.

## Addendum 2026-10-22: extraction script written (user request, backlog N17)

The user asked for the script now rather than in the first job run. Built as stage 2 above with pdfplumber instead
of the PyMuPDF default (licence and weight). Tested only on PDFs the test generates and on one unrelated local PDF
(identical output on two runs); not yet run on a real assembly manual, because ikea.com is blocked by the build
environment's network policy (proxy 403). OCR path not exercised (no Tesseract installed).

## Answers (2026-10-23, from the user)

- OCR — optional local Tesseract; pages without a text layer are reported, not guessed (default kept).
- Cadence and brands (weekly, IKEA only) moved with the job to ADR-052.

## Done when

- [x] `python3 -I -m unittest discover tools/catalog` passes (dimensions incl. cm, quantities, article numbers,
      labels vs steps, drawing regions, no-text warning, identical output, URL refused)
- [ ] Run on a real IKEA assembly manual (BILLY 80, downloaded from ikea.com to a scratch directory): 800, 280
      and 2020 mm are among the dimension facts with their page; two runs give byte-identical `extraction.json`
- [ ] A page without a text layer in that or another real manual gives `ocr-unavailable` (or OCR text when
      Tesseract is installed), never a crash
- [x] No `.pdf`, page image or `extraction.json` is tracked under `tools/catalog/` or `src/core/catalog/`
      (a test asserts it)
      — `NoManualsInRepoTest` (2026-10-24; fails when a `.pdf` is staged under `tools/catalog/`)
- [ ] `tools/catalog/README.md` gives the exact commands and the result of the real-manual run
