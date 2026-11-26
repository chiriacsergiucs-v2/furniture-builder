// @vitest-environment jsdom
// Find-it for ADR-297 (N397), in jsdom (ADR-108): from the bare app, by role and visible text, at phone and desktop
// widths. The Editor mode switch (Compose, Cut List) is inside the top bar (the banner) on desktop, in no
// banner on a phone, and works with a click and the arrow keys in both places. Layout is CSS: no box is measured here.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('mode switch placement at %ipx (find-it, ADR-297)', (width) => {
  const phone = width === PHONE_WIDTH;

  it(
    phone
      ? 'phone: Editor mode stays outside the top bar (its own row, hidden by ADR-241)'
      : 'desktop: Editor mode radios are inside the top bar, not a row of their own',
    async () => {
      const { user } = await renderApp(width);
      await user.click(await screen.findByRole('button', { name: 'New single piece' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getAllByRole('button', { name: /Sideboard/ })[0]);

      const modes = await screen.findByRole('radiogroup', { name: 'Editor mode' });
      // The top bar is the banner that holds the Places nav; other landmarks named banner are not it.
      const places = screen.getByRole('navigation', { name: 'Places' });
      const bars = screen.getAllByRole('banner').filter((b) => b.contains(places));
      expect(bars).toHaveLength(1);
      const inBar = within(bars[0]).queryByRole('radiogroup', { name: 'Editor mode' });
      expect(inBar).toBe(phone ? null : modes);
      const compose = within(modes).getByRole('radio', { name: 'Compose' });
      const build = within(modes).getByRole('radio', { name: /Cut List/ });
      expect(compose.getAttribute('aria-checked')).toBe('true');
      await user.click(build);
      expect(build.getAttribute('aria-checked')).toBe('true');
      build.focus();
      await user.keyboard('{ArrowLeft}');
      expect(
        within(modes).getByRole('radio', { name: 'Compose' }).getAttribute('aria-checked'),
      ).toBe('true');
    },
  );
});
