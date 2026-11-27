// @vitest-environment jsdom
// ADR-269: the innermost space at a point, a tap outside the piece, Esc at the whole piece, the pinned drawer.
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { splitSpace, templates } from '../src/core/design';
import { deepestAt, parentOf } from '../src/core/selectPath';
import type { Design, Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';
import { useUi } from '../src/store/uiStore';
import { Inspector } from '../src/ui/Inspector';
import { stubMatchMedia } from './helpers/matchMedia';

/** A sideboard with the middle bay divided in two (top and bottom). */
function piece() {
  const d = templates.find((t) => t.id === 'sideboard')!.create();
  if (d.product.kind !== 'cabinet') throw new Error('cabinet expected');
  const root = d.product.params.interior as Extract<Space, { kind: 'split' }>;
  const middle = splitSpace(root.children[1], 'y', 2) as Extract<Space, { kind: 'split' }>;
  const interior = { ...root, children: [root.children[0], middle, root.children[2]] };
  const design: Design = {
    ...d,
    product: { ...d.product, params: { ...d.product.params, interior } },
  };
  return {
    design,
    left: root.children[0].id,
    middle: middle.id,
    top: middle.children[0].id,
    bottom: middle.children[1].id,
  };
}
const centre = (d: Design, id: string) => {
  const o = buildModel(d).spaces.find((s) => s.nodeId === id)!;
  return [o.box.x + o.box.w / 2, o.box.y + o.box.h / 2] as const;
};
const st = () => useDesign.getState();

beforeEach(() => {
  stubMatchMedia();
  useUi.setState({ pinnedId: null, pinnedDesignId: null, hoverId: undefined, groupOpen: {} });
});
afterEach(cleanup);

describe('deepestAt and the empty tap (ADR-269)', () => {
  const p = piece();
  const model = buildModel(p.design);

  it('deepestAt gives the innermost space at a point and nothing outside the piece', () => {
    const [x, y] = centre(p.design, p.bottom);
    expect(deepestAt(model, x, y)).toBe(p.bottom);
    const b = model.bounds;
    expect(deepestAt(model, b.x + b.w + 50, y)).toBeUndefined();
    expect(deepestAt(model, x, b.y + b.h + 50)).toBeUndefined();
  });

  it('a tap outside the piece keeps the selection; a deep tap selects the innermost space', () => {
    st().load(p.design);
    const [x, y] = centre(p.design, p.top);
    st().tapPiece(x, y);
    st().tapPiece(x, y);
    expect(st().selectedId).toBe(p.middle);
    const b = model.bounds;
    st().tapPiece(b.x + b.w + 50, y);
    expect(st().selectedId).toBe(p.middle);
    st().tapPiece(x, y, true);
    expect(st().selectedId).toBe(p.top);
  });

  it('Esc at the whole piece clears the selection', () => {
    st().load(p.design);
    st().select(null);
    st().select(parentOf(st().model, st().selectedId));
    expect(st().selectedId).toBeUndefined();
  });
});

describe('the pinned drawer (ADR-269)', () => {
  const p = piece();
  const heading = () => screen.getByRole('heading', { level: 2 }).textContent;

  it('stays on the pinned space when another is selected; pin and unpin by the button', () => {
    st().load(p.design);
    act(() => st().select(p.left));
    render(<Inspector mode="compose" />);
    const left = heading();
    const pin = screen.getByRole('button', { name: 'Pin the drawer' });
    act(() => pin.click());
    expect(screen.getByText(`Pinned: ${left}`)).toBeTruthy();
    act(() => st().select(p.bottom));
    expect(heading()).toBe(left);
    act(() => screen.getByRole('button', { name: 'Pin the drawer' }).click());
    expect(useUi.getState().pinnedId).toBeNull();
    expect(heading()).not.toBe(left);
  });

  it('unpins when its space is gone', () => {
    st().load(p.design);
    act(() => st().select(p.top));
    render(<Inspector mode="compose" />);
    act(() => screen.getByRole('button', { name: 'Pin the drawer' }).click());
    expect(useUi.getState().pinnedId).toBe(p.top);
    act(() => st().updateSpace(p.middle, (s) => ({ id: s.id, kind: 'empty' }) as Space));
    expect(useUi.getState().pinnedId).toBeNull();
  });

  it('unpins when another piece opens', () => {
    st().load(p.design);
    act(() => st().select(p.top));
    render(<Inspector mode="compose" />);
    act(() => screen.getByRole('button', { name: 'Pin the drawer' }).click());
    act(() => st().load(piece().design));
    expect(useUi.getState().pinnedId).toBeNull();
  });
});
