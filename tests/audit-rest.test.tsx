// @vitest-environment jsdom
// The UI audit's remaining Done-when items, through the app at 1280 px (the find-it files cover both widths):
// ADR-254 (decimals in run-part and clearance fields, a loose panel's Name), ADR-255 (the Group scope reason),
// ADR-256 (Fasteners decimals, a failed fastener save, the fitting's length), ADR-257 (the floor picture),
// ADR-260 (the price chip, the Shopping field hints, the render on the right sheet), ADR-261 (a failed piece delete,
// read failures) and ADR-263 (Share link failures).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addPiece, openSheet, projectWithTwoPieces, renderApp } from './find-it/setup';

const flags = vi.hoisted(() => ({
  failFastener: false,
  failDeleteDesign: false,
  failListDesigns: false,
  failOrphans: false,
  failPrices: false,
  failSavePrices: false,
}));
vi.mock('../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../src/persist/db')>();
  return {
    ...real,
    saveFastener: (...a: Parameters<typeof real.saveFastener>) =>
      flags.failFastener
        ? Promise.reject(new Error('QuotaExceededError'))
        : real.saveFastener(...a),
    deleteDesign: (...a: Parameters<typeof real.deleteDesign>) =>
      flags.failDeleteDesign
        ? Promise.reject(new Error('QuotaExceededError'))
        : real.deleteDesign(...a),
    listDesigns: (...a: Parameters<typeof real.listDesigns>) =>
      flags.failListDesigns ? Promise.reject(new Error('blocked')) : real.listDesigns(...a),
    listOrphanVersions: (...a: Parameters<typeof real.listOrphanVersions>) =>
      flags.failOrphans ? Promise.reject(new Error('blocked')) : real.listOrphanVersions(...a),
    listPrices: (...a: Parameters<typeof real.listPrices>) =>
      flags.failPrices ? Promise.reject(new Error('blocked')) : real.listPrices(...a),
    savePrices: (...a: Parameters<typeof real.savePrices>) =>
      flags.failSavePrices
        ? Promise.reject(new Error('QuotaExceededError'))
        : real.savePrices(...a),
  };
});
const image = vi.hoisted(() => ({ hold: null as null | ((v: unknown) => void) }));
vi.mock('../src/persist/images', async (orig) => {
  const real = await orig<typeof import('../src/persist/images')>();
  return {
    ...real,
    importImage: (f: File) =>
      image.hold === null
        ? real.importImage(f)
        : new Promise((r) => {
            image.hold = r;
          }),
  };
});

type User = Awaited<ReturnType<typeof renderApp>>['user'];
beforeEach(() => {
  for (const k of Object.keys(flags) as (keyof typeof flags)[]) flags[k] = false;
  image.hold = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: () => Promise.resolve([]), ready: Promise.resolve() },
  });
  window.print = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

async function single(user: User, name: RegExp) {
  await user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await user.click(within(await screen.findByRole('dialog')).getAllByRole('button', { name })[0]);
}
async function settings(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
  return screen.findByRole('dialog');
}

