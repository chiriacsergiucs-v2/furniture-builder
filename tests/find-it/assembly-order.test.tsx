// @vitest-environment jsdom
// Find-it for the project assembly order (ADR-178, N181), in jsdom (ADR-108): More → New… → Fill the room → a mix
// with a corner cabinet → Build & Preview → Assembly → "Project order" with numbered stages (Corner cabinets first,
// then Base pieces) before the per-piece steps, and the guidance line under it; Print assembly steps → the printed
// sheet starts with the same section (Romanian by default).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('project assembly order at %ipx (find-it, ADR-178)', (width) => {
  it('Fill the room → Assembly → Project order with numbered stages and the guidance line; print starts with it', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /^Fill the room/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Fill the room' });
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    // The back wall and the right wall: one inside corner, one corner cabinet.
    const walls = within(dlg).getByRole('group', { name: 'Walls to fill' });
    await user.click(within(walls).getByRole('checkbox', { name: /^Wall 3,/ }));
    await user.click(within(walls).getByRole('checkbox', { name: /^Wall 4,/ }));
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    const cards = await within(dlg).findAllByRole('button', { name: 'Use this mix' });
    await user.click(cards[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill the room' })).toBeNull());

    // Build & Preview → Assembly.
    if (width === PHONE_WIDTH) {
      const build = screen.queryByRole('radio', { name: /Build & Preview/ });
      if (build) await user.click(build);
    }
    await user.click(screen.getByRole('tab', { name: /^Assembly/ }));
    const panel = screen.getByRole('tabpanel');
    const order = await within(panel).findByRole('region', { name: 'Project order' });
    expect(within(order).getByRole('heading', { name: 'Project order' })).toBeTruthy();
    const stages = within(order)
      .getAllByRole('listitem')
      .filter((li) => li.querySelector('.step-n'));
    expect(stages.length).toBeGreaterThanOrEqual(2);
    expect(stages.map((li) => li.querySelector('.step-n')!.textContent)).toEqual(
      stages.map((_, i) => String(i + 1)),
    );
    expect(within(stages[0]).getByText('Corner cabinets')).toBeTruthy();
    expect(within(stages[0]).getAllByText(/corner/i).length).toBeGreaterThan(1);
    expect(within(stages[1]).getByText('Base pieces')).toBeTruthy();
    expect(within(stages[1]).getAllByText(/Wall \d/).length).toBeGreaterThan(0);
    // The guidance line sits under the section, before the per-piece steps.
    const guidance = within(panel).getByText(/Guidance: order from the parts' positions/);
    expect(order.compareDocumentPosition(guidance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const firstPiece = within(panel).getAllByRole('region', { name: /^Assembly: / })[0];
    expect(
      guidance.compareDocumentPosition(firstPiece) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Print assembly steps: the sheet starts with the section, in Romanian by default.
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: () => Promise.resolve([]), ready: Promise.resolve() },
    });
    window.print = vi.fn();
    await user.click(within(panel).getByRole('button', { name: 'Print assembly steps' }));
    await waitFor(() => expect(document.querySelector('.print-root')).not.toBeNull());
    const first = document.querySelector('.print-root section.pr-block h2');
    expect(first?.textContent).toBe('Ordinea în proiect');
    expect(document.querySelector('.print-root section.pr-block')?.textContent).toMatch(
      /Corpuri de colț/,
    );
  });
});
