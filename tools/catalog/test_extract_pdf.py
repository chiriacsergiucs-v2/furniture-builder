"""Tests for extract_pdf.py on PDFs written by the test itself (no third-party manuals in the repo).

Run: python3 -I -m unittest discover tools/catalog
"""
import json
import os
import tempfile
import unittest
from unittest import mock

import extract_pdf


def make_pdf(pages):
    """A minimal PDF. Each page is a list of ('text', x, y, size, string) or ('line', x1, y1, x2, y2);
    y is measured from the bottom, as in PDF content streams. Letter-size pages (612 x 792 pt)."""
    objs = ['<< /Type /Catalog /Pages 2 0 R >>', None, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    kids = []
    for ops in pages:
        stream = []
        for op in ops:
            if op[0] == 'text':
                _, x, y, size, s = op
                stream.append(f'BT /F1 {size} Tf {x} {y} Td ({s}) Tj ET')
            else:
                _, x1, y1, x2, y2 = op
                stream.append(f'{x1} {y1} m {x2} {y2} l S')
        body = '\n'.join(stream).encode('latin-1')
        objs.append(f'<< /Length {len(body)} >>\nstream\n'.encode('latin-1') + body + b'\nendstream')
        objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {len(objs)} 0 R >>')
        kids.append(len(objs))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>"
    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for n, o in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f'{n} 0 obj\n'.encode('latin-1') + (o if isinstance(o, bytes) else o.encode('latin-1')) + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode('latin-1')
    for off in offsets:
        out += f'{off:010d} 00000 n \n'.encode('latin-1')
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode('latin-1')
    return bytes(out)


MANUAL = [
    [
        ('text', 72, 720, 10, 'Width 800 mm, depth 28 cm, height 202,5 cm'),
        ('text', 72, 600, 10, '8x'),
        ('text', 300, 600, 10, '101345'),
        ('text', 72, 500, 10, 'A'),
        ('text', 300, 500, 10, '12'),
        ('text', 72, 450, 10, 'Dowel 8.5 mm'),
        ('text', 72, 400, 10, 'x4'),
        ('line', 100, 300, 400, 300),
        ('line', 100, 300, 100, 200),
        ('line', 500, 100, 550, 100),
    ],
    [
        ('text', 72, 700, 40, '3'),
        ('text', 300, 600, 10, 'Shelf 764'),
    ],
    [('line', 50, 50, 200, 200)],
]


class ExtractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.pdf = os.path.join(cls.tmp.name, 'manual.pdf')
        with open(cls.pdf, 'wb') as f:
            f.write(make_pdf(MANUAL))
        with mock.patch('shutil.which', return_value=None):
            cls.data = extract_pdf.extract(cls.pdf)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def facts(self, kind, page=None):
        return [f for f in self.data['facts'] if f['kind'] == kind and (page is None or f['page'] == page)]

    def test_source(self):
        self.assertEqual(self.data['source']['pages'], 3)
        self.assertEqual(len(self.data['source']['sha256']), 64)

    def test_same_input_gives_identical_output(self):
        with mock.patch('shutil.which', return_value=None):
            again = extract_pdf.dumps(extract_pdf.extract(self.pdf))
        self.assertEqual(extract_pdf.dumps(self.data), again)

    def test_dimensions_with_units_and_exact_mm_only(self):
        dims = {f['text']: f for f in self.facts('dimension')}
        self.assertEqual(sorted(dims), ['202,5 cm', '28 cm', '8.5 mm', '800 mm'])
        self.assertIsNone(dims['8.5 mm']['mm'])  # not whole millimetres: text kept, no rounding
        self.assertEqual(dims['800 mm']['mm'], 800)
        self.assertEqual(dims['28 cm']['mm'], 280)
        self.assertEqual(dims['202,5 cm']['mm'], 2025)
        for f in dims.values():
            self.assertEqual(f['page'], 1)

    def test_fact_box_is_on_the_printed_text(self):
        d = next(f for f in self.facts('dimension') if f['text'] == '800 mm')
        x0, top, x1, bottom = d['box']
        # Text baseline at y = 720 from the bottom of a 792 pt page, so about 72 pt from the top.
        self.assertTrue(72 < x0 < x1 < 300, d['box'])
        self.assertTrue(60 < top < bottom < 80, d['box'])

    def test_quantities_articles_labels(self):
        self.assertEqual(sorted(f['count'] for f in self.facts('quantity')), [4, 8])
        self.assertEqual([f['number'] for f in self.facts('article')], ['101345'])
        self.assertEqual(sorted(f['text'] for f in self.facts('label', 1)), ['12', 'A'])
        self.assertEqual(self.facts('number', 1), [])  # a lone label is not also a bare number

    def test_large_lone_integer_is_a_step(self):
        self.assertEqual([f['text'] for f in self.facts('step')], ['3'])
        self.assertEqual([f['value'] for f in self.facts('number', 2)], [764])

    def test_no_sizes_inferred_from_drawings(self):
        p1 = self.data['pages'][0]['vectors']
        self.assertEqual(p1['lines'], 3)
        self.assertEqual(len(p1['regions']), 2)  # two touching lines form one region; the far line another
        self.assertFalse(any(f['page'] == 3 for f in self.data['facts']))

    def test_page_without_text_warns_instead_of_failing(self):
        self.assertEqual([(w['page'], w['kind']) for w in self.data['warnings']], [(3, 'ocr-unavailable')])
        self.assertEqual(self.data['pages'][2]['textSource'], 'none')

    def test_ids_are_unique_and_sequential(self):
        ids = [f['id'] for f in self.data['facts']]
        self.assertEqual(ids, [f'f{n}' for n in range(1, len(ids) + 1)])

    def test_cli_writes_json_and_refuses_urls(self):
        out = os.path.join(self.tmp.name, 'out')
        with mock.patch('shutil.which', return_value=None), mock.patch('builtins.print'):
            self.assertEqual(extract_pdf.main([self.pdf, '--out', out]), 0)
        with open(os.path.join(out, 'extraction.json'), encoding='utf-8') as f:
            self.assertEqual(json.load(f)['format'], extract_pdf.FORMAT)
        with self.assertRaises(SystemExit), mock.patch('sys.stderr'):
            extract_pdf.main(['https://example.com/manual.pdf', '--out', out])


if __name__ == '__main__':
    unittest.main()
