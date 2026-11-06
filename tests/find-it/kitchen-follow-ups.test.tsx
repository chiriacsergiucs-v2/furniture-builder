// @vitest-environment jsdom
// Find-it for ADR-209 (N214) in jsdom (ADR-108): from the bare app, by role and visible text, at desktop and phone
// widths — Settings › Run parts: Add trim… with a Moulding profile, a Ceiling filler, the worktop's Edge profile, the ƒ
// button by the overhangs, a sink's From left / From front; Settings › Fasteners with "From each end (mm)"; Parts
// shows "Guidance: drilling positions from your values". The 3D drawing (sections, holes, edges, the problem box) is
// checked by the browser script `tools/kitchen-follow-ups/find-it.mjs` (Acceptance: browser).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** Bare app → ⋯ › New… › Project with several pieces → Compose, with a room, two base and two wall cabinets. */
async function kitchen(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const start = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
  const side = screen.getByRole('complementary', { name: 'Compose' });
  await user.click(
    within(within(side).getByRole('region', { name: 'Room' })).getByRole('button', {
      name: 'Add the room',
    }),
  );
  for (const what of [
    /Base cabinet, doors/,
    /Base cabinet, doors/,
    /Wall cabinet/,
    /Wall cabinet/,
  ]) {
    await user.click(await screen.findByRole('button', { name: 'Add a piece' }));
    const list = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.click(within(list).getAllByRole('button', { name: what })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
    const right = screen.queryByRole('button', { name: 'Place to the right' });
    if (right) await user.click(right);
  }
}

describe.each(WIDTHS)('ADR-209 kitchen run follow-ups at %ipx (find-it)', (width) => {
  it('Run parts: moulding profile, ceiling filler, edge profile, ƒ by the overhangs, From left / From front; Fasteners; drilling guidance in Parts', async () => {
    const { user } = await renderApp(width);
    await kitchen(user);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });

    // A variable for the overhang.
    await user.type(within(settings).getByLabelText('New variable'), 'lip');
    await user.type(within(settings).getByLabelText('Value or formula'), '30');
    await user.click(within(settings).getByRole('button', { name: 'Add variable' }));

    const runParts = within(settings).getByRole('region', { name: 'Run parts' });
    await user.click(within(runParts).getByRole('button', { name: /Suggest run parts/ }));
    const list = () => runParts.querySelector<HTMLElement>('ul.run-list')!;
    const rowWith = (re: RegExp) =>
      [...list().querySelectorAll<HTMLElement>(':scope > li')].find((li) =>
        re.test(li.textContent ?? ''),
      )!;

    // Add trim… → Crown → Moulding profile typed: the strip takes the profile's size, no height needed.
    await user.click(within(runParts).getByRole('button', { name: 'Add trim…' }));
    const trim = within(runParts).getByRole('group', { name: 'Add a trim' });
    await user.click(within(trim).getByRole('radio', { name: 'Crown' }));
    for (const box of within(trim).getAllByRole('checkbox')) await user.click(box);
    const profile = within(trim).getByLabelText('Moulding profile');
    expect(
      within(trim).getByText('Optional: without a profile the trim is a plain strip.'),
    ).toBeTruthy();
    expect(within(trim).getByRole('img', { name: /Moulding profile drawing/ })).toBeTruthy();
    await user.type(profile, '0,0; 20,0; 20,45; 0,60');
    await user.tab();
    expect(within(trim).getByText('Profile 20 × 60 mm: the strip takes this size.')).toBeTruthy();
    await user.click(within(trim).getByRole('button', { name: 'Add trim' }));
    await waitFor(() => expect(rowWith(/Crown/)).toBeTruthy());
    expect(rowWith(/Crown/).textContent).toMatch(/× 60 × 20/);
    expect(
      within(rowWith(/Crown/)).getByRole('button', { name: 'Profile 20 × 60 mm' }),
    ).toBeTruthy();

    // A crossing profile shows the error by the field.
    await user.click(within(runParts).getByRole('button', { name: 'Add trim…' }));
    const trim2 = within(runParts).getByRole('group', { name: 'Add a trim' });
    await user.click(within(trim2).getByRole('radio', { name: 'Pelmet' }));
    await user.type(within(trim2).getByLabelText('Moulding profile'), '0,0; 20,20; 20,0; 0,20');
    await user.tab();
    expect(
      within(trim2).getByText('The profile crosses itself or has fewer than three points.'),
    ).toBeTruthy();

    // The ceiling-filler path: the room has a height, so it closes the gap up to it.
    await user.click(within(trim2).getByRole('radio', { name: 'Ceiling filler' }));
    expect(
      within(trim2).getByText(/^From the top of the units up to the room height/),
    ).toBeTruthy();
    for (const box of within(trim2).getAllByRole('checkbox')) await user.click(box);
    await user.click(within(trim2).getByRole('button', { name: 'Add trim' }));
    await waitFor(() => expect(rowWith(/Ceiling filler/)).toBeTruthy());

    // The worktop: Edge profile (Square, Rounded, Bevelled) with a typed Edge size.
    const worktop = rowWith(/Worktop/);
    const edge = within(worktop).getByRole('radiogroup', { name: 'Edge profile' });
    for (const k of ['Square', 'Rounded', 'Bevelled'])
      expect(within(edge).getByRole('radio', { name: k })).toBeTruthy();
    expect(within(worktop).queryByLabelText('Edge size (mm)')).toBeNull();
    await user.click(within(edge).getByRole('radio', { name: 'Rounded' }));
    const size = within(rowWith(/Worktop/)).getByLabelText('Edge size (mm)');
    expect(
      within(rowWith(/Worktop/)).getByText('The radius of the front edge; there is no default.'),
    ).toBeTruthy();
    await user.type(size, '10');
    await user.tab();

    // ƒ next to each overhang: bind the front overhang to "lip".
    await user.click(
      within(rowWith(/Worktop/)).getByRole('button', { name: /^Overhang: 20 mm front/ }),
    );
    expect(
      within(rowWith(/Worktop/)).getByRole('button', {
        name: 'Bind Side overhang to a variable',
      }),
    ).toBeTruthy();
    await user.click(
      within(rowWith(/Worktop/)).getByRole('button', {
        name: 'Bind Front overhang to a variable',
      }),
    );
    const bind = await screen.findByRole('dialog', { name: 'Bind Front overhang' });
    await user.click(within(bind).getByRole('button', { name: /^lip = 30/ }));
    await user.click(within(bind).getByRole('button', { name: 'Bind' }));
    await waitFor(() => expect(within(rowWith(/Worktop/)).getByText('lip = 30')).toBeTruthy());
    expect(rowWith(/Worktop/).textContent).toMatch(/overhang 30 mm front/);

    // A sink: From left and From front, empty = centred.
    await user.click(within(runParts).getByRole('button', { name: 'Add sink…' }));
    const sg = within(runParts).getByRole('group', { name: 'Sink over a base unit' });
    await user.type(within(sg).getByLabelText('Cut-out width'), '500');
    await user.type(within(sg).getByLabelText('Cut-out depth'), '400');
    await user.click(within(sg).getByRole('button', { name: 'Add sink' }));
    const left = await within(runParts).findByLabelText('From left');
    const front = within(runParts).getByLabelText('From front');
    expect((left as HTMLInputElement).placeholder).toBe('centred');
    expect(within(runParts).getAllByText('Empty = centred.').length).toBe(2);
    await user.type(left, '40');
    await user.tab();
    await user.type(front, '60');
    await user.tab();
    await waitFor(() =>
      expect((within(runParts).getByLabelText('From left') as HTMLInputElement).value).toBe('40'),
    );

    // Fasteners in project Settings: the edge distance for carcass joints, labelled guidance.
    const fasteners = within(settings).getByText('Fasteners', { selector: 'summary' });
    await user.click(fasteners);
    expect((fasteners.parentElement as HTMLDetailsElement).open).toBe(true);
    expect(within(settings).getByText(/\d+ joints? here · guidance:/)).toBeTruthy();
    await user.type(
      within(settings).getByLabelText('Carcass joint: your fastener'),
      'Confirmat 7×50',
    );
    await user.tab();
    const edgeField = within(settings).getByLabelText('From each end (mm)');
    expect(
      within(settings).getByText(
        'Guidance: with your fastener named and this typed, Parts shows drilling positions from your values. No diameter, depth or screw is given.',
      ),
    ).toBeTruthy();
    await user.type(edgeField, '50');
    await user.tab();
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    // Build & Preview › Parts: the notes and the drilling guidance.
    await user.click(screen.getByRole('radio', { name: /Build & Preview/ }));
    const partsTab = screen.queryByRole('tab', { name: /^Parts/ });
    if (partsTab && partsTab.getAttribute('aria-selected') !== 'true') await user.click(partsTab);
    await waitFor(() =>
      expect(
        screen.getAllByText('Guidance: drilling positions from your values').length,
      ).toBeGreaterThan(0),
    );
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/rounded edge R10 mm/);
    expect(body).toMatch(/profile 20 × 60 mm, drawn by you/);
    expect(body).toMatch(/sink cut-out 500 × 400 mm at 40 mm from left and 60 mm from front/);
    expect(body).toMatch(/fixing holes at .* mm, guidance from your values/);
    expect(body).toContain('Run: Ceiling filler');
  });
});
