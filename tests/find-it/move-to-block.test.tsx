// @vitest-environment jsdom
// Find-it for Move to on a multi-selection (ADR-182, N185), in jsdom (ADR-108): a project with the room and two base
// cabinets away from the back wall → Select both → Selected pieces → Move to → To wall; both now stand at the wall,
// keeping their layout, and To wall is off with its reason. At 390 and 1280 px.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

type User = Awaited<ReturnType<typeof renderApp>>['user'];

async function addPiece(user: User, side: HTMLElement) {
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  await user.click(within(side).getByRole('button', { name: 'Add a piece' }));
  const list = await screen.findByRole('dialog', { name: 'Add a piece' });
  await user.click(within(list).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a piece' })).toBeNull());
  const place = screen.queryByRole('button', { name: 'Place to the right' });
  if (place) await user.click(place);
}
/** The selected piece's "From back" field. */
const fromBack = async () =>
  within(await screen.findByRole('region', { name: /^Selected piece: / })).getAllByLabelText(
    'From back',
  )[0] as HTMLInputElement;
async function selectRows(user: User, side: HTMLElement, multi: boolean, ...which: number[]) {
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  const sw = within(side).getByRole('checkbox', { name: 'Select' }) as HTMLInputElement;
  if (sw.checked !== multi) await user.click(sw);
  const rows = within(within(side).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
  if (!multi) return user.click(rows[which[0]]);
  for (let i = 0; i < rows.length; i++)
    if ((rows[i].getAttribute('aria-pressed') === 'true') !== which.includes(i))
      await user.click(rows[i]);
}

describe.each(WIDTHS)('Move to a selection at %ipx (find-it, ADR-182)', (width) => {
  it('select 2 pieces → Selected pieces → Move to → To wall moves both to the back wall', async () => {
    const { user } = await renderApp(width);
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
    // Two base cabinets, 500 and 800 mm from the back wall.
    for (const z of [500, 800]) {
      await addPiece(user, side);
      const f = await fromBack();
      await user.clear(f);
      await user.type(f, String(z));
      await user.tab();
      await waitFor(() => expect(f.value).toBe(String(z)));
    }

    await selectRows(user, side, true, 0, 1);
    const card = within(side).getByRole('region', { name: /^2 pieces selected/ });
    expect(within(card).getByText(/^Move to, as one block, from the front of /)).toBeTruthy();
    const moveTo = within(card).getByRole('group', { name: 'Move to' });
    await user.click(within(moveTo).getByRole('button', { name: 'To wall' }));
    // To wall is now off, with its reason, under "N more are off".
    await waitFor(() =>
      expect(within(moveTo).queryByRole('button', { name: 'To wall' })).toBeNull(),
    );
    expect(within(moveTo).getByText(/more are off/)).toBeTruthy();
    expect(within(moveTo).getByText(/Already touching wall/)).toBeTruthy();

    // Both moved by the same 500 mm: the first at the wall, the second still 300 mm ahead of it.
    await selectRows(user, side, false, 0);
    expect((await fromBack()).value).toBe('0');
    await selectRows(user, side, false, 1);
    expect((await fromBack()).value).toBe('300');
  });
});
