// @vitest-environment jsdom
// Find-it for ADR-184 (N187) in jsdom (ADR-108): the research page renders and lists only the features left to build —
// from the bare app, by role and visible text, at desktop and phone widths.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

/** The 9 Verified features ADR-184 deletes, by the name the page showed. */
const BUILT = [
  'Transactional undo/redo',
  'Step-by-step assembly sequence',
  'Reusable ensemble templates',
  'Live price/cost estimate',
  'Connected items stay independently selectable',
  'Direct manipulation in 2D/3D',
  'Versioned save/reload of entire ensembles',
  'Deterministic generation of alternative valid layouts',
  'Lock/pin modules and preserve manual overrides',
];

describe.each(WIDTHS)('ADR-184 at %ipx (find-it)', (width) => {
  it('⋯ › Feature Research lists no built feature', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /Feature Research/ }));
    const page = await screen.findByRole('main', { name: 'Feature Research & Catalog' });
    const built = await within(page).findByRole('region', { name: 'Built in this app' });
    expect(built.textContent).toMatch(/Of the 23 left \(after 17 merged as the same idea\)/);
    expect(built.textContent).toMatch(/10 in progress/);
    expect(built.textContent).toMatch(/13 not started/);
    expect(built.textContent).not.toMatch(/built by a status you set/);
    expect(
      within(page).getAllByRole('button', { name: 'Local dependency update on parameter change' })
        .length,
    ).toBeGreaterThan(0);
    for (const name of BUILT) expect(within(page).queryAllByRole('button', { name })).toEqual([]);
  });
});
