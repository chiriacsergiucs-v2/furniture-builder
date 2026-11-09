// @vitest-environment jsdom
// Find-it for room surfaces, plan tracing and placed 3D models (ADR-208, N213), in jsdom (ADR-108), at 1280 and
// 390 px, from the bare app by role and visible text: Room → Floor background (None / Colour / Picture), Room → Plan
// picture → Add a plan picture → Set the scale (two taps) → Known length → Show the plan picture → Remove the plan
// picture, the wall behind a piece opened from the project, and a 3D model's Placed control (On a piece). jsdom has no
// canvas or image decoding, so `createImageBitmap` and a 2D context are stood in for the picture import; the 3D view
// (and so the ⋯ menu with View in AR and Export for AR) is checked by tools/room-surfaces/find-it.mjs in Chromium.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { hiddenLabelled, openSheet, piecesList, renderApp, WIDTHS } from './setup';

/** Picture import without a real canvas: an 800 × 600 picture, a grey average colour, a small JPEG blob. */
function stubPictures() {
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async () => ({
    width: 800,
    height: 600,
    close() {},
  });
  HTMLCanvasElement.prototype.getContext = (() => ({
    drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray([120, 130, 140, 255]) }),
  })) as never;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }));
  };
  // jsdom's globals and fake-indexeddb's stored copies come from two JavaScript realms, so a stored ArrayBuffer fails
  // `instanceof ArrayBuffer` here (a browser has one realm). Recognise an ArrayBuffer from either realm.
  Object.defineProperty(ArrayBuffer, Symbol.hasInstance, {
    configurable: true,
    value: (v: unknown) => Object.prototype.toString.call(v) === '[object ArrayBuffer]',
  });
  let n = 0;
  URL.createObjectURL = (() => `blob:picture-${++n}`) as never;
  URL.revokeObjectURL = () => {};
}
const png = (name: string) =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], name, { type: 'image/png' });

