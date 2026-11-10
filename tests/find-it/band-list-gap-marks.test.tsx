// @vitest-environment jsdom
// Find-it for ADR-212 (N217), in jsdom (ADR-108), at phone and desktop widths, from the bare app:
// - More → Gaps → Export marks downloads the marks as a gap-marks file; Import marks reads one back, keeps the newer
//   mark and says "Imported N marks, skipped M" (G-100);
// - a single piece → Settings → Boards, sheets and saw cut → Import band list (CSV); each board's edge band then
//   offers From your band list with Matching bands (same decor code, at least as wide as the board) first and Other
//   bands in your list; a pick fills the band's type, thickness, width and code and keeps the trim allowance (G-038).
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findFamily } from '../../src/core/catalog';
import { setPrintLang } from '../../src/core/i18n/print';
import { data_catalog } from '../../src/core/i18n/ru/data-catalog';
import { renderApp, WIDTHS } from './setup';

const gap = (id: string, title: string) => `### ${id}: ${title}

- Status: Open
- Origin: ADR-101
- Missing: something
- Request: “build it”
- Questions: build it?
- Suggested pick: build it
`;

// A small ledger, so the test does not depend on the live docs/adr/GAPS.md.
vi.mock('../../docs/adr/GAPS.md?raw', () => ({
  default: ['# Gaps\n', gap('G-901', 'Drawer runners'), gap('G-902', 'Wall map')].join('\n'),
}));

// `renderApp` gives the page a fresh `indexedDB`, but Dexie (not reset by `vi.resetModules`) keeps the factory it
// read when first loaded, so marks made at one width would still be there at the next. Each run starts empty here.
beforeEach(() => {
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});
afterEach(() => {
  vi.restoreAllMocks();
  setPrintLang('ro');
});

const csvFile = (name: string, text: string) => new File([text], name, { type: 'text/csv' });

