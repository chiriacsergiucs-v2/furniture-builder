// @vitest-environment jsdom
// ADR-260 (UI audit, Output), through the app at 1280 px: the printed Shopping list speaks only the print language,
// the Shopping CSV name is cleaned, a refused price import and a failed review pack are said, prints name a piece
// one way, and the Client sheet uses a render only of what is open. (The disabled exports and the Results tabs are in
// tests/find-it/audit-checks-output.test.tsx at both widths.)
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addPiece, openSheet, printedSheet, renderApp } from './find-it/setup';

const store = vi.hoisted(() => ({ failPrices: false, failModels: false }));
vi.mock('../src/persist/db', async (orig) => {
  const real = await orig<typeof import('../src/persist/db')>();
  return {
    ...real,
    savePrices: (...a: Parameters<typeof real.savePrices>) =>
      store.failPrices ? Promise.reject(new Error('QuotaExceededError')) : real.savePrices(...a),
  };
});
vi.mock('../src/persist/models', async (orig) => {
  const real = await orig<typeof import('../src/persist/models')>();
  return {
    ...real,
    withModels: (...a: Parameters<typeof real.withModels>) =>
      store.failModels ? Promise.reject(new Error('UnknownError')) : real.withModels(...a),
  };
});

type User = Awaited<ReturnType<typeof renderApp>>['user'];
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: () => Promise.resolve([]), ready: Promise.resolve() },
  });
  window.print = vi.fn();
  store.failPrices = false;
  store.failModels = false;
});
afterEach(() => vi.unstubAllGlobals());

async function chest(user: User) {
  await user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', {
      name: /Chest of drawers/,
    })[0],
  );
}
async function tab(user: User, name: RegExp) {
  await user.click(screen.getByRole('tab', { name }));
  return screen.getByRole('tabpanel');
}
async function project(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const dlg = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(dlg).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
  for (let i = 0; i < 2; i++) {
    await openSheet(user);
    await addPiece(user, /Base cabinet, doors: 1 door/);
  }
}

describe('ADR-260 output', () => {
  it('the printed Shopping list has no app-language word in Romanian print', async () => {
    const { user } = await renderApp(1280);
    await chest(user);
    const written: string[] = [];
    const fake = {
      document: { write: (s: string) => written.push(s), close() {} },
      focus() {},
      print() {},
    };
    window.open = vi.fn(() => fake) as never;
    const panel = await tab(user, /^Shopping/);
    await user.click(within(panel).getByRole('button', { name: /Print shopping list/ }));
    const text = written.join('').replace(/<[^>]+>/g, ' | ');
    expect(text).toMatch(/Estimare:/);
    expect(text).not.toMatch(/Estimate:| pcs | sheets /);
  });

  it('the Shopping list CSV name is cleaned like the parts CSV', async () => {
    const { user } = await renderApp(1280);
    await chest(user);
    const { useDesign } = await import('../src/store/designStore');
    useDesign.getState().load({ ...useDesign.getState().design, name: 'Kids/room: "chest"' });
    const names: string[] = [];
    URL.createObjectURL = (() => 'blob:x') as never;
    URL.revokeObjectURL = (() => {}) as never;
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      names.push(this.download);
    };
    const panel = await tab(user, /^Shopping/);
    await user.click(within(panel).getByRole('button', { name: /Shopping list CSV/ }));
    HTMLAnchorElement.prototype.click = orig;
    expect(names).toEqual(['kidsroom-chest-shopping.csv']);
  });

  it('a refused price import is said', async () => {
    const { user } = await renderApp(1280);
    await chest(user);
    store.failPrices = true;
    const panel = await tab(user, /^Shopping/);
    await user.click(within(panel).getByRole('button', { name: /^Prices$/ }));
    const input = panel.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(
      input,
      new File(['id;unit;amount\nboard:x;sheet;100\n'], 'p.csv', { type: 'text/csv' }),
    );
    expect(
      await within(panel).findByText('The prices could not be saved on this device.'),
    ).toBeTruthy();
  });

  it('a review pack that cannot read the models says why', async () => {
    const { user } = await renderApp(1280);
    await project(user);
    store.failModels = true;
    await user.click(screen.getByLabelText('More'));
    await user.click(screen.getByRole('button', { name: /Hand to a professional/ }));
    const dlg = await screen.findByRole('dialog', { name: 'Hand to a professional' });
    expect(await within(dlg).findByText(/^The pack could not be made:/)).toBeTruthy();
    expect(
      (within(dlg).getByRole('button', { name: /Download .zip/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("a project's cutting sheet parts list names the piece as its pieces table does", async () => {
    const { user } = await renderApp(1280);
    await project(user);
    const panel = await tab(user, /^Parts/);
    await user.click(within(panel).getByRole('button', { name: /^Print$/ }));
    const root = await printedSheet();
    const tables = within(root).getAllByRole('table', { hidden: true });
    const piece = within(tables[0]).getAllByRole('cell', { hidden: true })[0].textContent!;
    const part = within(tables[1]).getAllByRole('cell', { hidden: true })[0].textContent!;
    expect(part.startsWith(`${piece}:`)).toBe(true);
  });

  it('the Client sheet uses a render only of the piece or project it was made of', async () => {
    const { user } = await renderApp(1280);
    await chest(user);
    const { useUi } = await import('../src/store/uiStore');
    useUi.getState().setLastRender('blob:other', 'some-other-id');
    const panel = await tab(user, /^Parts/);
    await user.click(within(panel).getByRole('button', { name: 'Client sheet' }));
    await waitFor(() => expect(useUi.getState().printing).toBeTruthy());
    expect(useUi.getState().clientPicture).not.toBe('blob:other');
  });
});
