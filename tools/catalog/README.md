# Catalog feed tools (ADR-0029)

Not part of the app: nothing under `src/` imports this folder and it is not in the build.

## `extract_pdf.py` — what a manual prints, as evidence

```sh
python3 -m venv .venv && .venv/bin/pip install -r tools/catalog/requirements.txt
.venv/bin/python -I tools/catalog/extract_pdf.py <manual.pdf> --out <dir>      # writes <dir>/extraction.json
.venv/bin/python -I -m unittest discover tools/catalog                         # tests
```

- Local file in, JSON out; the script never downloads. Keep manuals and `extraction.json` out of the repo.
- Same file → byte-identical output (sorted keys, rounded coordinates, no timestamps or paths).
- Coordinates are PDF points, origin at the page's top-left.
- `facts[]` are **candidates**, each with page and box:
  `dimension` (number with `mm`/`cm`; `mm` set only when it is whole millimetres), `quantity` (`8x`, `x4`, `×2`),
  `article` (six-digit fitting numbers), `number` (bare 2–4 digit numbers, unit unknown), `label` (a lone letter
  or 1–3 digit number), `step` (a lone number printed much larger than the page's text).
- `pages[]`: text runs, vector path counts and drawing-region boxes, image boxes. Sizes are never inferred from
  drawings.
- Pages without a text layer use local Tesseract when installed (`textSource: "ocr"`, with a warning); otherwise
  they get an `ocr-unavailable` warning.
- pdfplumber (MIT) is used rather than PyMuPDF (AGPL) to keep the repository's MIT licence simple.
