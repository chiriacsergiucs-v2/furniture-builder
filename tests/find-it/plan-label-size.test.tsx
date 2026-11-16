// @vitest-environment jsdom
// Find-it for audit finding F-26 (G-518) in jsdom (ADR-108): the front view's labels (piece names and the size
// labels) are never drawn smaller than 8 CSS px, also when the drawing is shrunk to a phone's width.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('drawing labels stay legible at %ipx (find-it, F-26)', (width) => {
  afterEach(() => vi.restoreAllMocks());
  it('every label of the front view is at least 8 px on screen', async () => {
    // jsdom has no layout: the drawing is shrunk to a third of the screen, as a project plan wider than the screen is.
    const SZ = (width - 32) / 3;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: SZ,
      height: SZ,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: SZ,
      bottom: SZ,
      toJSON: () => ({}),
    });
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    const fig = await screen.findByLabelText('Front view. Select a space to edit it.');
    const svg = within(fig).getByRole('group');
    const vb = svg.getAttribute('viewBox')!.split(' ').map(Number);
    const px = Math.min(SZ / vb[2], SZ / vb[3]);
    const texts = within(fig).getAllByText(/./, { selector: 'text' });
    expect(texts.length).toBeGreaterThan(0);
    for (const tx of texts) {
      expect(Number(tx.getAttribute('font-size')) * px).toBeGreaterThanOrEqual(7.99);
    }
  });
});
