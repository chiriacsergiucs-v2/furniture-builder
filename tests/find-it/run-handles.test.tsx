// @vitest-environment jsdom
// Find-it for handles for a run and sinks (ADR-125, N126), in jsdom (ADR-108): bare app → new project → three base
// cabinets → Settings › Run parts → "Handles for this run…" with a line height, "Add sink…" with a cut-out size; both
// listed in Run parts, and the sink is a line in the shopping list.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('run handles and sinks at %ipx (find-it, ADR-125)', (width) => {
  it('bare app → three base cabinets → Settings › Run parts → handles and a sink', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    const create = await screen.findByRole('dialog');
    await user.type(within(create).getByRole('textbox'), 'Handles test');
    await user.click(within(create).getByRole('button', { name: 'Create project' }));

    const panel = await screen.findByRole('complementary', { name: 'Compose' });
    const peek = panel.querySelector<HTMLButtonElement>('.sheet-peek');
    if (peek?.getAttribute('aria-expanded') === 'false') await user.click(peek);
    for (let i = 0; i < 3; i++) {
      await user.click(within(panel).getByRole('button', { name: 'Add a piece' }));
      const dlg = await screen.findByRole('dialog');
      await user.type(within(dlg).getByRole('searchbox', { name: 'Search the items' }), 'Base');
      await user.click(
        within(dlg).getAllByRole('button', { name: /Base cabinet, doors: 1 door/ })[0],
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const right = screen.queryByRole('button', { name: 'Place to the right' });
      if (right) await user.click(right);
    }

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog');
    const runParts = within(settings).getByRole('region', { name: 'Run parts' });
    await user.click(within(runParts).getByRole('button', { name: /Suggest run parts/ }));

    // Handles for this run: a bar on a line 800 mm above the floor.
    await user.click(within(runParts).getByRole('button', { name: 'Handles for this run…' }));
    const hg = within(runParts).getByRole('group', { name: 'Handles for this run' });
    expect(within(hg).getByRole('radio', { name: 'Top of fronts' })).toBeTruthy();
    const add = within(hg).getByRole('button', { name: 'Add handles' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true); // no default height
    await user.type(within(hg).getByLabelText('Line height above the floor'), '800');
    await user.click(add);
    expect(within(runParts).getByText('Handles for this run', { selector: 'strong' })).toBeTruthy();
    expect(within(runParts).getByText(/line 800 mm above the floor/)).toBeTruthy();
    expect(within(runParts).getByRole('group', { name: 'Keeps its own handles' })).toBeTruthy();

    // Sink: a 500 × 400 cut-out over a base unit.
    await user.click(within(runParts).getByRole('button', { name: 'Add sink…' }));
    const sg = within(runParts).getByRole('group', { name: 'Sink over a base unit' });
    await user.type(within(sg).getByLabelText('Cut-out width'), '500');
    await user.type(within(sg).getByLabelText('Cut-out depth'), '400');
    await user.click(within(sg).getByRole('button', { name: 'Add sink' }));
    expect(within(runParts).getByText(/^Sink over /)).toBeTruthy();
    expect(within(runParts).getByText('cut-out 500 × 400')).toBeTruthy();
  });
});
