// @vitest-environment jsdom
// Find-it for ADR-216 (N221, G-470), in jsdom (ADR-108), from the bare app by role and visible text at 1280 and
// 390 px: More → New… → Start from shows each built-in template's description under its row; the blind corner row
// reads its defaults (610 mm blind section, cornerDefaults('blind')); a row with no built-in template shows none.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { cornerDefaults } from '../../src/core/design';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('Start from template descriptions at %ipx (find-it, ADR-216)', (width) => {
  it('More → New… → Start from: the blind corner row shows its 610 mm description; Blind right shows none', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    expect(within(start).getByRole('heading', { name: /^Start from/ })).toBeTruthy();
    // The size is the one the row builds (G-484: 820 mm with the plinth), the blind section the template's default.
    const c = cornerDefaults('blind');
    const text = `${c.width} × 820 × ${c.depth}, ${c.blindWidth} mm blind section on the left, one door`;
    expect(text).toBe('1000 × 820 × 560, 610 mm blind section on the left, one door');
    const [blind] = within(start).getAllByRole('button', {
      name: /^Blind corner: Blind left \+ shelf/,
    });
    expect(within(blind).getByText(text)).toBeTruthy();
    // Under its own summary, not in place of it.
    expect(within(blind).getByText('1000 wide, 720 carcass on the plinth')).toBeTruthy();
    const [right] = within(start).getAllByRole('button', {
      name: /^Blind corner: Blind right \+ shelf/,
    });
    expect(right.textContent).not.toMatch(/blind section/);
    // Another built-in template's row: the chest of drawers.
    const [chest] = within(start).getAllByRole('button', { name: /^Chest of drawers: / });
    expect(within(chest).getByText('800 × 900 × 450, four drawers on a plinth')).toBeTruthy();
    // G-484: the base door row states the 820 mm it builds, the desk its width × height × depth.
    const [baseDoor] = within(start).getAllByRole('button', {
      name: /^Base cabinet, doors: 1 door \+ shelf/,
    });
    expect(within(baseDoor).getByText('600 × 820 × 560, one shelf behind a door')).toBeTruthy();
    expect(start.textContent).not.toMatch(/600 × 720 × 560|1000 × 720 × 560|1400 × 700 × 750/);
    expect(start.textContent).toContain('1400 × 750 × 700, three-drawer pedestal left');
  });
});
