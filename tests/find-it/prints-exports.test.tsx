// @vitest-environment jsdom
// Find-it for ADR-206 (N211) in jsdom (ADR-108), from the bare app by role and visible text at 1280 and 390 px:
// Parts → Client sheet prints one page with the front view (no 3D still here), the piece and the estimate; the
// Assembly print without the 3D view says step pictures need it; Shopping → Product on a fastener line and on a run
// part line (the worktop), each priced by the seller; and formula functions in a variable (max with ";", a reserved
// name refused). The 3D parts (step pictures, Export scene (.glb), the SVG file, one A4 page) are checked by the
// browser script `tools/prints-exports/find-it.mjs`. No request leaves the test.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHONE_WIDTH, renderApp, WIDTHS } from './setup';

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
});
afterEach(() => vi.unstubAllGlobals());

async function chest(user: User) {
  await user.click(await screen.findByRole('button', { name: 'New single piece' }));
  const start = await screen.findByRole('dialog');
  await user.click(within(start).getAllByRole('button', { name: /Chest of drawers/ })[0]);
}

async function results(user: User, width: number, tab: RegExp) {
  if (width === PHONE_WIDTH) {
    const build = screen.queryByRole('radio', { name: /Build & Preview/ });
    if (build) await user.click(build);
  }
  await user.click(screen.getByRole('tab', { name: tab }));
  return screen.getByRole('tabpanel');
}

async function addPiece(user: User, name: RegExp) {
  const side = screen.getByRole('complementary', { name: 'Compose' });
  const peek = side.querySelector<HTMLButtonElement>('.sheet-peek');
  if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(side).getByRole('button', { name: 'Add a piece' }));
  const list = await screen.findByRole('dialog', { name: 'Add a piece' });
  await user.click(within(list).getAllByRole('button', { name })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}

/** Bare app → ⋯ › New… › Project with several pieces → Compose, with two base cabinets (a worktop over them). */
async function projectWithTwoBases(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const dlg = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(dlg).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
  await addPiece(user, /Base cabinet, doors: 1 door/);
  await addPiece(user, /Base cabinet, doors: 1 door/);
}

