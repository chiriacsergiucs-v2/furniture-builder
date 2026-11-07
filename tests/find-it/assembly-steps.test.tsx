// @vitest-environment jsdom
// Find-it for the assembly steps re-check (ADR-185, ADR-186; N188, N189), in jsdom (ADR-108): More → New… → Project
// with several pieces → a base cabinet and a chest of drawers → Build & Preview → Assembly. The base cabinet's steps
// start with "Prepare the parts" and "Fit hardware to the sides", each step has an instruction and a fastener line
// ("choose your fastener"); the chest lists "Drawer box × 4". Print assembly steps → each piece's section starts with
// its front view and names the parts in Romanian (the default print language).
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  addPiece,
  hiddenLabelled,
  PHONE_WIDTH,
  printedSheet,
  renderApp,
  stepItems,
  WIDTHS,
} from './setup';

describe.each(WIDTHS)('assembly steps re-check at %ipx (find-it, ADR-185, ADR-186)', (width) => {
  it('Assembly → Prepare the parts, Fit hardware to the sides, a fastener line, Drawer box × 4; print with front views', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await addPiece(user, /Base cabinet, doors: 1 door/);
    await addPiece(user, /Chest of drawers/);

    if (width === PHONE_WIDTH) {
      const build = screen.queryByRole('radio', { name: /Build & Preview/ });
      if (build) await user.click(build);
    }
    await user.click(screen.getByRole('tab', { name: /^Assembly/ }));
    const panel = screen.getByRole('tabpanel');
    const pieces = await within(panel).findAllByRole('region', { name: /^Assembly: / });
    expect(pieces).toHaveLength(2);
    const [base, chest] = pieces;

    // The base cabinet: Prepare the parts, then Fit hardware to the sides (hinge mounting plates).
    const steps = stepItems(base);
    expect(within(steps[0]).getByText('Prepare the parts')).toBeTruthy();
    expect(within(steps[0]).getByText(/^Hinge cups to drill: 2/)).toBeTruthy();
    expect(within(steps[1]).getByText('Fit hardware to the sides')).toBeTruthy();
    expect(within(steps[1]).getByText(/— mounting plates$/)).toBeTruthy();
    expect(
      within(steps[steps.length - 1]).getByText('Fit drawers and doors, adjust the fronts'),
    ).toBeTruthy();
    // An instruction and a fastener line at Sides to the bottom.
    const sides = steps.find((li) => within(li).queryByText('Sides to the bottom'))!;
    expect(
      within(sides).getByText('Fix the left side and right side to the bottom (2 joints).'),
    ).toBeTruthy();
    expect(
      within(sides).getByText('2 joints — choose your fastener (Settings › Fasteners)'),
    ).toBeTruthy();
    // The Back step checks the carcass is square.
    expect(within(base).getByText(/Check the carcass is square \(equal diagonals\)/)).toBeTruthy();

    // The chest: four equal drawer boxes once.
    expect(within(chest).getByText('Drawer box × 4')).toBeTruthy();
    expect(within(chest).getByText(/carcass halves$/)).toBeTruthy();
    expect(within(chest).getByText(/drawer halves$/)).toBeTruthy();

    // Print assembly steps: a front view in each piece's section, part names in Romanian.
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: () => Promise.resolve([]), ready: Promise.resolve() },
    });
    window.print = vi.fn();
    await user.click(within(panel).getByRole('button', { name: 'Print assembly steps' }));
    const root = await printedSheet();
    // One section per piece: its heading, then its front view right after it.
    const pieceHeadings = within(root)
      .getAllByRole('heading', { level: 2, hidden: true })
      .filter((h) => h.textContent !== 'Ordinea în proiect');
    expect(pieceHeadings).toHaveLength(2);
    const views = hiddenLabelled(root, 'figure', /^Vedere frontală: /);
    expect(views).toHaveLength(2);
    views.forEach((view, i) => {
      expect(view.parentElement!.previousElementSibling).toBe(pieceHeadings[i]);
      expect(within(view).getByRole('img', { hidden: true }).tagName).toBe('svg');
    });
    const text = root.textContent ?? '';
    expect(text).toMatch(/Lateral stânga/);
    expect(text).toMatch(/Corp de sertar × 4/);
    expect(text).toMatch(/Balama aplicată/);
    expect(text).not.toMatch(/Left side|Drawer side|Ball-bearing/);
  });
});