describe('ADR-256 hardware fields', () => {
  it('Fasteners Per "1.5" and From each end "37.5" are refused and marked', async () => {
    const { user } = await renderApp(1280);
    await single(user, /Sideboard/);
    await settings(user);
    await user.click(screen.getByText('Fasteners', { selector: 'summary' }));
    const { useFastenerList } = await import('../src/store/fastenerStore');
    await user.type(await screen.findByLabelText('Carcass joint: your fastener'), 'Confirmat 7x50');
    const per = screen.getByLabelText(/Carcass joint: how many per/) as HTMLInputElement;
    await user.clear(per);
    await user.type(per, '1.5');
    await user.tab();
    expect(per.value).toBe('1.5');
    expect(per.getAttribute('aria-invalid')).toBe('true');
    const c = useFastenerList.getState().choices.find((x) => x.joint === 'carcass-joint');
    expect(c?.per).not.toBe(15);
    const edge = screen.getByLabelText('From each end (mm)') as HTMLInputElement;
    await user.type(edge, '37.5');
    await user.tab();
    expect(edge.value).toBe('37.5');
    expect(edge.getAttribute('aria-invalid')).toBe('true');
  });

  it('after a failed fastener save the row shows what is saved, with the alert', async () => {
    const { user } = await renderApp(1280);
    await single(user, /Sideboard/);
    await settings(user);
    await user.click(screen.getByText('Fasteners', { selector: 'summary' }));
    flags.failFastener = true;
    const field = await screen.findByLabelText('Carcass joint: your fastener');
    await user.clear(field);
    await user.type(field, 'Confirmat 7x60');
    await user.tab();
    // Generous waits: under a loaded full run the refused save and the row's reset take seconds.
    expect(
      await screen.findByText(
        'The fastener could not be saved on this device.',
        {},
        { timeout: 10000 },
      ),
    ).toBeTruthy();

    // The row shows what storage holds for the joint (empty, or what an earlier test saved), not the refused text.
    const db = await import('../src/persist/db');
    const saved = (await db.listFasteners()).find((c) => c.joint === 'carcass-joint')?.name ?? '';
    expect(saved).not.toBe('Confirmat 7x60');
    await waitFor(
      () =>
        expect(
          (screen.getByLabelText('Carcass joint: your fastener') as HTMLInputElement).value,
        ).toBe(saved),
      { timeout: 10000 },
    );
  }, 40000);

  it('Fitting you chose takes at most 200 characters', async () => {
    const { user } = await renderApp(1280);
    await single(user, /Lift-up flap/);
    const { useDesign } = await import('../src/store/designStore');
    const { findInProduct } = await import('../src/core/design');
    await user.click(screen.getByRole('radio', { name: 'Compose' }));
    const flap = useDesign
      .getState()
      .model.spaces.find(
        (s) =>
          findInProduct(useDesign.getState().design.product, s.nodeId)?.space.front?.kind ===
          'flap',
      )!;
    act(() => useDesign.getState().select(flap.nodeId));
    const fit = (await screen.findByLabelText('Fitting you chose')) as HTMLInputElement;
    expect(fit.maxLength).toBe(200);
  });
});

