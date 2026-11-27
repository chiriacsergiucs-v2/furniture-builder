// @vitest-environment jsdom
// Find-it for ADR-302 (N429) in jsdom (ADR-108), from the bare app at 1280 and 390 px: on the Sheets tab every part
// shows its size, a tap names the part (popup and the line under the sheet title), and a board's Leftovers → Add
// leftover lays a sheet out as "leftover", which "Sheets to buy" does not count.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)(
  'Sheets tab: part sizes, part names and leftovers at %ipx (find-it, ADR-302)',
  (width) => {
    it('names a tapped part and lays parts on an added leftover first', async () => {
      const { user } = await renderApp(width);
      await user.click(await screen.findByRole('button', { name: 'New single piece' }));
      await user.click(
        within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
      );
      if (width === PHONE_WIDTH) {
        const build = screen.queryByRole('radio', { name: /Cut List/ });
        if (build) await user.click(build);
      }
      await user.click(screen.getByRole('tab', { name: /^Sheets/ }));
      const panel = screen.getByRole('tabpanel');
      await within(panel).findByText('Sheets to buy', {}, { timeout: 10_000 });

      // Every part is drawn with its size.
      const parts = within(panel).getAllByRole('button', { name: /, \d+ × \d+ mm$/ });
      expect(parts.length).toBeGreaterThan(0);
      for (const p of parts) expect(p.textContent).toMatch(/\d+×\d+/);

      // A tap names the part, in a popup and under the sheet title.
      expect(within(panel).getAllByText('Tap a part to see what it is.').length).toBeGreaterThan(0);
      await user.click(parts[0]);
      const name = parts[0].getAttribute('aria-label')!;
      expect(within(panel).getByRole('status').textContent).toContain(name.split(',')[0]);
      expect(within(panel).getByText(name)).toBeTruthy();

      // Leftovers → Add leftover: the first sheet becomes the leftover; it is not bought.
      const before = within(panel).getAllByRole('cell')[0].textContent;
      await user.click(within(panel).getAllByText('Leftovers')[0]);
      await user.click(within(panel).getAllByRole('button', { name: 'Add leftover' })[0]);
      await waitFor(
        () =>
          expect(
            within(screen.getByRole('tabpanel')).getByText(/· leftover \d+ × \d+ mm/),
          ).toBeTruthy(),
        { timeout: 10_000 },
      );
      expect(
        Number(within(screen.getByRole('tabpanel')).getAllByRole('cell')[0].textContent),
      ).toBeLessThanOrEqual(Number(before));
    });
  },
);
