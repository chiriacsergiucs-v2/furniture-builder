// @vitest-environment jsdom
// Find-it for ADR-124 (N125) in jsdom (ADR-108): design codes, project settings, own edits kept on Replace — from the
// bare app, by role and visible text, at desktop and phone widths.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

/** Bare app → ⋯ › New… › Project with several pieces → Compose, with two base cabinets. */
async function projectWithTwoPieces(user: User) {
  await user.click(screen.getByLabelText('More'));
  await user.click(await screen.findByRole('button', { name: /New…/ }));
  const dlg = await screen.findByRole('dialog', { name: 'Start something new' });
  await user.click(within(dlg).getByRole('button', { name: /Project with several pieces/ }));
  await user.click(await screen.findByRole('radio', { name: 'Compose' }));
  for (let i = 0; i < 2; i++) {
    await user.click(await screen.findByRole('button', { name: 'Add a piece' }));
    const list = await screen.findByRole('dialog', { name: 'Add a piece' });
    await user.click(within(list).getAllByRole('button', { name: /Base cabinet, doors/ })[0]);
  }
}

describe.each(WIDTHS)('ADR-124 at %ipx (find-it)', (width) => {
  it('Projects › Open from code: a wrong code is a message', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Open from code' }));
    const dlg = await screen.findByRole('dialog', { name: 'Open a code' });
    await user.type(within(dlg).getByLabelText('Code or link'), 'not a code');
    await user.click(within(dlg).getByRole('button', { name: 'Open' }));
    expect((await within(dlg).findByRole('alert')).textContent).toMatch(/not a design code/);
  });

  it('Settings › Project settings › Handle; the piece Follows project; Replace says Kept:', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings: / });
    expect(within(settings).getByRole('heading', { name: 'Project settings' })).toBeTruthy();
    await user.selectOptions(within(settings).getByLabelText('Handle'), 'knob');
    expect(within(settings).getByText(/Handle: applied to 2 pieces/)).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Done' }));

    const card = await screen.findByRole('region', { name: /^Selected piece: / });
    await user.click(within(card).getByText('Project settings'));
    expect(within(card).getByText(/Follows project/)).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: 'More actions' }));
    await user.click(within(card).getByRole('button', { name: 'Replace…' }));
    const rep = await screen.findByRole('dialog', { name: /^Replace / });
    await user.click(within(rep).getAllByRole('button', { name: /Base cabinet, drawers/ })[0]);
    const confirm = screen.queryByRole('button', { name: 'Replace' });
    if (confirm) await user.click(confirm);
    expect(await screen.findByText(/Kept: /)).toBeTruthy();
  });

  it('⋯ › Copy code › the code opens again from Projects › Open from code', async () => {
    const { user } = await renderApp(width);
    await projectWithTwoPieces(user);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /Copy code/ }));
    const dlg = await screen.findByRole('dialog', { name: /^Code for / });
    // The code is made asynchronously (CompressionStream): its box appears when it is ready.
    const code = (await within(dlg).findByLabelText(
      'Code',
      {},
      { timeout: 5000 },
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(code.value.startsWith('FB1-')).toBe(true));
    expect((within(dlg).getByLabelText('Link') as HTMLTextAreaElement).value).toContain(
      '#open=FB1-',
    );
    expect(within(dlg).getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Copy link' })).toBeTruthy();
    const text = code.value;
    await user.click(within(dlg).getByRole('button', { name: 'Done' }));

    await user.click(
      screen
        .getAllByRole('link', { name: 'Projects' })
        .concat(screen.queryAllByRole('button', { name: 'Projects' }))[0],
    );
    await user.click(await screen.findByRole('button', { name: 'Open from code' }));
    const open = await screen.findByRole('dialog', { name: 'Open a code' });
    await user.click(within(open).getByLabelText('Code or link'));
    await user.paste(text);
    await user.click(within(open).getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Open a code' })).toBeNull());
    expect((await screen.findAllByText(/Base cabinet, 1 door/)).length).toBeGreaterThan(0);
  });
});
