// @vitest-environment jsdom
// Find-it for N302 (suggestion cards), in jsdom (ADR-108): from the bare app, the New-piece wizard's "Suggested
// combinations" list shows 4 cards (CARDS_FIRST) and "Show more" brings the rest; the wall mixes (Fill a wall) and the
// room mixes (Fill the room) show 2 each (MIXES_FIRST); doors and drawer fronts are drawn see-through in the card
// pictures. jsdom has no layout or canvas, so the pictures are checked in their SVG markup (the data URL on each
// card's image), not as pixels.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, startNewWith as startNew, WIDTHS } from './setup';

/** The SVG text behind a card picture (an image data URL, ADR-143). */
function svgOf(card: HTMLElement): string {
  // Wizard cards have a decorative picture (alt ""), so it reads as presentation; mix cards name theirs.
  const img = (within(card).queryByRole('img') ??
    within(card).getByRole('presentation')) as HTMLImageElement;
  const prefix = 'data:image/svg+xml;charset=utf-8,';
  expect(img.getAttribute('src')?.startsWith(prefix)).toBe(true);
  return decodeURIComponent(img.getAttribute('src')!.slice(prefix.length));
}

const cardsOf = (list: HTMLElement) => within(list).getAllByRole('listitem');
/** Top-level cards only: a card's warning list items are nested list items. */
const topCards = (region: HTMLElement) =>
  cardsOf(region).filter((li) => li.className.includes('wz-card'));
const SEE_THROUGH = /fill-opacity="0\.28"/;

describe.each(WIDTHS)('Suggestion cards at %ipx (find-it, N302)', (width) => {
  it('the wizard lists 4 combinations, Show more brings the rest, fronts are see-through', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('button', { name: 'New piece' }));
    const wiz = await screen.findByRole('dialog', { name: 'New piece' });
    await user.click(
      within(within(wiz).getByRole('radiogroup', { name: 'Construction type' })).getByRole(
        'radio',
        { name: /Cabinet \(closed box\)/ },
      ),
    );
    const region = within(wiz).getByRole('region', { name: 'Suggested combinations' });
    expect(topCards(region)).toHaveLength(4);
    expect(within(region).getAllByRole('button', { name: /^Use this: / })).toHaveLength(4);

    // The pictures: a card with doors or drawers draws them see-through; the shelves behind stay solid.
    const withFronts = topCards(region).filter((c) => /door|drawer/.test(c.textContent ?? ''));
    expect(withFronts.length).toBeGreaterThan(0);
    for (const c of withFronts) {
      const svg = svgOf(c);
      expect(svg).toMatch(SEE_THROUGH);
      expect(svg).toMatch(/<path [^>]*stroke=/);
      expect(svg.match(/fill-opacity/g)!.length).toBeLessThan(svg.match(/<path /g)!.length);
    }
    const bare = topCards(region).filter((c) => !/door|drawer/.test(c.textContent ?? ''));
    for (const c of bare) expect(svgOf(c)).not.toMatch(SEE_THROUGH);

    // Show more: the rest comes 4 at a time, and the button counts what is left.
    const more = within(region).getByRole('button', { name: /^Show more \((\d+)\)$/ });
    const left = Number(/\((\d+)\)/.exec(more.textContent ?? '')![1]);
    expect(left).toBeGreaterThan(0);
    await user.click(more);
    expect(topCards(region)).toHaveLength(4 + Math.min(4, left));
  });

  it('Fill a wall shows the best 2 mixes, fronts see-through', async () => {
    const { user } = await renderApp(width);
    const dlg = await startNew(user, /^Fill a wall/, 'Fill a wall');
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    const region = await within(dlg).findByRole('region', { name: 'Suggested mixes' });
    expect(within(region).getByText(/best 2, each checked for problems/)).toBeTruthy();
    const uses = await within(region).findAllByRole('button', { name: 'Use this mix' });
    expect(uses).toHaveLength(2);
    const cards = topCards(region);
    expect(cards).toHaveLength(2);
    for (const c of cards) expect(svgOf(c)).toMatch(SEE_THROUGH);
  });

  it('Fill the room shows the best 2 room mixes, fronts see-through', async () => {
    const { user } = await renderApp(width);
    const dlg = await startNew(user, /^Fill the room/, 'Fill the room');
    await user.click(within(dlg).getByRole('button', { name: 'Next' }));
    await user.click(within(dlg).getByRole('button', { name: 'Show suggestions' }));
    const region = await within(dlg).findByRole('region', { name: 'Suggested room mixes' });
    expect(within(region).getByText(/best 2, each checked for problems/)).toBeTruthy();
    const uses = await within(region).findAllByRole('button', { name: 'Use this mix' });
    expect(uses).toHaveLength(2);
    const cards = topCards(region);
    expect(cards).toHaveLength(2);
    for (const c of cards) expect(svgOf(c)).toMatch(SEE_THROUGH);
  });
});
