// @vitest-environment jsdom
// Find-it for connections (ADR-168, N171), in jsdom (ADR-108): base units standing side by side → Select two →
// Connected → on; one selected says "Connected to …"; a pair that does not touch has the toggle off, disabled, with
// the reason; Checks warns when a connected pair is parted. The drags are the browser script
// (tools/connections/find-it.mjs). ADR-179: the room front view shows the same tick at the seam.
// One click path per width (ADR-201, G-370): connectionCheck, the parted-pair warning and connectionSeams are proven
// in tests/connections.test.ts; this path finds each feature by its visible text.
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
async function selectRows(user: User, side: HTMLElement, ...which: number[]) {
  const all = within(side).queryByRole('button', { name: /^All pieces \(\d+\)$/ });
  if (all) await user.click(all);
  const sw = within(side).getByRole('checkbox', { name: 'Select' }) as HTMLInputElement;
  if (!sw.checked) await user.click(sw);
  const rows = within(within(side).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
  for (let i = 0; i < rows.length; i++)
    if ((rows[i].getAttribute('aria-pressed') === 'true') !== which.includes(i))
      await user.click(rows[i]);
}

describe.each(WIDTHS)('connections at %ipx (find-it, ADR-168)', (width) => {
  it('three base units → Select two → Connected on; one tick at the seam, plan and front; Connected to …; a parted pair is off with the reason and warned', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByLabelText('More'));
    await user.click(await screen.findByRole('button', { name: /New…/ }));
    const start = await screen.findByRole('dialog', { name: 'Start something new' });
    await user.click(within(start).getByRole('button', { name: /Project with several pieces/ }));
    await user.click(await screen.findByRole('radio', { name: 'Compose' }));
    const side = screen.getByRole('complementary', { name: 'Compose' });
    await addPiece(user, side);
    await addPiece(user, side);
    await addPiece(user, side);
    const front = () => screen.getByRole('figure', { name: /^Room seen from the front/ });
    expect(front().querySelectorAll('.front-connections line')).toHaveLength(0);

    await selectRows(user, side, 0, 1);
    const card = within(side).getByRole('region', { name: /^2 pieces selected/ });
    const connected = within(card).getByRole('checkbox', { name: 'Connected' }) as HTMLInputElement;
    expect(connected.disabled).toBe(false);
    expect(connected.checked).toBe(false);
    await user.click(connected);
    await waitFor(() => expect(connected.checked).toBe(true));

    // ADR-179: one tick on the plan and the same tick in the room front view, across the seam: horizontal, centred
    // on the first piece's right edge, at the middle of its height, hidden from screen readers.
    const plan = screen.getByRole('figure', { name: /Room plan, seen from above/ });
    await waitFor(() => expect(plan.querySelectorAll('.plan-connections line')).toHaveLength(1));
    const ticks = front().querySelectorAll('.front-connections line');
    expect(ticks).toHaveLength(1);
    const first = front().querySelectorAll('rect.front-hit')[0];
    const edge = Number(first.getAttribute('x')) + Number(first.getAttribute('width'));
    const top = Number(first.getAttribute('y')),
      h = Number(first.getAttribute('height'));
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(ticks[0].getAttribute(k)));
    expect(y1).toBe(y2);
    expect((x1 + x2) / 2).toBeCloseTo(edge, 6);
    expect(y1).toBeCloseTo(top + h / 2, 6);
    expect(ticks[0].closest('[aria-hidden="true"]')).not.toBeNull();

    // One selected: "Connected to …" under Position.
    const sw = within(side).getByRole('checkbox', { name: 'Select' });
    await user.click(sw);
    const rows = within(within(side).getByRole('list', { name: 'Pieces' })).getAllByRole('button');
    await user.click(rows[0]);
    expect(await within(side).findByText(/^Connected to Base cabinet/)).toBeTruthy();

    // The first and the third do not touch: off, disabled, with the reason.
    await selectRows(user, side, 0, 2);
    const apart = within(side).getByRole('region', { name: /^2 pieces selected/ });
    const toggle = within(apart).getByRole('checkbox', { name: 'Connected' }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(true);
    // ADR-207 names every kind a pair can be joined as.
    expect(
      within(apart).getByText(/are not side by side, in a corner or one over the other/),
    ).toBeTruthy();

    // Part the connected pair by typing: Checks warns, never an error.
    await user.click(sw);
    await user.click(rows[1]);
    const one = await screen.findByRole('region', { name: /^Selected piece: / });
    const left = within(one).getByLabelText('From left') as HTMLInputElement;
    await user.clear(left);
    await user.type(left, '900');
    await user.tab();
    await user.click(screen.getByRole('tab', { name: /^Checks/ }));
    expect(await screen.findByText(/are connected but no longer joined/)).toBeTruthy();
  });
});