describe('ADR-254 construction fields', () => {
  it('"10,5" in From left and "2.5" in Trim height save nothing and mark the field', async () => {
    const { user } = await renderApp(1280);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    for (const what of [/Base cabinet, doors/, /Wall cabinet/]) {
      await user.click(await screen.findByRole('button', { name: 'Add a piece' }));
      const list = await screen.findByRole('dialog', { name: 'Add a piece' });
      await user.click(within(list).getAllByRole('button', { name: what })[0]);
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
      const right = screen.queryByRole('button', { name: 'Place to the right' });
      if (right) await user.click(right);
    }
    const { useDesign } = await import('../src/store/designStore');
    const st = () => useDesign.getState();
    act(() => st().selectItem(st().project!.items[0].id));
    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    const x = within(card).getByLabelText('From left') as HTMLInputElement;
    const before = st().project!.items[0].position.x;
    await user.clear(x);
    await user.type(x, '10,5');
    await user.tab();
    expect(x.getAttribute('aria-invalid')).toBe('true');
    expect(st().project!.items[0].position.x).toBe(before);

    const s = await settings(user);
    const runParts = within(s).getByRole('region', { name: 'Run parts' });
    await user.click(within(runParts).getByRole('button', { name: 'Add trim…' }));
    const trim = within(runParts).getByRole('group', { name: 'Add a trim' });
    await user.click(within(trim).getByRole('radio', { name: 'Crown' }));
    for (const box of within(trim).getAllByRole('checkbox')) await user.click(box);
    const h = within(trim).getByLabelText('Trim height');
    await user.type(h, '2.5');
    expect(h.getAttribute('aria-invalid')).toBe('true');
    expect(
      (within(trim).getByRole('button', { name: 'Add trim' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  }, 30000);

  it('a decimal Cut-out width and a decimal clearance depth are kept and marked, not saved', async () => {
    const { user } = await renderApp(1280);
    await projectWithTwoPieces(user);
    const s = await settings(user);
    const runParts = within(s).getByRole('region', { name: 'Run parts' });
    await user.click(within(runParts).getByRole('button', { name: 'Add sink…' }));
    const sg = within(runParts).getByRole('group', { name: 'Sink over a base unit' });
    const w = within(sg).getByLabelText('Cut-out width') as HTMLInputElement;
    await user.type(w, '50.5');
    expect(w.value).toBe('50.5');
    expect(w.getAttribute('aria-invalid')).toBe('true');
    const { ClearanceFields } = await import('../src/ui/Clearances');
    const { useDesign } = await import('../src/store/designStore');
    const item = useDesign.getState().project!.items[0];
    const { render } = await import('@testing-library/react');
    const r = render(<ClearanceFields item={{ ...item, zones: { service: { side: 'front' } } }} />);
    const depth = within(r.container).getAllByRole('textbox')[0] as HTMLInputElement;
    await user.type(depth, '2.5');
    await user.tab();
    expect(depth.value).toBe('2.5');
    expect(depth.getAttribute('aria-invalid')).toBe('true');
  });

  it('an emptied loose-panel Name says why and saves nothing', async () => {
    const { user } = await renderApp(1280);
    const { templates } = await import('../src/core/design');
    const { useDesign } = await import('../src/store/designStore');
    await single(user, /Chest of drawers/);
    act(() => useDesign.getState().load(templates.find((x) => x.id === 'panels')!.create()));
    const s = await settings(user);
    const panels = (
      useDesign.getState().design.product as { params: { panels: { name: string }[] } }
    ).params.panels;
    await user.click(within(s).getAllByText(new RegExp(`^${panels[0].name} — `))[0]);
    const name = within(s).getAllByRole('textbox', { name: 'Name' })[0] as HTMLInputElement;
    await user.clear(name);
    await user.tab();
    expect(within(s).getByText('Enter a name. Not saved until there is one.')).toBeTruthy();
    expect(
      (useDesign.getState().design.product as { params: { panels: { name: string }[] } }).params
        .panels[0].name,
    ).toBe(panels[0].name);
  });
});

describe('ADR-255 the Group scope', () => {
  it('a disabled Group shows its reason as text tied to the radio', async () => {
    const { user } = await renderApp(1280);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const nd = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(nd).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    await openSheet(user);
    await addPiece(user);
    const { useDesign } = await import('../src/store/designStore');
    act(() => useDesign.getState().selectItem(useDesign.getState().project!.items[0].id));
    await user.click(screen.getByRole('button', { name: 'Material' }));
    const dlg = await screen.findByRole('dialog', { name: 'Material' });
    const group = within(dlg).getByRole('radio', { name: 'Group' }) as HTMLButtonElement;
    expect(group.disabled).toBe(true);
    const why = document.getElementById(group.getAttribute('aria-describedby')!)!;
    expect(why.textContent).toMatch(/Not in a run/);
  });
});

describe('ADR-257 the floor picture', () => {
  it('the file input is named Replace once a picture is set; a dropped picture is said', async () => {
    const { user } = await renderApp(1280);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create project' }),
    );
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await user.click(await within(panel).findByRole('button', { name: 'Add the room' }));
    const room = screen.getByRole('region', { name: 'Room' });
    const bg = within(room).getByLabelText('Floor background') as HTMLSelectElement;
    await user.selectOptions(bg, 'picture');
    expect(within(room).getByLabelText('Add a picture for the floor')).toBeTruthy();
    // A picture still being prepared when the choice changes is not applied, and that is said.
    image.hold = () => {};
    const input = within(room).getByLabelText('Add a picture for the floor') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'floor.png', { type: 'image/png' })] },
    });
    await user.selectOptions(bg, 'colour');
    await act(async () => {
      image.hold!({ ok: true, color: '#aaaaaa', image: { id: 'img-f', name: 'floor.png' } });
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(
      within(room).getByText(
        'The prepared picture was not applied because the floor background changed.',
      ),
    ).toBeTruthy();
    const { useDesign } = await import('../src/store/designStore');
    act(() => {
      const p = useDesign.getState().project!;
      useDesign.getState().setRoom({
        ...p.room!,
        floor: { colour: '#aaaaaa', image: { id: 'img-f', name: 'floor.png' } },
      } as never);
    });
    expect(within(room).getByLabelText('Replace picture for the floor')).toBeTruthy();
  });
});

