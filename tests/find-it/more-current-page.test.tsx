// @vitest-environment jsdom
// Find-it for audit finding F-29 (G-518) in jsdom (ADR-108): on the Information and Gaps pages, which only ⋯ leads to,
// the "More" button is marked as the current place, and so is the item in its menu; on other pages it is not.
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openMore, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)(
  'the current place on Information and Gaps at %ipx (find-it, F-29)',
  (width) => {
    it('More › Information and guides, then More › Gaps, mark More as the current place', async () => {
      const { user } = await renderApp(width);
      const summary = () => screen.getAllByLabelText('More')[0];
      expect(summary().getAttribute('aria-current')).toBeNull();
      await openMore(user);
      await user.click(screen.getByRole('button', { name: /^Information and guides/ }));
      await screen.findByRole('heading', { name: /Information|guides/i, level: 1 });
      expect(summary().getAttribute('aria-current')).toBe('page');
      await openMore(user);
      expect(
        screen
          .getByRole('button', { name: /^Information and guides/ })
          .getAttribute('aria-current'),
      ).toBe('page');
      await user.click(screen.getByRole('button', { name: /^Gaps/ }));
      await screen.findByRole('heading', { name: /Gaps/, level: 1 });
      expect(summary().getAttribute('aria-current')).toBe('page');
    });
  },
);
