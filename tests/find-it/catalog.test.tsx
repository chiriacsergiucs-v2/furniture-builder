// @vitest-environment jsdom
// Find-it for the catalog and template flows (ADR-195, N200) in jsdom (ADR-108): from the bare app, by role and
// visible text, at desktop and phone widths. Card layout and "More" counts are measured by the browser script
// `tools/catalog-flows/find-it.mjs` (Acceptance: browser).
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

// Dexie keeps the IndexedDB it first saw across the fresh modules of each run: the templates saved here go.
afterEach(async () => {
  vi.restoreAllMocks();
  const { db } = await import('../../src/persist/db');
  await db.templates.clear();
});

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** The top bar's Catalog tab. */
async function openCatalog(user: User) {
  await user.click((await screen.findAllByRole('link', { name: /^(Catalog|Каталог)/ }))[0]);
  return screen.findByRole('heading', { level: 1, name: /^(Catalog|Каталог)$/ });
}
/** On a phone the catalog's own actions fold under "More catalog actions" (ADR-118). */
async function catalogActions(user: User, width: number, label = 'More catalog actions') {
  if (width === PHONE_WIDTH) await user.click(screen.getByText(label));
}
const firstFamily = (name: string) => screen.getAllByRole('article', { name })[0];

describe.each(WIDTHS)('catalog and template flows at %ipx (find-it, ADR-195)', (width) => {
  it('search "flap": each group chip and heading counts exactly the cards shown', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    await user.type(screen.getByRole('searchbox', { name: 'Search the catalog' }), 'flap');
    const chips = within(screen.getByRole('navigation', { name: 'Jump to a group' })).getAllByRole(
      'link',
    );
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      const [, label, n] = /^(.*) (\d+)$/.exec(chip.textContent!.trim())!;
      const section = screen.getByRole('region', { name: label });
      const cards = within(section).getAllByRole('button', { name: 'Open' });
      expect(cards.length, label).toBe(Number(n));
      const heading = within(section).getByRole('heading', { level: 2 });
      expect(heading.textContent).toBe(`${label} ${n} ${n === '1' ? 'item' : 'items'}`);
    }
  });

  it('"Save this piece as a template": absent with no design open; with one, the name/room/type form and a link to the new family', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    await catalogActions(user, width);
    expect(screen.queryByRole('button', { name: 'Save this piece as a template' })).toBeNull();

    await user.click(screen.getAllByRole('link', { name: /^Projects/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    await user.click(
      within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
    );
    await openCatalog(user);
    await catalogActions(user, width);
    await user.click(screen.getByRole('button', { name: 'Save this piece as a template' }));
    const dlg = await screen.findByRole('dialog', { name: 'Save to catalog' });
    const name = within(dlg).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Hall sideboard');
    await user.selectOptions(within(dlg).getByLabelText('Room'), 'Hallway');
    expect(within(dlg).getByLabelText('Type')).toBeTruthy();
    await user.click(within(dlg).getByRole('button', { name: 'Save' }));

    const status = await screen.findByText('Saved to the catalog.');
    expect(status).toBeTruthy();
    await user.click(screen.getByRole('link', { name: 'Show “Hall sideboard”' }));
    const fam = await screen.findByRole('article', { name: 'Hall sideboard' });
    expect(within(fam).getByText('Your template')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Hallway' })).getByRole('article', {
        name: 'Hall sideboard',
      }),
    ).toBeTruthy();
  });

  it('Edit template: no rooms or no name read as user sentences; no validator wording', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    await user.click(
      within(firstFamily('Bookcase (with back)')).getByRole('button', { name: 'Edit template' }),
    );
    const editor = await screen.findByRole('region', { name: /^Edit template / });
    const rooms = within(editor).getByRole('group', { name: /^Rooms/ });
    for (const box of within(rooms).getAllByRole('checkbox'))
      if ((box as HTMLInputElement).checked) await user.click(box);
    expect(within(editor).getByRole('alert').textContent).toBe('Tick at least one room.');
    await user.clear(within(editor).getByLabelText('Name'));
    expect(within(editor).getByRole('alert').textContent).toBe(
      'Give the template a name. Tick at least one room.',
    );
    expect(within(editor).getByRole('button', { name: 'Save template' })).toHaveProperty(
      'disabled',
      true,
    );
    for (const raw of [/Rooms must be/, /Family needs/, /Invalid variant/])
      expect(screen.queryByText(raw)).toBeNull();
  });

  it('in Russian: the same draft reads the Russian sentences', async () => {
    localStorage.setItem('fb:lang', 'ru');
    const { user } = await renderApp(width);
    await openCatalog(user);
    await user.click(
      within(firstFamily('Книжный шкаф (с задней стенкой)')).getByRole('button', {
        name: 'Изменить шаблон',
      }),
    );
    const editor = await screen.findByRole('region', { name: /^Изменить шаблон / });
    for (const box of within(editor).getAllByRole('checkbox'))
      if ((box as HTMLInputElement).checked) await user.click(box);
    await user.clear(within(editor).getByLabelText('Название'));
    expect(within(editor).getByRole('alert').textContent).toBe(
      'Дайте шаблону название. Отметьте хотя бы одну комнату.',
    );
  });

  it('Edit design → Cancel stores nothing and returns to the draft; → Save to template adds one revision', async () => {
    const { user } = await renderApp(width);
    const { listTemplates } = await import('../../src/persist/db');
    await openCatalog(user);
    await user.click(
      within(firstFamily('Bookcase (with back)')).getByRole('button', { name: 'Edit template' }),
    );
    let editor = await screen.findByRole('region', { name: /^Edit template / });
    const name = within(editor).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'My bookcase');
    await user.click(within(editor).getAllByRole('button', { name: 'Edit design' })[0]);

    const saveTo = await screen.findByRole('button', { name: 'Save to template' });
    await user.click(within(saveTo.parentElement!).getByRole('button', { name: 'Cancel' }));
    editor = await screen.findByRole('region', { name: 'Edit template My bookcase' });
    expect((within(editor).getByLabelText('Name') as HTMLInputElement).value).toBe('My bookcase');
    expect(await listTemplates()).toEqual([]);

    await user.click(within(editor).getAllByRole('button', { name: 'Edit design' })[0]);
    await user.click(await screen.findByRole('button', { name: 'Save to template' }));
    await screen.findByRole('heading', { level: 1, name: 'Catalog' });
    await waitFor(async () => expect(await listTemplates()).toHaveLength(1));
    const [row] = await listTemplates();
    expect(row.revision).toBe(2);
    expect(row.family.name).toBe('My bookcase');
    expect(within(firstFamily('My bookcase')).getByText('Edited on this device')).toBeTruthy();
  });

  it('a refused write shows an alert and keeps the draft open; a failed read is said as such', async () => {
    const { user } = await renderApp(width);
    const { db } = await import('../../src/persist/db');
    const { useTemplates } = await import('../../src/store/templatesStore');
    await openCatalog(user);
    await user.click(
      within(firstFamily('Bookcase (with back)')).getByRole('button', { name: 'Edit template' }),
    );
    const editor = await screen.findByRole('region', { name: /^Edit template / });
    await user.type(within(editor).getByLabelText('Name'), ' 2');
    const put = vi.spyOn(db.templates, 'put').mockRejectedValue(new Error('QuotaExceededError'));
    await user.click(within(editor).getByRole('button', { name: 'Save template' }));
    expect(
      (
        await screen.findByText('The template could not be saved in this browser’s storage.')
      ).closest('[role="alert"]'),
    ).toBeTruthy();
    expect(
      screen.getByRole('region', { name: 'Edit template Bookcase (with back) 2' }),
    ).toBeTruthy();
    put.mockRestore();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/could not be saved/)).toBeNull();
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }));

    const read = vi.spyOn(db.templates, 'orderBy').mockImplementation(() => {
      throw new Error('broken');
    });
    act(() => useTemplates.setState({ loaded: false }));
    expect(
      (await screen.findByText('Templates saved on this device could not be read.')).closest(
        '[role="alert"]',
      ),
    ).toBeTruthy();
    read.mockRestore();

    vi.spyOn(db.designs, 'orderBy').mockImplementation(() => {
      throw new Error('broken');
    });
    await user.click(screen.getByRole('tab', { name: /^Saved/ }));
    expect(
      (await screen.findByText('Designs saved on this device could not be read.')).closest(
        '[role="alert"]',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Nothing saved on this device yet.')).toBeNull();
    vi.restoreAllMocks();
  });

  it('"Keep mine" hides the shipped-update notice and leaves the template revision as it was', async () => {
    const { user } = await renderApp(width);
    const { db, saveTemplate } = await import('../../src/persist/db');
    const { shadowOf } = await import('../../src/core/catalog/local');
    const { findFamily } = await import('../../src/core/catalog');
    const { useTemplates } = await import('../../src/store/templatesStore');
    const old = { ...shadowOf(findFamily('sideboard')!), basedOn: 0, revision: 3 };
    await saveTemplate(old);
    act(() => useTemplates.setState({ loaded: false }));
    await openCatalog(user);
    const fam = (await screen.findAllByRole('article', { name: 'Sideboard' }))[0];
    expect(within(fam).getByText(/The shipped template was updated/)).toBeTruthy();
    await user.click(within(fam).getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(screen.queryByText(/The shipped template was updated/)).toBeNull());
    const row = (await db.templates.get(old.id))!.template;
    expect(row).toMatchObject({ basedOn: 0, revision: 3, seenShipped: 1 });
  });

  it('a safety-regulated card: "I check it myself" enables Open and ticks the catalog switch', async () => {
    const { user } = await renderApp(width);
    await openCatalog(user);
    const bunk = firstFamily('Bunk bed');
    const card = within(bunk)
      .getAllByRole('listitem')
      .find((li) => within(li).queryByText('Standard'))!;
    expect(
      within(card).getByText('Safety-regulated: you check it against the standards yourself'),
    ).toBeTruthy();
    expect(within(card).queryByText(/Not available yet/)).toBeNull();
    expect(within(card).getByRole('button', { name: 'Open' })).toHaveProperty('disabled', true);
    await user.click(within(card).getByRole('button', { name: 'I check it myself' }));
    expect(within(card).getByRole('button', { name: 'Open' })).toHaveProperty('disabled', false);
    await catalogActions(user, width);
    expect(
      screen.getByRole('checkbox', { name: 'I check safety-regulated items myself' }),
    ).toHaveProperty('checked', true);
  });
});