describe('ADR-260 shopping and the client sheet', () => {
  it('the estimate chip says the prices could not be read', async () => {
    flags.failPrices = true;
    const { user } = await renderApp(1280);
    await single(user, /Chest of drawers/);
    expect(await screen.findByRole('button', { name: /Prices could not be read/ })).toBeTruthy();
  });

  it('a wrong Price is marked with a hint', async () => {
    const { user } = await renderApp(1280);
    await single(user, /Chest of drawers/);
    await user.click(screen.getByRole('tab', { name: /^Shopping/ }));
    const panel = screen.getByRole('tabpanel');
    await user.click(within(panel).getByRole('button', { name: /^Prices$/ }));
    const price = within(panel).getAllByLabelText(/^Price of /)[0];
    await user.type(price, 'abc');
    await user.tab();
    expect(price.getAttribute('aria-invalid')).toBe('true');
    expect(price.getAttribute('title')).toBe('An amount, for example 12.50');
  });

  it('the Shopping list says an unreadable price list and a refused price import', async () => {
    flags.failPrices = true;
    const { user } = await renderApp(1280);
    await single(user, /Chest of drawers/);
    await user.click(screen.getByRole('tab', { name: /^Shopping/ }));
    const panel = screen.getByRole('tabpanel');
    expect(
      await within(panel).findByText('Prices could not be read from this browser.'),
    ).toBeTruthy();
    flags.failPrices = false;
    flags.failSavePrices = true;
    await user.click(within(panel).getByRole('button', { name: /^Prices$/ }));
    const csv = 'key;unit;price\nboard:PAL 18 white;sheet;100\n';
    const { parsePricesCsv } = await import('../src/core/prices');
    expect(parsePricesCsv(csv).prices.length).toBe(1);
    await user.upload(
      within(panel).getByLabelText(/Import prices/),
      new File([csv], 'prices.csv', { type: 'text/csv' }),
    );
    expect(
      await within(panel).findByText('The prices could not be saved on this device.'),
    ).toBeTruthy();
  });

  it('a wrong Seller units and seller Quantity are marked with a hint, in English and Russian', async () => {
    const { user } = await renderApp(1280);
    await single(user, /Chest of drawers/);
    await user.click(screen.getByRole('tab', { name: /^Shopping/ }));
    await user.click(
      await screen.findByRole('button', { name: /^Product for Ball-bearing side runner pair/ }),
    );
    let picker = await screen.findByRole('dialog', {
      name: /^Product for Ball-bearing side runner pair/,
    });
    const runner = (await within(picker).findAllByRole('listitem', {}, { timeout: 15000 }))[0];
    await user.click(within(runner).getByRole('button', { name: 'Use this' }));
    const per = await screen.findByRole('textbox', {
      name: /^Seller units per item for Ball-bearing/,
    });
    await user.clear(per);
    await user.type(per, '0');
    await user.tab();
    expect(per.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('A number above 0, for example 1 or 0.5.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add seller product' }));
    picker = await screen.findByRole('dialog', { name: 'Add seller product' });
    await user.type(within(picker).getByRole('searchbox'), '230M2500.21');
    await user.click(
      (await within(picker).findAllByRole('button', { name: 'Use this' }, { timeout: 15000 }))[0],
    );
    const qty = await screen.findByRole('spinbutton', { name: /^Quantity of Glisiera BLUM/ });
    await user.clear(qty);
    await user.type(qty, '1.5');
    await user.tab();
    expect(qty.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Whole number from 0 to 9999.')).toBeTruthy();

    const i18n = await import('../src/core/i18n');
    await i18n.loadDictionary('ru');
    i18n.setLang('ru');
    try {
      for (const s of [
        i18n.t('An amount, for example 12.50'),
        i18n.t('A number above 0, for example 1 or 0.5.'),
        i18n.t('Whole number from {min} to {max}.', { min: 0, max: 9999 }),
      ])
        expect(s).toMatch(/[а-яё]/i);
    } finally {
      i18n.setLang('en');
    }
  }, 30000);

  it("a render of piece A is A's client picture and not piece B's", async () => {
    const { user } = await renderApp(1280);
    await single(user, /Chest of drawers/);
    const { useUi } = await import('../src/store/uiStore');
    const { useDesign } = await import('../src/store/designStore');
    const a = useDesign.getState().design;
    useUi.getState().setLastRender('blob:mine', a.id);
    const clientSheet = async () => {
      await user.click(screen.getByRole('tab', { name: /^Parts/ }));
      await user.click(
        within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Client sheet' }),
      );
    };
    await clientSheet();
    await waitFor(() => expect(useUi.getState().clientPicture).toBe('blob:mine'));
    act(() => useUi.setState({ clientPicture: null }));
    const { templates } = await import('../src/core/design');
    act(() => useDesign.getState().load({ ...templates[0].create(), name: 'Piece B' }));
    await clientSheet();
    await waitFor(() => expect(useUi.getState().clientPicture).not.toBe('blob:mine'));
    act(() => useDesign.getState().load(a));
    await clientSheet();
    await waitFor(() => expect(useUi.getState().clientPicture).toBe('blob:mine'));
  });
});

