// @vitest-environment jsdom
// Find-it for audit finding F-29 (G-518) in jsdom (ADR-108): on the Information page, which ⋯ leads to, the "More"
// button is marked as the current place, and so is the item in its menu; on other pages it is not. The Gaps page is
// reached from the Information page's own button, so the menu has no Gaps item; More itself is marked current there (G-535).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openMore, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)(
  'the current place on Information and Gaps at %ipx (find-it, F-29)',
  (width) => {
    it('More › Information and guides marks More as the current place; Gaps from there is reached on the Information page', async () => {
      const { user } = await renderApp(width);
      const summary = () => screen.getAllByLabelText('More')[0];
      expect(summary().getAttribute('aria-current')).toBeNull();
      await openMore(user);
      expect(screen.queryByRole('button', { name: /^Gaps/ })).toBeNull();
      await user.click(screen.getByRole('button', { name: /^Information and guides/ }));
      const info = await screen.findByRole('main', { name: 'Information and guides' });
      expect(summary().getAttribute('aria-current')).toBe('page');
      await openMore(user);
      expect(
        screen
          .getByRole('button', { name: /^Information and guides/ })
          .getAttribute('aria-current'),
      ).toBe('page');
      await user.click(within(info).getByRole('button', { name: /^Gaps/ }));
      await screen.findByRole('heading', { name: /Gaps/, level: 1 });
      // The Gaps page marks More as the current place too (G-535).
      expect(summary().getAttribute('aria-current')).toBe('page');
    });
  },
);
