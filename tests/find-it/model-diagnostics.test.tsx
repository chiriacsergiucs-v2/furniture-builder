// @vitest-environment jsdom
// Find-it for ADR-196 (build only what the user set), in jsdom (ADR-108): from the bare app, a lift-up flap's handle
// defaults to "Near the bottom" and a drop-down flap's to "Near the top", an explicit position wins; adjustable
// shelves in an L-corner's open wing and in a diagonal corner say why they cannot rest on pins; a chair with more back
// slats than fit says how many fit instead of building fewer.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** New single piece › a catalog item › Compose › the Inspector's "Edit the …" button for one space. */
async function composeSpace(user: User, item: RegExp, edit: RegExp, selected: string) {
  await user.click(await screen.findByRole('button', { name: 'New single piece' }));
  const picker = await screen.findByRole('dialog');
  await user.click(within(picker).getAllByRole('button', { name: item })[0]);
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
  await user.click(screen.getByRole('button', { name: edit }));
  expect(screen.getByText(selected)).toBeTruthy();
}

const shown = (label: string) =>
  (screen.getByRole('combobox', { name: label }) as HTMLSelectElement).selectedOptions[0]
    .textContent;

/** Results › Checks lists every diagnostic of the piece. */
async function checks(user: User) {
  const results = screen.getByRole('region', { name: 'Results' });
  await user.click(within(results).getByRole('tab', { name: /^Checks/ }));
  return results;
}