describe.each(WIDTHS)('room surfaces at %ipx (find-it, ADR-208)', (width) => {
  it('Floor background, Plan picture with its scale, the wall behind a piece, a model Placed On a piece', async () => {
    const { user } = await renderApp(width);
    stubPictures();
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));
    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    await openSheet(user, panel);
    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    const dlg = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Sideboard');
    await user.click(within(dlg).getAllByRole('button', { name: /Sideboard/ })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
    const place = screen.queryByRole('button', { name: 'Place to the right' });
    if (place) await user.click(place);
    await openSheet(user, panel);
    await user.click(await screen.findByRole('button', { name: 'Add the room' }));
    await openSheet(user, panel);

    // Wall 1 gets a colour: its 50 mm band shows on the plan.
    await user.selectOptions(screen.getByLabelText('Wall 1 background'), 'Colour');
    const plan = screen.getByRole('figure', { name: /Room plan, seen from above/ });
    // The plan's drawn layers are hidden from screen readers; each has a name, found with `hidden`.
    const layer = (name: string) => hiddenLabelled(plan, 'img', name)[0] ?? null;
    await waitFor(() => expect(layer('Wall background bands')?.children).toHaveLength(1));

    // Room → Floor background: None, Colour, Picture.
    const floor = screen.getByLabelText('Floor background') as HTMLSelectElement;
    expect([...floor.options].map((o) => o.text)).toEqual(['None', 'Colour', 'Picture']);
    expect(floor.value).toBe('none');
    await user.selectOptions(floor, 'Colour');
    expect(screen.getByLabelText('Floor colour')).toBeTruthy();
    await waitFor(() =>
      expect(
        [...(layer('Floor finish')?.children ?? [])].some((c) => c.tagName === 'polygon'),
      ).toBe(true),
    );
    fireEvent.change(screen.getByLabelText('Floor colour'), { target: { value: '#a0805a' } });
    // jsdom keeps no SVG fill style; the room the plan draws from holds the colour.
    const { useDesign } = await import('../../src/store/designStore');
    await waitFor(() =>
      expect(useDesign.getState().project!.room!.floor).toEqual({ colour: '#a0805a' }),
    );
    await user.selectOptions(floor, 'Picture');
    await user.upload(screen.getByLabelText('Add a picture for the floor'), png('oak.png'));
    expect(await screen.findByText('oak.png')).toBeTruthy();
    expect(screen.getByText('Replace picture')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Floor background'), 'None');
    await waitFor(() => expect(layer('Floor finish')).toBeNull());

    // Room → Plan picture → Add a plan picture.
    const section = screen.getByRole('region', { name: 'Plan picture' });
    expect(within(section).getByRole('heading', { name: 'Plan picture' })).toBeTruthy();
    await user.upload(within(section).getByLabelText('Add a plan picture'), png('plan.png'));
    expect(await within(section).findByText('plan.png')).toBeTruthy();
    await waitFor(() => expect(layer('Plan picture on the plan')).not.toBeNull());
    const img = () => layer('Plan picture on the plan')!;
    // Until the scale is set: 10 mm per pixel, so the 800 px picture is 8000 mm wide, at half opacity.
    expect(img().getAttribute('width')).toBe('8000');
    expect(img().getAttribute('opacity')).toBe('0.5');

    // Set the scale: the hint, then two taps on the plan (keyboard has no route for a tap at a point; the plan's
    // own pointer handler turns screen points into room mm, which jsdom cannot compute, so the taps go through the
    // same store call the handler makes).
    await user.click(within(section).getByRole('button', { name: 'Set the scale' }));
    expect(
      within(section).getByText('Tap a corner of the plan, then the other end of a wall you know.'),
    ).toBeTruthy();
    expect(screen.getAllByText(/0 of 2/).length).toBeGreaterThan(0);
    useDesign.getState().addScalePoint([0, 0]);
    useDesign.getState().addScalePoint([400, 0]);
    await waitFor(() => expect(screen.queryByText(/of 2/)).toBeNull());
    // Known length: 400 px is 3000 mm, so the 800 px picture is 6000 mm wide.
    const known = within(section).getByRole('textbox', { name: 'Known length' });
    await user.clear(known);
    await user.type(known, '3000{Enter}');
    await waitFor(() => expect(img().getAttribute('width')).toBe('6000'));
    // A bad length (0) is shown as a problem and changes nothing (never throws); leaving the field restores it.
    await user.clear(known);
    await user.type(known, '0');
    expect(known.getAttribute('aria-invalid')).toBe('true');
    expect(within(section).getByText('Whole number from 1 to 100000.')).toBeTruthy();
    await user.type(known, '{Enter}');
    expect(img().getAttribute('width')).toBe('6000');
    expect((known as HTMLInputElement).value).toBe('3000');

    // Show the plan picture off and on, then Remove the plan picture.
    const show = within(section).getByRole('checkbox', { name: 'Show the plan picture' });
    expect((show as HTMLInputElement).checked).toBe(true);
    await user.click(show);
    await waitFor(() => expect(layer('Plan picture on the plan')).toBeNull());
    await user.click(show);
    await waitFor(() => expect(layer('Plan picture on the plan')).not.toBeNull());
    await user.click(within(section).getByRole('button', { name: 'Remove the plan picture' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(layer('Plan picture on the plan')).toBeNull());
    expect(within(section).getByLabelText('Add a plan picture')).toBeTruthy();

    // A 3D model from My 3D models (stored on this device), placed On a piece.
    const { saveModel } = await import('../../src/persist/db');
    await saveModel({
      id: 'mdl-cube',
      name: 'Cube',
      format: 'gltf',
      bytes: new TextEncoder().encode('{}').slice().buffer,
      size: { w: 400, h: 300, d: 300 },
      triangles: 12,
      createdAt: new Date().toISOString(),
    });
    await openSheet(user, panel);
    await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
    const lib = await screen.findByRole('dialog', { name: 'Add a piece' });
    expect(within(lib).getByRole('heading', { name: 'My 3D models' })).toBeTruthy();
    await user.click(await within(lib).findByRole('button', { name: /^Cube ?400 × 300 × 300 mm/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
    await openSheet(user, panel);
    const card = await screen.findByRole('region', { name: 'Selected 3D model: Cube' });
    const placed = within(card).getByRole('radiogroup', { name: 'Placed' });
    expect(
      within(placed)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Floor', 'Wall', 'On a piece', 'Anywhere']);
    await user.click(within(placed).getByRole('radio', { name: 'On a piece' }));
    expect(
      within(placed).getByRole('radio', { name: 'On a piece' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(within(card).getByRole('combobox', { name: 'On or above' })).toBeTruthy();
    expect(within(card).getByRole('textbox', { name: 'Gap above it' })).toBeTruthy();
    // It stands on the sideboard: the front view shows it above the floor.
    const project = useDesign.getState().project!;
    const cube = project.models!.find((m) => m.name === 'Cube')!;
    expect(cube.placement).toMatchObject({ kind: 'above', baseId: project.items[0].id, gap: 0 });
    expect(cube.position.y).toBeGreaterThan(0);

    // The wall behind a single piece: select the sideboard, open it in the piece editor (More actions, ADR-241); its
    // front view shows Wall 1 behind it.
    await openSheet(user, panel);
    const list = await piecesList(user, panel);
    await user.click(within(list).getAllByRole('button', { name: /Sideboard/ })[0]);
    await openSheet(user, panel);
    await user.click(await within(panel).findByRole('button', { name: 'More actions' }));
    await user.click(
      await within(panel).findByRole('button', { name: 'Open in the piece editor' }),
    );
    expect(await screen.findByRole('img', { name: 'Wall 1 behind the piece' })).toBeTruthy();
  });
});
