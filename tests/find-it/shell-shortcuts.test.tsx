// @vitest-environment jsdom
import { act, fireEvent, render, screen, within, cleanup } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

async function piece(width: number) {
  const app = await renderApp(width);
  await app.user.click(await screen.findByRole('button', { name: 'New single piece' }));
  await app.user.click(
    within(await screen.findByRole('dialog')).getAllByRole('button', { name: /Sideboard/ })[0],
  );
  const { useDesign } = await import('../../src/store/designStore');
  const p = useDesign.getState().design.product;
  if (p.kind !== 'cabinet') throw Error('Expected cabinet');
  return { ...app, useDesign, p };
}

describe.each(WIDTHS)('shell keyboard scope at %ipx (ADR-198)', (width) => {
  it('bare app → piece → Catalog: undo and redo leave the hidden design alone', async () => {
    const { user, useDesign, p } = await piece(width);
    act(() => useDesign.getState().updateCabinet({ width: p.params.width + 50 }));
    await user.click(screen.getByRole('link', { name: /Catalog/ }));
    const before = useDesign.getState().design;
    await user.keyboard('{Control>}z{/Control}{Control>}y{/Control}');
    expect(useDesign.getState().design).toBe(before);
    await user.click(screen.getByRole('link', { name: 'Editor' }));
    await user.keyboard('{Control>}z{/Control}');
    expect(useDesign.getState().design.product).toMatchObject({
      params: { width: p.params.width },
    });
  });
  it('Settings keeps shortcuts inside the modal; More consumes Escape without changing selection', async () => {
    const { user, useDesign, p } = await piece(width);
    act(() => useDesign.getState().updateCabinet({ width: p.params.width + 50 }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: /Settings:/ });
    within(dialog).getByRole('button', { name: 'Done' }).focus();
    const before = useDesign.getState().design;
    await user.keyboard('{Control>}z{/Control}');
    expect(useDesign.getState().design).toBe(before);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    act(() => useDesign.getState().select(p.params.interior.id));
    const more = screen.getByLabelText('More', { selector: 'summary' });
    await user.click(more);
    await user.keyboard('{Escape}');
    expect(useDesign.getState().selectedId).toBe(p.params.interior.id);
    expect(more.parentElement?.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(more);
  });
});

it('dialog dismissal requires a complete backdrop gesture, including after cancellation (ADR-198)', async () => {
  await renderApp(1280);
  cleanup();
  // jsdom needs the pointer constructor to retain pointer ids and coordinates.
  window.PointerEvent ??= MouseEvent as typeof PointerEvent;
  const { Dialog } = await import('../../src/ui/Dialogs');
  const close = vi.fn();
  render(
    <Dialog open onClose={close} title="Gesture">
      <p>Text</p>
    </Dialog>,
  );
  const dialog = screen.getByRole('dialog');
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    right: 300,
    top: 100,
    bottom: 300,
    width: 200,
    height: 200,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  });
  const outside = { clientX: 50, clientY: 50, pointerId: 1 };
  fireEvent.pointerDown(screen.getByText('Text'), { clientX: 150, clientY: 150, pointerId: 1 });
  fireEvent.pointerUp(dialog, outside);
  fireEvent.click(dialog, outside);
  expect(close).not.toHaveBeenCalled();
  fireEvent.pointerDown(dialog, outside);
  fireEvent.pointerCancel(dialog, outside);
  fireEvent.pointerUp(dialog, outside);
  fireEvent.click(dialog, outside);
  expect(close).not.toHaveBeenCalled();
  fireEvent.pointerDown(dialog, outside);
  fireEvent.pointerUp(dialog, outside);
  fireEvent.click(dialog, outside);
  expect(close).toHaveBeenCalledTimes(1);
});
