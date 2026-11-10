// @vitest-environment jsdom
// ADR-259 (UI audit, Views): a render closed before the tracer is ready is thrown away; Keep proportions keeps every
// model side 1 to 10 000 mm; arrow keys on a model take the drag's path. The 3D view itself is checked by the browser
// script (Acceptance: browser).
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dragResize, MODEL_SIDE_MAX, modelSideRange, resizeModel } from '../src/core/model3d';

const calls: {
  resolve: () => void;
  dispose: ReturnType<typeof vi.fn>;
  finish: (b: Blob | null) => void;
}[] = [];
vi.mock('../src/viewer/pathtrace', () => ({
  startRender: vi.fn(
    () =>
      new Promise((resolve) => {
        let finish: (b: Blob | null) => void = () => {};
        const done = new Promise<Blob | null>((r) => (finish = r));
        const dispose = vi.fn();
        const job = { canvas: document.createElement('canvas'), done, cancel: vi.fn(), dispose };
        calls.push({ resolve: () => resolve(job), dispose, finish });
      }),
  ),
}));
vi.mock('../src/shared/renderSupport', async (orig) => ({
  ...(await orig<object>()),
  hasWebGL2: () => true,
  detectEngine: () => Promise.resolve('WebGL 2'),
}));

const proto = HTMLDialogElement.prototype;
proto.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
proto.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};
URL.createObjectURL = () => 'blob:x';
URL.revokeObjectURL = () => {};
afterEach(() => cleanup());

describe('Render dialog (ADR-259)', () => {
  it('a render closed before the tracer is ready is disposed and never becomes the last render', async () => {
    calls.length = 0;
    const { RenderDialog } = await import('../src/ui/RenderDialog');
    const { useUi } = await import('../src/store/uiStore');
    useUi.getState().setLastRender(null);
    const user = userEvent.setup();
    const r = render(<RenderDialog open onClose={() => {}} name="Test" />);
    await screen.findByText(/Engine: WebGL 2/);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(calls.length).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    r.rerender(<RenderDialog open={false} onClose={() => {}} name="Test" />);
    await act(async () => {
      calls[0].resolve();
      await new Promise((x) => setTimeout(x, 10));
      calls[0].finish(new Blob(['x']));
      await new Promise((x) => setTimeout(x, 10));
    });
    expect(calls[0].dispose).toHaveBeenCalled();
    expect(useUi.getState().lastRender).toBeNull();
  });
});

describe('model sizes (ADR-259)', () => {
  it('with Keep proportions every side stays 1 to 10 000 mm', () => {
    const size = { w: 600, h: 900, d: 600 };
    const r = modelSideRange(size, 'w', true);
    const big = resizeModel(size, 'w', r.max, true);
    expect(Math.max(big.w, big.h, big.d)).toBeLessThanOrEqual(MODEL_SIDE_MAX);
    const slim = { w: 600, h: 90, d: 20 };
    const s = modelSideRange(slim, 'w', true);
    const small = resizeModel(slim, 'w', s.min, true);
    expect(Math.min(small.w, small.h, small.d)).toBeGreaterThanOrEqual(1);
    expect(modelSideRange(size, 'w', false)).toEqual({ min: 1, max: MODEL_SIDE_MAX });
    const dragged = dragResize({ rotationY: 0 } as never, size, 'x', 20000, true);
    expect(Math.max(dragged.w, dragged.h, dragged.d)).toBeLessThanOrEqual(MODEL_SIDE_MAX);
  });
});