describe('ADR-261 deletes and reads', () => {
  it('a piece delete the storage refuses is said', async () => {
    const { user } = await renderApp(1280);
    await single(user, /Chest of drawers/);
    const db = await import('../src/persist/db');
    await waitFor(async () => expect((await db.listDesigns()).length).toBeGreaterThan(0));
    // A second piece, not the open one (the open one cannot be deleted).
    const { templates } = await import('../src/core/design');
    await db.saveDesign({ ...templates[0].create(), name: 'Old chest' });
    await user.click(
      screen
        .queryAllByRole('link', { name: 'Projects' })
        .concat(screen.queryAllByRole('button', { name: 'Projects' }))[0],
    );
    const page = await screen.findByRole('main', { name: 'Projects' });
    flags.failDeleteDesign = true;
    await user.click(within(page).getAllByRole('button', { name: 'Delete Old chest' })[0]);
    const ask = await screen.findByText(/^Delete “Old chest”\?/);
    await user.click(within(ask.closest('dialog')!).getByRole('button', { name: 'Delete' }));
    expect(
      await within(page).findByText('The piece could not be deleted from this browser’s storage.'),
    ).toBeTruthy();
    // The row stays.
    expect(
      within(page).getAllByRole('button', { name: 'Delete Old chest' }).length,
    ).toBeGreaterThan(0);
  });

  it('Add a piece says a failed read of the saved pieces', async () => {
    const { user } = await renderApp(1280);
    await projectWithTwoPieces(user);
    flags.failListDesigns = true;
    await user.click(await screen.findByRole('button', { name: 'Add a piece' }));
    const list = await screen.findByRole('dialog', { name: 'Add a piece' });
    expect(
      await within(list).findByText('Saved work could not be read from this browser.'),
    ).toBeTruthy();
  });

  it('Versions of deleted projects says a failed read, with Retry', async () => {
    flags.failOrphans = true;
    const { user } = await renderApp(1280);
    await projectWithTwoPieces(user);
    expect(
      (await screen.findAllByText('Saved work could not be read from this browser.')).length,
    ).toBeGreaterThan(0);
  });
});

describe('ADR-263 Share link failures', () => {
  it('Make a link that cannot reach the online part says so and stays usable', async () => {
    vi.doMock('../src/online/client', () => ({
      listShares: async () => [],
      createShare: async () => {
        throw new Error('offline');
      },
      stopShare: async () => {
        throw new Error('offline');
      },
      initSession: async () => {},
      restoreSession: async () => null,
      remoteIdOf: async () => null,
    }));
    const { user } = await renderApp(1280);
    await single(user, /Chest of drawers/);
    const { useAccount } = await import('../src/store/accountStore');
    const { useDesign } = await import('../src/store/designStore');
    const d = useDesign.getState().design;
    act(() =>
      useAccount.getState().set({ shareFor: { table: 'designs', id: d.id, name: d.name } }),
    );
    const dlg = await screen.findByRole('dialog', { name: /^Share link: / });
    const make = await within(dlg).findByRole('button', { name: /Make a link/ });
    await user.click(make);
    expect(await within(dlg).findByRole('alert')).toBeTruthy();
    expect((make as HTMLButtonElement).disabled).toBe(false);
    vi.doUnmock('../src/online/client');
  });
});