describe.each(WIDTHS)('ADR-212 at %i px (find-it)', (width) => {
  it('bare app → More → Gaps → Export marks, then Import marks keeps the newer mark and counts skipped rows', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText(/^More$/));
    await user.click(screen.getByRole('button', { name: /^Gaps/ }));
    const page = await screen.findByRole('main', { name: 'Gaps' });
    const exportBtn = within(page).getByRole('button', { name: 'Export marks' });
    await waitFor(() => expect((exportBtn as HTMLButtonElement).disabled).toBe(false));

    const rowOf = (id: string) =>
      within(page)
        .getAllByRole('listitem')
        .find((li) => li.textContent?.includes(id))!;
    await user.click(within(rowOf('G-901')).getByRole('button', { name: 'Acknowledge' }));

    // Export: the file is the gap-marks file with the mark just made.
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:marks';
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    await user.click(exportBtn);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^gap-marks-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(await blobs[0].text()) as {
      kind: string;
      version: number;
      marks: { gapId: string; decision: string | null; updatedAt: string }[];
    };
    expect(file.kind).toBe('furniture-builder-gap-marks');
    expect(file.version).toBe(1);
    expect(file.marks.map((m) => [m.gapId, m.decision])).toEqual([['G-901', 'acknowledge']]);

    // Import: G-902 is new, G-901's older row loses to the device's mark, an unknown gap and a bad row are skipped.
    const marks = {
      kind: 'furniture-builder-gap-marks',
      version: 1,
      exportedAt: '2026-11-06T00:00:00.000Z',
      marks: [
        { gapId: 'G-902', decision: 'adr', note: '', updatedAt: '2999-01-01T00:00:00.000Z' },
        { gapId: 'G-901', decision: 'adr', note: '', updatedAt: '2000-01-01T00:00:00.000Z' },
        { gapId: 'G-999', decision: 'adr', note: '', updatedAt: '2999-01-01T00:00:00.000Z' },
        { gapId: 'G-902', decision: 'maybe' },
      ],
    };
    const input = within(page).getByLabelText('Import marks');
    await user.upload(
      input,
      new File([JSON.stringify(marks)], 'gap-marks.json', { type: 'application/json' }),
    );
    // Only applied marks count as imported; the older one is said as kept (ADR-266).
    expect(
      await within(page).findByText(
        /^Imported \d marks?, kept \d \(yours are newer\), skipped 2\.$/,
      ),
    ).toBeTruthy();
    expect(
      within(rowOf('G-902')).getByRole('button', { name: 'Make ADR' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      within(rowOf('G-901'))
        .getByRole('button', { name: 'Acknowledge' })
        .getAttribute('aria-pressed'),
    ).toBe('true');

    // A file that is not a gap-marks file applies nothing and says so.
    await user.upload(input, new File(['{}'], 'other.json', { type: 'application/json' }));
    expect(await within(page).findByText('The file is not a gap-marks file.')).toBeTruthy();
  });

  it('bare app → single piece → Settings → Import band list (CSV) → Matching bands; a pick keeps the trim allowance', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const start = await screen.findByRole('dialog');
    await user.click(within(start).getAllByRole('button', { name: /Chest of drawers/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    await user.click(within(settings).getByText('Boards, sheets and saw cut'));

    // The board gets a decor code from the user's decor list (ADR-049).
    await user.upload(
      within(settings).getByLabelText('Import decor list (CSV)'),
      csvFile(
        'decors.csv',
        'manufacturer,type,code,name,thickness,color\nEgger,PAL,H1145,Bardolino Oak,18,#b59a7a\n',
      ),
    );
    await within(settings).findByText(/1 decor imported from decors\.csv/);
    const boardRow = () =>
      within(settings)
        // Each board row is a group named after its board (ADR-255).
        .getAllByRole('group', { name: /^Board / })
        .find((li) => within(li).queryByRole('group', { name: /^Edge band for / }))!;
    await user.selectOptions(
      within(boardRow()).getByLabelText('Decor from your list'),
      within(boardRow()).getByRole('option', { name: /H1145/ }),
    );

    // No band list yet; then import one.
    expect(within(settings).getByText(/Band list: none\./)).toBeTruthy();
    await user.upload(
      within(settings).getByLabelText('Import band list (CSV)'),
      csvFile(
        'bands.csv',
        [
          'manufacturer,type,code,decor,name,thickness,width,color',
          'Egger,ABS,B1145,H1145,Oak band,0.8,22,#b59a7a',
          'Egger,ABS,B1146,H1145,Oak narrow,0.4,15,#b59a7a',
          'Rehau,PVC,W100,,White band,2,23,#ffffff',
          'Rehau,PVC,bad,,Bad row,0.45,23,#ffffff',
        ].join('\n'),
      ),
    );
    expect(await within(settings).findByText(/3 bands imported from bands\.csv/)).toBeTruthy();
    expect(within(settings).getByText(/Band list: bands\.csv, 3 bands\./)).toBeTruthy();

    const band = within(boardRow()).getByRole('group', { name: /^Edge band for / });
    const pick = within(band).getByRole('group', { name: 'From your band list' });
    expect(within(pick).getByText('Matching bands')).toBeTruthy();
    // Matching: the same decor code and at least as wide as the 18 mm board; the 15 mm band is not.
    const matches = within(pick).getAllByRole('button');
    expect(matches.map((b) => b.textContent)).toEqual([
      'Egger B1145 Oak band · ABS 0.8 × 22 mm, B1145',
    ]);
    const others = within(pick).getByLabelText('Other bands in your list') as HTMLSelectElement;
    expect([...others.options].map((o) => o.textContent)).toEqual([
      'Not from the list',
      'Egger B1146 Oak narrow · ABS 0.4 × 15 mm, B1146',
      'Rehau W100 White band · PVC 2 × 23 mm, W100',
    ]);

    // Pick the matching band: type, thickness, width and code are filled from the file.
    await user.click(matches[0]);
    const field = (name: string) => within(band).getByLabelText(name) as HTMLInputElement;
    await waitFor(() => expect(field('Band width (mm)').value).toBe('22'));
    expect(field('Band thickness (mm)').value).toBe('0.8');
    expect(field('Band code (optional)').value).toBe('B1145');

    // A trim allowance the user typed stays when another band is picked.
    const allowance = field('Trim allowance per edge (mm)');
    await user.clear(allowance);
    await user.type(allowance, '3');
    fireEvent.blur(allowance);
    await user.selectOptions(
      within(band).getByLabelText('Other bands in your list'),
      'Rehau W100 White band · PVC 2 × 23 mm, W100',
    );
    await waitFor(() => expect(field('Band code (optional)').value).toBe('W100'));
    expect(field('Band width (mm)').value).toBe('23');
    expect(field('Band thickness (mm)').value).toBe('2');
    expect(field('Trim allowance per edge (mm)').value).toBe('3');
    expect((within(band).getByLabelText('Band type') as HTMLSelectElement).value).toBe('pvc');
  });

  it('bare app → catalog piece → Shopping → Print shopping list: the title follows More › Print language (G-381)', async () => {
    const family = findFamily('base-doors')!;
    const stored = family.variants.find((v) => v.id === 'base-door')!.create!().name;
    const want = {
      ro: 'Listă de cumpărături — Corp bază cu uși — 1 ușă + raft',
      ru: `Список покупок — ${data_catalog[stored]}`,
      en: `Shopping list — ${stored}`,
    };
    expect(data_catalog[stored]).toBeTruthy();
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const start = await screen.findByRole('dialog');
    await user.click(
      within(start).getAllByRole('button', { name: /Base cabinet, doors: 1 door \+ shelf/ })[0],
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const build = screen.queryByRole('radio', { name: /Build & Preview/ });
    if (build) await user.click(build);
    await user.click(screen.getByRole('tab', { name: /Shopping/ }));
    const list = await screen.findByRole('tabpanel');

    let html = '';
    const fake = {
      document: { write: (s: string) => (html += s), close: () => {} },
      focus: () => {},
      print: () => {},
    };
    vi.spyOn(window, 'open').mockReturnValue(fake as unknown as Window);
    const title = () => /<h1>([^<]*)<\/h1>/.exec(html)?.[1];
    await user.click(within(list).getByRole('button', { name: 'Print shopping list' }));
    expect(title()).toBe(want.ro);
    for (const [lang, name] of [
      ['ru', 'Русский'],
      ['en', 'English'],
    ] as const) {
      await user.click(screen.getByLabelText(/^More$/));
      const group = screen.getByRole('group', { name: /Print language/ });
      await user.click(within(group).getByRole('button', { name }));
      await user.keyboard('{Escape}');
      html = '';
      await user.click(within(list).getByRole('button', { name: 'Print shopping list' }));
      expect(title()).toBe(want[lang]);
    }
  });
});
