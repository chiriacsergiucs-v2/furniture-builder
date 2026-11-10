// @vitest-environment jsdom
// ADR-253 (no Lock for a size the piece lacks) and ADR-258 (the problem banner's wording and focus), on the
// components themselves.
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ProblemBanner } from '../src/ui/ProblemBanner';
import { useProblem } from '../src/store/problemStore';
import { newProject } from '../src/core/project';
import type { Diagnostic } from '../src/core/types';

afterEach(() => cleanup());

const problem = (d: Diagnostic) => ({ d, repairs: [], chosen: null, base: newProject('P') });

describe('problem banner (ADR-258)', () => {
  it('a problem with no repair family says it has no automatic repair', () => {
    render(
      <ProblemBanner
        problem={problem({
          severity: 'warning',
          code: 'connection-broken',
          message: 'A and B no longer touch.',
          itemIds: ['a', 'b'],
        })}
      />,
    );
    expect(
      screen.getByText('This problem has no automatic repair. Move or change the pieces yourself.'),
    ).toBeTruthy();
  });

  it('an overlap whose repairs were all refused keeps the other sentence', () => {
    render(
      <ProblemBanner
        problem={problem({
          severity: 'error',
          code: 'pieces-overlap',
          message: 'A and B overlap.',
          itemIds: ['a', 'b'],
        })}
      />,
    );
    expect(screen.getByText(/^No repair clears this without causing another problem/)).toBeTruthy();
  });

  it('a tapped check moves focus to the banner', () => {
    render(
      <ProblemBanner
        problem={problem({
          severity: 'error',
          code: 'pieces-overlap',
          message: 'X',
          itemIds: ['a'],
        })}
      />,
    );
    act(() => useProblem.setState((s) => ({ tapped: s.tapped + 1 })));
    expect(document.activeElement).toBe(
      screen.getByRole('region', { name: 'Problem and repairs' }),
    );
  });
});

describe('Lock menu (ADR-253)', () => {
  it('a bed offers no Lock Height', async () => {
    const { renderApp } = await import('./find-it/setup');
    const { user } = await renderApp(1280);
    const { useDesign } = await import('../src/store/designStore');
    const { catalogFamilies, insertVariant } = await import('../src/core/catalog');
    const fam = catalogFamilies.find((f) => f.id === 'bed')!;
    const bed = insertVariant(fam, fam.variants[0])!;
    const { projectWithTwoPieces } = await import('./find-it/setup');
    await projectWithTwoPieces(user);
    act(() => {
      useDesign.getState().addPiece(bed);
      useDesign.getState().stopPlacing();
      useDesign.getState().selectItem(useDesign.getState().project!.items.at(-1)!.id);
    });
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'More actions' }));
    const menu = await screen.findByRole('group', { name: 'More actions' });
    expect(within(menu).queryByRole('button', { name: 'Lock Height' })).toBeNull();
    expect(within(menu).getByRole('button', { name: 'Lock Width' })).toBeTruthy();
    void userEvent;
  });

  it('a panel offers no Lock Depth', async () => {
    const { renderApp, projectWithTwoPieces } = await import('./find-it/setup');
    const { user } = await renderApp(1280);
    const { useDesign } = await import('../src/store/designStore');
    const { catalogFamilies, insertVariant } = await import('../src/core/catalog');
    const panel = catalogFamilies
      .flatMap((f) => f.variants.map((v) => insertVariant(f, v)))
      .find((d) => d?.product.kind === 'panel')!;
    await projectWithTwoPieces(user);
    act(() => {
      useDesign.getState().addPiece(panel);
      useDesign.getState().stopPlacing();
      useDesign.getState().selectItem(useDesign.getState().project!.items.at(-1)!.id);
    });
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByRole('button', { name: 'More actions' }));
    const menu = await screen.findByRole('group', { name: 'More actions' });
    expect(within(menu).queryByRole('button', { name: 'Lock Depth' })).toBeNull();
    expect(within(menu).getByRole('button', { name: 'Lock Width' })).toBeTruthy();
  });
});

describe('Russian texts of the audit hints and errors (ADR-251, ADR-254, ADR-257, ADR-262)', () => {
  it('each text has a Russian entry', async () => {
    const i18n = await import('../src/core/i18n');
    await i18n.loadDictionary('ru');
    const keys = [
      // ADR-251: the two hints that name Move alone.
      'Connected pieces move together; a snap connects them, Alt while dragging or Move alone moves one alone. A pair that no longer touches is warned about.',
      'The piece stays against its wall: dragging it slides it along the wall. Alt while dragging or Move alone moves it away and takes it off the wall.',
    ] as const;
    // ADR-254, ADR-257, ADR-262: the errors and names these items add.
    const others = [
      'Whole numbers in mm, separated by commas. Not saved until they are.',
      'Enter a name. Not saved until there is one.',
      'Add a picture for the floor',
      'Replace picture for the floor',
      'The prepared picture was not applied because the floor background changed.',
      'Variant {n} name',
      'Give the template a name.',
    ] as const;
    i18n.setLang('ru');
    try {
      for (const k of keys) expect(i18n.t(k)).toMatch(/Двигать отдельно/);
      for (const k of others) expect(i18n.t(k, { n: 1 })).toMatch(/[а-яё]/i);
    } finally {
      i18n.setLang('en');
    }
  });
});