describe.each(WIDTHS)('prints, exports and seller matching at %ipx (find-it, ADR-206)', (width) => {
  it('Parts → Client sheet prints the name, the front view, the piece and the estimate with unpriced lines counted', async () => {
    const { user } = await renderApp(width);
    await chest(user);
    const panel = await results(user, width, /^Parts/);
    const button = within(panel).getByRole('button', { name: 'Client sheet' });
    expect(button.getAttribute('title')).toBe(
      'Print one page for your client: a picture, the pieces and the estimated price',
    );
    await user.click(button);
    await waitFor(() => expect(document.querySelector('.print-root')).not.toBeNull());
    await waitFor(() => expect(window.print).toHaveBeenCalled());
    const root = document.querySelector('.print-root')!;
    expect(root.querySelector('h1')?.textContent).toBe('Chest of drawers');
    expect(root.textContent).toContain('Fișă pentru client · ');
    // No render and no 3D view open: the front view is the picture.
    expect(root.querySelector('.pr-client-pic .pr-elev svg')).not.toBeNull();
    expect(root.querySelector('tbody td')?.textContent).toBe('Chest of drawers');
    expect(root.textContent).toMatch(/Preț estimat: \d/);
    expect(root.textContent).toMatch(/[1-9]\d* linii fără preț/);
  });

  it('Assembly → Print assembly steps without the 3D view says step pictures need it', async () => {
    const { user } = await renderApp(width);
    await chest(user);
    const panel = await results(user, width, /^Assembly/);
    await user.click(within(panel).getByRole('button', { name: 'Print assembly steps' }));
    await waitFor(() => expect(document.querySelector('.print-root')).not.toBeNull());
    expect(document.querySelector('.print-root')!.textContent).toContain(
      'Imaginile pașilor cer vizualizarea 3D',
    );
    expect(document.querySelectorAll('.print-root img.pr-step-pic')).toHaveLength(0);
  });

  it('Shopping → Product on a fastener line: picked, the line is bought from the seller', async () => {
    const { user } = await renderApp(width);
    await chest(user);
    const panel = await results(user, width, /^Shopping/);
    const product = await within(panel).findByRole('button', {
      name: /^Product for Joint fixings: \d+ joints — choose your fastener$/,
    });
    await user.click(product);
    const picker = await screen.findByRole('dialog', { name: /^Product for Joint fixings/ });
    await user.type(within(picker).getByRole('searchbox'), 'surub');
    const first = (await within(picker).findAllByRole('listitem', {}, { timeout: 15000 }))[0];
    const name = first.querySelector('strong, .name')?.textContent ?? '';
    await user.click(within(first).getByRole('button', { name: 'Use this' }));
    const note = await within(panel).findByText(/^Seller product: /);
    if (name) expect(note.textContent).toContain(name);
    // Linked, it leaves "to choose before buying" for Hardware and has its seller units per item.
    expect(
      await within(panel).findByRole('textbox', {
        name: /^Seller units per item for Joint fixings/,
      }),
    ).toBeTruthy();
    const row = note.closest('tr')!.previousElementSibling as HTMLElement;
    expect(row.closest('section')?.getAttribute('aria-label')).toBe('Hardware');
    expect(row.textContent).toMatch(/Joint fixings/);
    expect(within(row).getByText('seller price')).toBeTruthy();
  });

  it('Shopping → Product on the worktop (a run part): picked, it is priced by its product', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoBases(user);
    // Settings › Run parts › Suggest run parts: a worktop over the two base cabinets.
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    const runParts = within(settings).getByRole('region', { name: 'Run parts' });
    await user.click(within(runParts).getByRole('button', { name: 'Suggest run parts' }));
    await waitFor(() => expect(within(runParts).getByText(/^Worktop/)).toBeTruthy());
    await user.click(within(settings).getByRole('button', { name: 'Done' }));
    const panel = await results(user, width, /^Shopping/);
    const product = (
      await within(panel).findAllByRole('button', { name: /^Product for Worktop/ })
    ).find((b) => !/fixings/.test(b.getAttribute('aria-label')!))!;
    // Before a product: the worktop is counted with its board.
    const row = product.closest('tr')!.previousElementSibling as HTMLElement;
    expect(row.textContent).toMatch(/counted under Boards/);
    expect(row.textContent).toMatch(/with its board/);
    await user.click(product);
    const picker = await screen.findByRole('dialog', { name: product.getAttribute('aria-label')! });
    expect(
      within(picker).getByText(
        'Boards and worktops first. A product priced per piece or per metre prices this part instead of its board.',
      ),
    ).toBeTruthy();
    const first = (await within(picker).findAllByRole('listitem', {}, { timeout: 15000 }))[0];
    expect(first.textContent).toMatch(/blat/i);
    await user.click(within(first).getByRole('button', { name: 'Use this' }));
    await waitFor(() => expect(row.textContent).toMatch(/priced by its product/), {
      timeout: 15000,
    });
    expect(within(row).getByText('seller price')).toBeTruthy();
    expect(within(panel).getByText(/^Seller product: blat/i)).toBeTruthy();
  });

  it('Settings › Variables: formula functions evaluate; a function name is refused for a variable', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoBases(user);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    await user.type(within(settings).getByLabelText('New variable'), 'door width');
    await user.type(
      within(settings).getByLabelText('Value or formula'),
      'max(400; 450) + round(2.4)',
    );
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    expect(await within(settings).findByText('452 mm')).toBeTruthy();

    await user.type(within(settings).getByLabelText('New variable'), 'half');
    await user.type(within(settings).getByLabelText('Value or formula'), 'floor(door width / 3)');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    expect(await within(settings).findByText(/^150\.67 → 150 mm$|^150 mm$/)).toBeTruthy();

    await user.type(within(settings).getByLabelText('New variable'), 'bad');
    await user.type(within(settings).getByLabelText('Value or formula'), 'min(4)');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    expect(
      (await within(settings).findAllByRole('alert')).some((a) =>
        /“min” takes at least 2 values\./.test(a.textContent ?? ''),
      ),
    ).toBe(true);

    await user.type(within(settings).getByLabelText('New variable'), 'round');
    await user.type(within(settings).getByLabelText('Value or formula'), '10');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));
    expect(
      (await within(settings).findAllByRole('alert')).some(
        (a) => a.textContent === '“round” is the name of a formula function; pick another name.',
      ),
    ).toBe(true);
    expect(within(settings).queryByLabelText('Value of round')).toBeNull();
  });
});
