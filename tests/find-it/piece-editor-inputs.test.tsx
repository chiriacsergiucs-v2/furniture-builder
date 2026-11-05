// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { renderApp, WIDTHS } from './setup';

async function piece(width: number) {
  const app = await renderApp(width);
  await app.user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await app.user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
  );
  await app.user.click(screen.getByRole('radio', { name: 'Compose' }));
  const { useDesign } = await import('../../src/store/designStore');
  return { ...app, useDesign };
}

describe.each(WIDTHS)('piece editor inputs at %ipx (ADR-199)', (width) => {
  it('bare app → Sideboard → split and drawers: invalid text is explained; Enter commits once and Escape cancels', async () => {
    const { user, useDesign } = await piece(width);
    await user.click(screen.getByRole('button', { name: /Edit the interior/ }));
    const share = screen.getByRole('textbox', { name: 'Left share' });
    const before = useDesign.getState().design;
    for (const invalid of ['abc', 'Infinity', '0', '1000', '-1']) {
      await user.clear(share);
      await user.type(share, invalid);
      await user.tab();
      expect(share.getAttribute('aria-invalid')).toBe('true');
      expect(
        screen.getByText('Enter a finite share greater than 0 and less than 1000.'),
      ).toBeTruthy();
      expect(useDesign.getState().design).toBe(before);
    }
    const past = useDesign.getState().past.length;
    await user.clear(share);
    await user.type(share, '2{Enter}');
    expect(useDesign.getState().past.length).toBe(past + 1);
    const saved = useDesign.getState().design;
    await user.click(share);
    await user.clear(share);
    await user.type(share, 'bad{Escape}');
    expect((share as HTMLInputElement).value).toBe('2');
    expect(share.getAttribute('aria-invalid')).toBe('false');
    expect(useDesign.getState().design).toBe(saved);
    await user.click(screen.getByRole('button', { name: 'Middle' }));
    await user.click(screen.getByRole('radio', { name: 'Choose' }));
    const drawer = screen.getByRole('textbox', { name: 'Drawer 1 share' });
    await user.clear(drawer);
    await user.type(drawer, 'NaN');
    await user.tab();
    expect(drawer.getAttribute('aria-invalid')).toBe('true');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Drawer 1 sizing' }), 'mm');
    const mm = screen.getByRole('textbox', { name: 'Drawer 1 front height in mm' });
    await user.clear(mm);
    await user.type(mm, '1.5');
    await user.tab();
    expect(screen.getByText('Enter a positive whole number of millimetres.')).toBeTruthy();
    const previous = useDesign.getState().past.length;
    await user.clear(mm);
    await user.type(mm, '200{Enter}');
    expect(useDesign.getState().past.length).toBe(previous + 1);
  });
  it('Settings explains per-axis locks and disables only those dimensions', async () => {
    const { user, useDesign } = await piece(width);
    const { newProject, makeItem } = await import('../../src/core/project');
    const p = newProject('Locked');
    const item = { ...makeItem(p, useDesign.getState().design), sizeLocks: ['width' as const] };
    act(() => {
      useDesign.getState().openProject({ ...p, items: [item] });
      useDesign.getState().editItem(item.id);
    });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: /Settings:/ });
    expect(
      (within(dialog).getByRole('textbox', { name: 'Width' }) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (within(dialog).getByRole('textbox', { name: 'Height' }) as HTMLInputElement).disabled,
    ).toBe(false);
    expect(within(dialog).getAllByText(/width locked — unlock to change/).length).toBeGreaterThan(
      0,
    );
  });
});

it('Door/Pair changes preserve the explicit hinge (ADR-199)', async () => {
  const { user } = await renderApp(1280);
  cleanup();
  const { FrontEditor } = await import('../../src/ui/Editors');
  type Space = import('../../src/core/types').Space;
  let saved: Space = { id: 's', kind: 'empty', front: { kind: 'doors', count: 1, hinge: 'right' } };
  function Front() {
    const [space, setSpace] = useState(saved);
    return (
      <FrontEditor
        space={space}
        onChange={(fn) =>
          setSpace((s) => {
            saved = fn(s);
            return saved;
          })
        }
      />
    );
  }
  render(<Front />);
  await user.click(screen.getByRole('radio', { name: 'Pair' }));
  await user.click(screen.getByRole('radio', { name: 'Door' }));
  expect(saved.front).toEqual({ kind: 'doors', count: 1, hinge: 'right' });
});

it('a refused dimension returns to the authoritative value, while accepted edits appear (ADR-199)', async () => {
  const { user } = await renderApp(1280);
  cleanup();
  const { MmField } = await import('../../src/ui/controls');
  const reject = vi.fn();
  const view = render(<MmField label="Rejected" value={800} onChange={reject} />);
  const input = screen.getByRole('textbox', { name: 'Rejected' });
  await user.clear(input);
  await user.type(input, '900{Enter}');
  expect(reject).toHaveBeenCalledOnce();
  expect((input as HTMLInputElement).value).toBe('800');
  function Accepted() {
    const [v, setV] = useState(800);
    return <MmField label="Accepted" value={v} onChange={setV} />;
  }
  view.rerender(<Accepted />);
  const accepted = screen.getByRole('textbox', { name: 'Accepted' });
  await user.clear(accepted);
  await user.type(accepted, '900{Enter}');
  expect((accepted as HTMLInputElement).value).toBe('900');
});
