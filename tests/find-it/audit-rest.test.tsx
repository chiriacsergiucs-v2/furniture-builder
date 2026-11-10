// @vitest-environment jsdom
// Find-it for the UI audit's remaining Done-when items at 1280 and 390 px: ADR-251 (Move alone moves one connected
// piece), ADR-252 (Enter on Group), ADR-253 (a group set to its shown size; no Lock for a size a bed lacks),
// ADR-257 (the scale banner), ADR-258 (the problem banner), ADR-262 (Brands with a failed read; the template editor),
// ADR-264 (the row menu alert) and ADR-265 (a catalog piece's name in Russian).
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { composePanel, projectWithTwoPieces, renderApp, selectRows, WIDTHS } from './setup';

const flags = vi.hoisted(() => ({ failDesigns: false }));
vi.mock('../../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../../src/persist/db')>();
  return {
    ...real,
    listDesigns: (...a: Parameters<typeof real.listDesigns>) =>
      flags.failDesigns ? Promise.reject(new Error('blocked')) : real.listDesigns(...a),
  };
});
beforeEach(() => {
  flags.failDesigns = false;
});
afterEach(() => vi.unstubAllEnvs());

describe.each(WIDTHS)('UI audit, the rest, at %ipx (find-it)', (width) => {
  it('ADR-251: with Move alone on, an arrow key moves one of two connected pieces alone', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const { useDesign } = await import('../../src/store/designStore');
    const st = () => useDesign.getState();
    const [a, b] = st().project!.items;
    act(() => {
      st().selectItems([a.id, b.id]);
      st().setConnected(true);
      useDesign.setState({ placingItemId: null });
    });
    const plan = await screen.findByRole('figure', { name: /Room plan, seen from above/ });
    const options = within(plan).queryByRole('button', { name: 'Options' });
    if (options) await user.click(options);
    await user.click(await screen.findByRole('checkbox', { name: 'Move alone' }));
    const xa = st().project!.items[0].position.x;
    const xb = st().project!.items[1].position.x;
    const piece = within(plan).getAllByRole('button', { name: /^Base cabinet/ })[1];
    act(() => st().selectItem(b.id));
    fireEvent.keyDown(piece, { key: 'ArrowRight' });
    expect(st().project!.items[0].position.x).toBe(xa);
    expect(st().project!.items[1].position.x).toBeGreaterThan(xb);
  });

  it('ADR-252: Enter on Group groups the pieces', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    await selectRows(user, [0, 1]);
    const { useDesign } = await import('../../src/store/designStore');
    const card = within(composePanel()).getByRole('region', { name: /^2 pieces selected/ });
    within(card).getByRole('button', { name: 'Group' }).focus();
    await user.keyboard('{Enter}');
    expect(useDesign.getState().project!.groups ?? []).toHaveLength(1);
  });

  it('ADR-253: a group set to its shown height makes every piece that height in one step', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const { useDesign } = await import('../../src/store/designStore');
    const { resizeProduct } = await import('../../src/core/pieceSize');
    const st = () => useDesign.getState();
    act(() => {
      const p = st().project!;
      const it0 = p.items[0];
      const h = (it0.design.product.params as unknown as { height: number }).height;
      st().openProject({
        ...p,
        items: p.items.map((x, i) =>
          i === 0
            ? {
                ...x,
                design: {
                  ...x.design,
                  product: resizeProduct(x.design.product, 'height', h - 100),
                },
              }
            : x,
        ),
      });
      st().selectItems(st().project!.items.map((x) => x.id));
      st().groupSelection();
    });
    const card = within(composePanel()).getByRole('region', { name: /pieces selected/ });
    const height = within(card).getByLabelText('Height') as HTMLInputElement;
    const shown = height.value;
    const steps = st().projectPast.length;
    await user.click(height);
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(
        new Set(
          st().project!.items.map(
            (x) => (x.design.product.params as unknown as { height: number }).height,
          ),
        ),
      ).toEqual(new Set([Number(shown)])),
    );
    expect(st().projectPast.length).toBe(steps + 1);
  });

  it('ADR-257: two scale taps on one spot keep the banner and say "Tap a different point."', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    const { useDesign } = await import('../../src/store/designStore');
    const { newPlanPicture } = await import('../../src/core/planPicture');
    act(() => {
      const st = useDesign.getState();
      st.openProject({ ...st.project!, planPicture: newPlanPicture('img-x', 'plan.png', 800) });
      st.startScalePlan();
      st.addScalePoint([5, 5]);
      st.addScalePoint([5, 5]);
    });
    expect((await screen.findAllByText(/Tap a different point\./)).length).toBeGreaterThan(0);
  });

  it('ADR-262: Brands says a failed read of the saved pieces', async () => {
    const { user } = await renderApp(width);
    const db = await import('../../src/persist/db');
    await db.replaceDecors([
      {
        id: 'egger:W1000:18',
        maker: 'egger',
        makerText: 'Egger',
        kind: 'pal',
        code: 'W1000',
        name: 'Premium White',
        thickness: 18,
        color: '#ffffff',
        list: 'x.csv',
      } as never,
    ]);
    flags.failDesigns = true;
    await user.click(screen.getByRole('link', { name: /Catalog/ }));
    await user.click(await screen.findByRole('tab', { name: 'Brands' }));
    await user.click(await screen.findByRole('button', { name: 'Egger (1)' }));
    const sec = screen.getByRole('region', { name: 'Egger' });
    expect(
      await within(sec).findByText('Designs saved on this device could not be read.'),
    ).toBeTruthy();
    expect(within(sec).queryByText(/No saved piece has a board/)).toBeNull();
  });

  it('ADR-262: the template editor names each variant row and marks the Name field', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByRole('link', { name: /Catalog/ }));
    await screen.findByRole('heading', { level: 1, name: 'Catalog' });
    await user.click(screen.getAllByRole('button', { name: 'Edit template' })[0]);
    const ed = await screen.findByRole('region', { name: /^Edit template / });
    await user.click(within(ed).getAllByRole('button', { name: 'Duplicate' })[0]);
    expect(within(ed).getByLabelText('Variant 1 name')).toBeTruthy();
    expect(within(ed).getByLabelText('Variant 2 name')).toBeTruthy();
    const name = within(ed).getByLabelText('Name');
    await user.clear(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    for (const box of within(ed).getAllByRole('checkbox', { checked: true })) await user.click(box);
    await user.clear(within(ed).getByLabelText('Variant 1 name'));
    fireEvent.change(within(ed).getByLabelText('Default structure'), {
      target: { value: 'x'.repeat(1001) },
    });
    // Every problem is listed, not the first three.
    const alert = within(ed).getAllByRole('alert').at(-1)!;
    expect(alert.textContent!.split('.').filter((x) => x.trim()).length).toBeGreaterThanOrEqual(4);
  });

  it('ADR-265: in Russian a New… project and a catalog piece are stored in English, shown in Russian, and in English after switching back', async () => {
    localStorage.setItem('fb:lang', 'ru');
    let { user } = await renderApp(width);
    const db = await import('../../src/persist/db');
    await Promise.all(db.db.tables.map((tb) => tb.clear()));
    const { useDesign } = await import('../../src/store/designStore');
    const toProjects = async () => {
      await user.click(
        screen
          .queryAllByRole('link', { name: /Проекты|Projects/ })
          .concat(screen.queryAllByRole('button', { name: /^(Проекты|Projects)$/ }))[0],
      );
      return screen.findByRole('main', { name: /^(Проекты|Projects)$/ });
    };

    // A project from New… → Project with several pieces.
    await user.click(screen.getByLabelText('Ещё'));
    await user.click(await screen.findByRole('button', { name: /Создать…/ }));
    const start = await screen.findByRole('dialog');
    await user.click(within(start).getByRole('button', { name: /^Проект из нескольких изделий/ }));
    await waitFor(() => expect(useDesign.getState().project).toBeTruthy());
    expect(useDesign.getState().project!.name).toBe('New project');
    expect(screen.getAllByDisplayValue('Новый проект').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Новый проект: /).length).toBeGreaterThan(0);

    // A catalog piece.
    let page = await toProjects();
    await user.click(within(page).getByRole('button', { name: 'Новое отдельное изделие' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /^Буфет/ })[0]);
    await waitFor(() => expect(useDesign.getState().design.name).toMatch(/^Sideboard/));
    const field = screen.getByRole('textbox', {
      name: 'Название изделия',
    }) as HTMLInputElement;
    expect(field.value).toMatch(/^Буфет/);
    await waitFor(async () => {
      const names = [
        ...(await db.listProjects()).map((r) => r.name),
        ...(await db.listDesigns()).map((r) => r.name),
      ];
      expect(names).toContain('New project');
      expect(names.some((n) => /^Sideboard/.test(n))).toBe(true);
      expect(names.some((n) => /[а-яё]/i.test(n))).toBe(false);
    });
    page = await toProjects();
    expect(within(page).getAllByText('Новый проект').length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/^Буфет/).length).toBeGreaterThan(0);

    // Back to English: the same rows read in English.
    cleanup();
    localStorage.setItem('fb:lang', 'en');
    ({ user } = await renderApp(width));
    page = await toProjects();
    expect((await within(page).findAllByText('New project')).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/^Sideboard/).length).toBeGreaterThan(0);
    expect(within(page).queryByText('Новый проект')).toBeNull();
  });
});
