#!/usr/bin/env python3
"""Extract what an assembly manual prints, as evidence for catalog entries (ADR-0029, stage 2).

Run: python3 -I tools/catalog/extract_pdf.py <manual.pdf> --out <dir>

Reads a local PDF only (no network) and writes <dir>/extraction.json. The output is deterministic for the same
file: sorted keys, rounded coordinates, no timestamps, no paths. Coordinates are PDF points with the origin at the
page's top-left corner. The script reports what is printed; it never infers sizes from drawing scale and never
fills defaults. Facts are candidates for a person or the feed job to confirm, not verified values.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import pdfplumber

FORMAT = 1
LINE_TOL = 2.0  # words whose tops differ by at most this many points share a line
GAP_FACTOR = 3.0  # a horizontal gap wider than this many font sizes starts a new run (separate callouts)
REGION_PAD = 6.0  # vector paths closer than this many points belong to one drawing region
STEP_FACTOR = 1.8  # a lone integer this many times the page's median font size is a step number

DIMENSION = re.compile(r'(?<![\w.,])(\d+(?:[.,]\d+)?)\s?(mm|cm)\b', re.I)
QUANTITY = re.compile(r'(?<![\w.,])(?:(\d{1,3})\s?[x×]|[x×]\s?(\d{1,3}))(?![\w.,])', re.I)
ARTICLE = re.compile(r'(?<![\w.,])(\d{6})(?![\w.,])')
BARE_NUMBER = re.compile(r'(?<![\w.,])(\d{2,4})(?![\w.,])')
LABEL = re.compile(r'^(?:[A-Z]|\d{1,3})$')


def r1(v):
    return round(float(v), 1)


def box(o):
    return [r1(o['x0']), r1(o['top']), r1(o['x1']), r1(o['bottom'])]


def union(boxes):
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]


def runs_of(words):
    """Group words into runs: same line, read left to right, split at wide gaps."""
    words = sorted(words, key=lambda w: (r1(w['top']), r1(w['x0'])))
    lines = []
    for w in words:
        if lines and abs(w['top'] - lines[-1][0]['top']) <= LINE_TOL:
            lines[-1].append(w)
        else:
            lines.append([w])
    runs = []
    for line in lines:
        line.sort(key=lambda w: w['x0'])
        run = [line[0]]
        for w in line[1:]:
            if w['x0'] - run[-1]['x1'] > GAP_FACTOR * max(run[-1]['size'], 1):
                runs.append(run)
                run = [w]
            else:
                run.append(w)
        runs.append(run)
    return runs


def match_box(run, offsets, start, end):
    return union([box(w) for w, (a, b) in zip(run, offsets) if a < end and b > start])


def median(values):
    s = sorted(values)
    return s[len(s) // 2] if s else 0


def regions(objs):
    """Bounding boxes of clusters of vector paths (lines, rects, curves) that touch within REGION_PAD."""
    boxes = [box(o) for o in objs]
    parent = list(range(len(boxes)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    cell = 50.0
    grid = {}
    for i, b in enumerate(boxes):
        for gx in range(int((b[0] - REGION_PAD) // cell), int((b[2] + REGION_PAD) // cell) + 1):
            for gy in range(int((b[1] - REGION_PAD) // cell), int((b[3] + REGION_PAD) // cell) + 1):
                grid.setdefault((gx, gy), []).append(i)
    for members in grid.values():
        for a in range(len(members)):
            i = members[a]
            bi = boxes[i]
            for j in members[a + 1:]:
                bj = boxes[j]
                if (bi[0] - REGION_PAD <= bj[2] and bj[0] - REGION_PAD <= bi[2]
                        and bi[1] - REGION_PAD <= bj[3] and bj[1] - REGION_PAD <= bi[3]):
                    ri, rj = find(i), find(j)
                    if ri != rj:
                        parent[max(ri, rj)] = min(ri, rj)
    groups = {}
    for i, b in enumerate(boxes):
        groups.setdefault(find(i), []).append(b)
    return sorted(union(g) for g in groups.values())


def ocr_words(page):
    """Words from local Tesseract for a page without a text layer, or None when Tesseract is not installed."""
    exe = shutil.which('tesseract')
    if not exe:
        return None
    scale = 300 / 72
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, 'page.png')
        page.to_image(resolution=300).original.save(png)
        out = subprocess.run([exe, png, 'stdout', 'tsv'], capture_output=True, text=True, check=False).stdout
    words = []
    for row in out.splitlines()[1:]:
        cols = row.split('\t')
        if len(cols) < 12 or not cols[11].strip() or cols[10] in ('', '-1'):
            continue
        x, y, w, h = (int(c) / scale for c in cols[6:10])
        words.append({'text': cols[11].strip(), 'x0': x, 'top': y, 'x1': x + w, 'bottom': y + h, 'size': h})
    return words


def extract_page(page, number, facts, warnings):
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=['size'])
    source = 'text'
    if not words:
        ocr = ocr_words(page)
        if ocr is None:
            warnings.append({'page': number, 'kind': 'ocr-unavailable', 'text': 'No text layer and no local Tesseract; page text not read'})
            source = 'none'
        else:
            words, source = ocr, 'ocr'
            if not words:
                warnings.append({'page': number, 'kind': 'no-text', 'text': 'No text layer; OCR found no words'})

    page_median = median([w['size'] for w in words])
    runs = runs_of(words) if words else []
    spans = []
    for run in runs:
        text, offsets = '', []
        for w in run:
            if text:
                text += ' '
            offsets.append((len(text), len(text) + len(w['text'])))
            text += w['text']
        spans.append({'text': text, 'box': union([box(w) for w in run]), 'size': r1(median([w['size'] for w in run]))})

        def add(kind, m, **extra):
            facts.append({'kind': kind, 'page': number, 'text': m.group(0), 'box': match_box(run, offsets, m.start(), m.end()), **extra})

        taken = []
        for m in DIMENSION.finditer(text):
            raw = float(m.group(1).replace(',', '.'))
            mm = raw * (10 if m.group(2).lower() == 'cm' else 1)
            # Whole millimetres only when the printed value is exact; otherwise keep the text and leave mm unset.
            add('dimension', m, unit=m.group(2).lower(), value=raw, mm=int(mm) if mm == int(mm) else None)
            taken.append((m.start(), m.end()))
        for m in QUANTITY.finditer(text):
            add('quantity', m, count=int(m.group(1) or m.group(2)))
            taken.append((m.start(), m.end()))
        for m in ARTICLE.finditer(text):
            add('article', m, number=m.group(1))
            taken.append((m.start(), m.end()))
        lone = len(run) == 1 and LABEL.match(run[0]['text'])
        for m in BARE_NUMBER.finditer(text):
            if not lone and not any(a < m.end() and b > m.start() for a, b in taken):
                add('number', m, value=int(m.group(1)))

        if lone:
            w = run[0]
            is_step = w['text'].isdigit() and page_median and w['size'] >= STEP_FACTOR * page_median
            facts.append({'kind': 'step' if is_step else 'label', 'page': number, 'text': w['text'], 'box': box(w)})

    if page_median and source == 'ocr':
        warnings.append({'page': number, 'kind': 'ocr', 'text': 'Text read by OCR; check every fact against the page'})

    vectors = list(page.lines) + list(page.rects) + list(page.curves)
    return {
        'number': number,
        'size': [r1(page.width), r1(page.height)],
        'rotation': int(page.rotation or 0),
        'textSource': source,
        'spans': spans,
        'vectors': {'lines': len(page.lines), 'rects': len(page.rects), 'curves': len(page.curves), 'regions': regions(vectors)},
        'images': sorted(box(i) for i in page.images),
    }


def extract(path):
    with open(path, 'rb') as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    facts, warnings, pages = [], [], []
    with pdfplumber.open(path) as pdf:
        meta = pdf.metadata or {}
        for i, page in enumerate(pdf.pages, start=1):
            pages.append(extract_page(page, i, facts, warnings))
    facts.sort(key=lambda f: (f['page'], f['box'][1], f['box'][0], f['kind'], f['text']))
    for n, f in enumerate(facts, start=1):
        f['id'] = f"f{n}"
    title = meta.get('Title')
    return {
        'format': FORMAT,
        'source': {'sha256': digest, 'pages': len(pages), 'title': title if isinstance(title, str) else None},
        'pages': pages,
        'facts': facts,
        'warnings': warnings,
    }


def dumps(data):
    return json.dumps(data, sort_keys=True, ensure_ascii=False, indent=1) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description='Extract printed facts from a local assembly-manual PDF (ADR-0029).')
    ap.add_argument('pdf', help='path to a local PDF file')
    ap.add_argument('--out', required=True, help='directory to write extraction.json into')
    args = ap.parse_args(argv)
    if re.match(r'^[a-z]+://', args.pdf, re.I):
        ap.error('give a local file; this script never downloads')
    if not os.path.isfile(args.pdf):
        ap.error(f'no such file: {args.pdf}')
    data = extract(args.pdf)
    os.makedirs(args.out, exist_ok=True)
    target = os.path.join(args.out, 'extraction.json')
    with open(target, 'w', encoding='utf-8') as f:
        f.write(dumps(data))
    kinds = {}
    for fact in data['facts']:
        kinds[fact['kind']] = kinds.get(fact['kind'], 0) + 1
    summary = ', '.join(f'{k} {v}' for k, v in sorted(kinds.items())) or 'no facts'
    print(f"{target}: {data['source']['pages']} pages; {summary}; {len(data['warnings'])} warnings")
    return 0


if __name__ == '__main__':
    sys.exit(main())
