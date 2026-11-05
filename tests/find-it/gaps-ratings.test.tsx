// @vitest-environment jsdom
// Find-it for ADR-187 (N191), in jsdom (ADR-108): from the bare app, More → Gaps → Impact: High leaves only the
// high-impact gaps, each row with its Issue and Fix lines, and a gap whose fix conflicts with an ADR shows its
// Conflicts chip, at phone and desktop widths.
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

const gap = (id: string, title: string, status: string, extra: string) => `### ${id}: ${title}

- Status: ${status}
- Origin: ADR-101
- Missing: something
- Request: “build it”
- Questions: build it?
- Suggested pick: build it
${extra}
`;

// A small ledger with ratings, so the test does not depend on the live docs/adr/GAPS.md.
vi.mock('../../docs/adr/GAPS.md?raw', () => ({
  default: [
    '# Gaps\n',
    gap(
      'G-901',
      'Drawer runners',
      'Open',
      '- Work: Medium\n- Impact: High\n- Necessity: High\n- Issue: Drawers have no runner choice\n' +
        '- Fix: Add a runner picker\n- Conflicts: ADR-014: the 3D viewer never edits',
    ),
    gap(
      'G-902',
      'Wall map',
      'Open',
      '- Work: High\n- Impact: High\n- Necessity: Low-medium\n- Issue: The wall has no map\n' +
        '- Fix: Draw the wall map\n- Conflicts: none',
    ),
    gap(
      'G-903',
      'Plinth colour',
      'Open',
      '- Work: Low\n- Impact: Low\n- Necessity: Low\n- Issue: Plinth colour is fixed\n' +
        '- Fix: Let the plinth take a board\n- Conflicts: none',
    ),
    gap('G-904', 'Not rated yet', 'Open', ''),
  ].join('\n'),
}));

describe.each(WIDTHS)('gaps ratings at %i px (find-it, ADR-187)', (width) => {
  it('bare app → More → Gaps → Impact: High → only high-impact rows with Issue, Fix and Conflicts', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText(/^More$/));
    await user.click(screen.getByRole('button', { name: /^Gaps/ }));
    const page = await screen.findByRole('main', { name: 'Gaps' });
    expect(within(page).getByRole('heading', { level: 1, name: 'Gaps' })).toBeTruthy();
    const list = within(page).getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);

    // Three rating filter groups on the five levels, with counts.
    for (const name of ['Work', 'Impact', 'Necessity']) {
      const group = within(page).getByRole('group', { name });
      for (const level of ['Low', 'Low-medium', 'Medium', 'Medium-high', 'High'])
        expect(within(group).getByRole('button', { name: new RegExp(`^${level} \\(\\d+\\)$`) }));
    }
    const impact = within(page).getByRole('group', { name: 'Impact' });
    const high = within(impact).getByRole('button', { name: 'High (2)' });
    expect(high.getAttribute('aria-pressed')).toBe('false');
    await user.click(high);
    expect(high.getAttribute('aria-pressed')).toBe('true');

    expect(within(page).getByText('2 of 4 shown')).toBeTruthy();
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent?.match(/G-\d{3}/)?.[0])).toEqual(['G-901', 'G-902']);
    for (const row of rows) {
      expect(within(row).getByText('Impact: High')).toBeTruthy();
      expect(within(row).getByText(/^Work: /)).toBeTruthy();
      expect(within(row).getByText(/^Necessity: /)).toBeTruthy();
      expect(within(row).getByText('Issue:').parentElement?.textContent).toMatch(/^Issue: \S/);
      expect(within(row).getByText('Fix:').parentElement?.textContent).toMatch(/^Fix: \S/);
    }
    expect(within(rows[0]).getByText('Drawers have no runner choice')).toBeTruthy();
    expect(within(rows[0]).getByText('Add a runner picker')).toBeTruthy();
    // The gap whose fix conflicts with an ADR shows a marked chip with the ADR and why; "none" shows none.
    expect(
      within(rows[0]).getByText('Conflicts: ADR-014: the 3D viewer never edits').className,
    ).toContain('safety');
    expect(within(rows[1]).queryByText(/^Conflicts:/)).toBeNull();

    // The search covers the Fix line too, and Clear filters brings every gap back.
    await user.type(within(page).getByRole('searchbox', { name: 'Search the gaps' }), 'picker');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    await user.click(within(page).getByRole('button', { name: 'Clear filters' }));
    expect(high.getAttribute('aria-pressed')).toBe('false');
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });
});