describe.each(WIDTHS)('model diagnostics at %ipx (find-it, ADR-196)', (width) => {
  it('Base cabinet › Edit the interior › Flap › Bar › Position follows the flap; an explicit position wins', async () => {
    const { user } = await renderApp(width);
    await composeSpace(
      user,
      /^Base cabinet, doors: 1 door \+ shelf/,
      /^Edit the interior/,
      'Selected: Interior',
    );
    const front = screen.getByRole('radiogroup', { name: 'Front' });
    await user.click(within(front).getByRole('radio', { name: 'Flap' }));
    const handles = screen.getByRole('radiogroup', { name: 'Handles on the doors' });
    await user.click(within(handles).getByRole('radio', { name: 'Bar' }));
    // A lift-up flap hinges at its top: the bar goes near its free (bottom) edge.
    expect(shown('Position')).toBe('Near the bottom');
    const opens = screen.getByRole('radiogroup', { name: 'Opens' });
    await user.click(within(opens).getByRole('radio', { name: 'Drops down' }));
    expect(shown('Position')).toBe('Near the top');
    // An explicit position wins over the default.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Position' }), 'Middle');
    await user.click(within(opens).getByRole('radio', { name: 'Lifts up' }));
    expect(shown('Position')).toBe('Middle');
  });

  it('L corner › Edit the side-wall wing › Adjustable, on shelf pins › the wing has no side at the corner', async () => {
    const { user } = await renderApp(width);
    await composeSpace(
      user,
      /^L corner: Base L, folding doors/,
      /^Edit the side-wall wing/,
      'Selected: Side-wall wing',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Adjustable, on shelf pins' }));
    const text =
      'The side-wall wing has no side at the corner, so its shelves cannot rest on pins; make them fixed.';
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(within(await checks(user)).getAllByText(text).length).toBeGreaterThan(0);
  });

  it('L corner › Diagonal front › Bar handle in Hardware › Adjustable › no straight sides for shelf pins', async () => {
    const { user } = await renderApp(width);
    await composeSpace(
      user,
      /^L corner: Diagonal front/,
      /^Edit the interior/,
      'Selected: Interior',
    );
    const handles = screen.getByRole('radiogroup', { name: 'Handles on the doors' });
    await user.click(within(handles).getByRole('radio', { name: 'Bar' }));
    const results = screen.getByRole('region', { name: 'Results' });
    await user.click(within(results).getByRole('tab', { name: /^Hardware/ }));
    expect(within(results).getAllByText(/Bar handle, 128 mm centres/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('checkbox', { name: 'Adjustable, on shelf pins' }));
    const text = 'A diagonal corner has no straight sides for shelf pins; make the shelves fixed.';
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(within(await checks(user)).getAllByText(text).length).toBeGreaterThan(0);
  });

  it('Chest of drawers › Drawer heights › Choose › Drawer 1 fixed at 100 › names front, slot, clearance and the front that fits', async () => {
    const { user } = await renderApp(width);
    await composeSpace(
      user,
      /^Chest of drawers: 4 drawers/,
      /^Edit the interior/,
      'Selected: Interior',
    );
    const heights = screen.getByRole('radiogroup', { name: 'Drawer heights' });
    await user.click(within(heights).getByRole('radio', { name: 'Choose' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Drawer 1 sizing' }), 'Fixed');
    const field = screen.getByRole('textbox', { name: 'Drawer 1 front height in mm' });
    await user.clear(field);
    await user.type(field, '100{Enter}');
    const text =
      /^Drawer 1 box would be only \d+ mm high \(front 100, slot \d+, clearance \d+ mm\); give it a front of at least \d+ mm\.$/;
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(within(await checks(user)).getAllByText(text).length).toBeGreaterThan(0);
  });

  it('Base cabinet › V. dividers › both parts fixed too wide › names asked, room, divider and inside width', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(
      within(picker).getAllByRole('button', { name: /^Base cabinet, doors: 2 doors \+ shelf/ })[0],
    );
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    // Tap the space (Enter runs the same tap, ADR-108); its quick counts add a vertical divider.
    screen.getByRole('button', { name: /space, \d+ by \d+ mm$/ }).focus();
    await user.keyboard('{Enter}');
    const card = await screen.findByRole('group', { name: 'Quick counts' });
    await user.click(within(card).getByRole('button', { name: 'More vertical dividers' }));
    await user.click(screen.getByRole('button', { name: /^Edit the interior/ }));
    for (const side of ['Left', 'Right']) {
      await user.selectOptions(screen.getByRole('combobox', { name: `${side} sizing` }), 'Fixed');
      const field = screen.getByRole('textbox', { name: `${side} width in mm` });
      await user.clear(field);
      await user.type(field, '500{Enter}');
    }
    const text =
      /^Parts need 1000 mm but \d+ mm is left after 1 divider of \d+ mm \(\d+ mm inside\)\.$/;
    expect(within(await checks(user)).getAllByText(text).length).toBeGreaterThan(0);
  });

  it('Base cabinet › Inset fronts › a 5 mm part with a door › the gap leaves no room for fronts', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(
      within(picker).getAllByRole('button', { name: /^Base cabinet, doors: 1 door \+ shelf/ })[0],
    );
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    const style = within(settings).getByRole('radiogroup', { name: 'Doors and drawer fronts' });
    await user.click(within(style).getByRole('radio', { name: 'Inset' }));
    await user.click(within(settings).getByRole('button', { name: 'Done' }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    // The door comes off the whole interior, which is then divided; the narrow left part gets its own door.
    await user.click(screen.getByRole('button', { name: /^Edit the interior/ }));
    const front = screen.getByRole('radiogroup', { name: 'Front' });
    await user.click(within(front).getByRole('radio', { name: 'None' }));
    screen.getByRole('button', { name: /space, \d+ by \d+ mm$/ }).focus();
    await user.keyboard('{Enter}');
    const card = await screen.findByRole('group', { name: 'Quick counts' });
    await user.click(within(card).getByRole('button', { name: 'More vertical dividers' }));
    await user.click(screen.getByRole('button', { name: /^Edit the interior/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Left sizing' }), 'Fixed');
    const field = screen.getByRole('textbox', { name: 'Left width in mm' });
    await user.clear(field);
    await user.type(field, '5{Enter}');
    await user.click(screen.getByRole('button', { name: 'Left' }));
    const leftFront = screen.getByRole('radiogroup', { name: 'Front' });
    await user.click(within(leftFront).getByRole('radio', { name: 'Door' }));
    const text = /^The 3 mm gap leaves no room for fronts on 5×\d+ mm\.$/;
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(within(await checks(user)).getAllByText(text).length).toBeGreaterThan(0);
  });

  it('Chair › Settings › Back slats up to 10 › Checks says at most 6 fit', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const picker = await screen.findByRole('dialog');
    await user.click(
      within(picker).getAllByRole('button', { name: /^Chair: Vertical slatted/ })[0],
    );
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    const more = within(settings).getByRole('button', { name: 'More back slats' });
    for (let i = 0; i < 6; i++) await user.click(more);
    await user.click(within(settings).getByRole('button', { name: 'Done' }));
    expect(
      within(await checks(user)).getAllByText(
        '10 back slats of 40 mm do not fit between the posts (370 mm); at most 6 fit.',
      ).length,
    ).toBeGreaterThan(0);
  });
});
