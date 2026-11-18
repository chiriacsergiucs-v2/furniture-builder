// @vitest-environment jsdom
// ADR-270: taps inside an entered space, the entered context's life, and the focus strength.
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { splitSpace, templates } from '../src/core/design';
import { FOCUS_LOOKS, FOCUS_OPACITY, drillIn, nextFocusLook, pathAt } from '../src/core/selectPath';
import type { Design, Space } from '../src/core/types';
import { makeMaterial } from '../src/viewer/panelResources';
import { useDesign } from '../src/store/designStore';
import { useUi } from '../src/store/uiStore';
import { Elevation } from '../src/ui/Elevation';
import { Inspector } from '../src/ui/Inspector';

/** A sideboard whose middle bay is divided in two (top, bottom) and the bottom again side by side. */
function piece() {
  const d = templates.find((t) => t.id === 'sideboard')!.create();
  if (d.product.kind !== 'cabinet') throw new Error('cabinet expected');
  const root = d.product.params.interior as Extract<Space, { kind: 'split' }>;
  const middle = splitSpace(root.children[1], 'y', 2) as Extract<Space, { kind: 'split' }>;
  const bottom = splitSpace(middle.children[1], 'x', 2) as Extract<Space, { kind: 'split' }>;
  const mid = { ...middle, children: [middle.children[0], bottom] };
  const interior = { ...root, children: [root.children[0], mid, root.children[2]] };
  const design: Design = {
    ...d,
    product: { ...d.product, params: { ...d.product.params, interior } },
  };
  return {
    design,
    left: root.children[0].id,
    middle: mid.id,
    top: mid.children[0].id,
    bottom: bottom.id,
    bottomLeft: bottom.children[0].id,
  };
}
const centre = (d: Design, id: string) => {
  const o = buildModel(d).spaces.find((s) => s.nodeId === id)!;
  return [o.box.x + o.box.w / 2, o.box.y + o.box.h / 2] as const;
};
const st = () => useDesign.getState();

beforeEach(() => {
  window.matchMedia = ((q: string) =>
    ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }) as never) as never;
  useUi.setState({
    enteredId: null,
    enteredDesignId: null,
    focusLook: 'fade',
    pinnedId: null,
    pinnedDesignId: null,
    groupOpen: {},
  });
});
afterEach(cleanup);

describe('drillIn (ADR-270)', () => {
  const p = piece();
  const model = buildModel(p.design);

  it('cycles the children of the entered space, then returns to it, never to the whole piece', () => {
    const [x, y] = centre(p.design, p.bottomLeft);
    expect(pathAt(model, x, y)).toEqual([p.middle, p.bottom, p.bottomLeft]);
    let sel = drillIn(model, x, y, p.middle, p.middle);
    expect(sel).toBe(p.bottom);
    sel = drillIn(model, x, y, sel, p.middle);
    expect(sel).toBe(p.bottomLeft);
    sel = drillIn(model, x, y, sel, p.middle);
    expect(sel).toBe(p.middle);
  });

  it('a tap elsewhere in the entered space goes to where the paths part; one outside changes nothing', () => {
    const [bx, by] = centre(p.design, p.bottomLeft);
    const [tx, ty] = centre(p.design, p.top);
    expect(drillIn(model, tx, ty, p.bottomLeft, p.middle)).toBe(p.top);
    expect(drillIn(model, bx, by, p.top, p.middle)).toBe(p.bottom);
    const [lx, ly] = centre(p.design, p.left);
    expect(drillIn(model, lx, ly, p.bottom, p.middle)).toBe(p.bottom);
  });

  it('the store taps inside the entered space', () => {
    st().load(p.design);
    st().select(p.middle);
    const [lx, ly] = centre(p.design, p.left);
    st().tapPiece(lx, ly, false, p.middle);
    expect(st().selectedId).toBe(p.middle);
    const [x, y] = centre(p.design, p.top);
    st().tapPiece(x, y, false, p.middle);
    expect(st().selectedId).toBe(p.top);
  });
});

describe('the entered context (ADR-270)', () => {
  const p = piece();
  const enterFrom = () => {
    st().load(p.design);
    act(() => st().select(p.middle));
    render(<Inspector mode="compose" />);
    act(() => screen.getByRole('button', { name: 'Edit inside this space' }).click());
  };

  it('shows its state with Exit, and Exit leaves it', () => {
    enterFrom();
    expect(useUi.getState().enteredId).toBe(p.middle);
    expect(screen.getByText(/^Editing inside: /)).toBeTruthy();
    act(() => screen.getByRole('button', { name: 'Exit' }).click());
    expect(useUi.getState().enteredId).toBeNull();
  });

  it('ends when its space is deleted', () => {
    enterFrom();
    const prod = p.design.product;
    const rootId = prod.kind === 'cabinet' ? prod.params.interior.id : '';
    act(() => st().updateSpace(rootId, (s) => ({ id: s.id, kind: 'empty' }) as Space));
    expect(useUi.getState().enteredId).toBeNull();
  });

  it('ends when another piece opens', () => {
    enterFrom();
    act(() => st().load(piece().design));
    expect(useUi.getState().enteredId).toBeNull();
  });
});

describe('focus strength (ADR-270)', () => {
  it('maps each look to an opacity and cycles fade, strong, hide', () => {
    expect(FOCUS_OPACITY).toEqual({ fade: 0.28, strong: 0.1, hide: 0 });
    expect(FOCUS_LOOKS.map(nextFocusLook)).toEqual(['strong', 'hide', 'fade']);
  });

  it('the same value feeds the 3D materials', () => {
    const look = (l: keyof typeof FOCUS_OPACITY) =>
      makeMaterial({
        realistic: false,
        color: '#cccccc',
        map: null,
        faded: true,
        fadeOpacity: FOCUS_OPACITY[l],
        side: 0,
        back: false,
      }).opacity;
    expect(look('fade')).toBe(0.28);
    expect(look('strong')).toBe(0.1);
  });

  it('the Focus button cycles the look', () => {
    const p = piece();
    st().load(p.design);
    act(() => st().select(p.left));
    render(<Inspector mode="compose" />);
    act(() => screen.getByRole('button', { name: 'Focus: Fade' }).click());
    expect(useUi.getState().focusLook).toBe('strong');
    act(() => screen.getByRole('button', { name: 'Focus: Strong' }).click());
    expect(useUi.getState().focusLook).toBe('hide');
  });

  it('hide removes the faded panels from the drawing; the entered space stays solid', () => {
    const p = piece();
    st().load(p.design);
    act(() => st().select(p.middle));
    const { container } = render(<Elevation />);
    const polys = () => container.querySelectorAll('polygon').length;
    const faded = () => container.querySelectorAll('polygon.faded').length;
    const all = polys();
    act(() => useUi.getState().enter(p.middle, st().design.id));
    expect(faded()).toBeGreaterThan(0);
    expect(polys()).toBe(all);
    act(() => useUi.setState({ focusLook: 'hide' }));
    expect(polys()).toBeLessThan(all);
    expect(faded()).toBe(0);
  });
});
