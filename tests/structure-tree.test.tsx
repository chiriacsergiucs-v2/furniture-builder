// @vitest-environment jsdom
// ADR-268: the structure tree's keyboard model (W3C tree pattern) and its follow-the-selection behaviour.
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cabinet, splitSpace } from '../src/core/design';
import type { Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';
import { useUi } from '../src/store/uiStore';
import { StructureTree } from '../src/ui/StructureTree';

const interior = (): Space => {
  const root = splitSpace({ id: 'r', kind: 'empty' } as Space, 'x', 2);
  if (root.kind !== 'split') return root;
  return { ...root, children: [splitSpace(root.children[0], 'y', 2), root.children[1]] };
};

let phone = false;
beforeEach(() => {
  phone = false;
  window.matchMedia = ((q: string) =>
    ({
      matches: phone,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }) as never) as never;
  useUi.setState({ treeOpen: [], groupOpen: {} });
  useDesign.getState().load(cabinet('c', {}, interior()));
});
afterEach(cleanup);

const items = () => screen.getAllByRole('treeitem');
const names = () => items().map((e) => e.textContent);

describe('StructureTree (ADR-268)', () => {
  it('is open on a wide screen and names the tree', () => {
    render(<StructureTree />);
    expect(screen.getByRole('tree', { name: 'Whole piece tree' })).toBeTruthy();
    expect(screen.getByText('Structure').closest('details')!.open).toBe(true);
    expect(names()).toEqual(['Whole cabinet', expect.stringMatching(/^Interior, \d+ × \d+ mm$/)]);
  });

  it('is closed in the phone sheet on a bare start', () => {
    phone = true;
    render(<StructureTree />);
    expect(screen.getByText('Structure').closest('details')!.open).toBe(false);
  });

  it('expands the ancestors of a space selected elsewhere and marks its row selected', () => {
    render(<StructureTree />);
    const inner = useDesign.getState().design.product;
    const kids = (interior() && (inner.kind === 'cabinet' ? inner.params.interior : null)) as Space;
    const left = kids.kind === 'split' ? kids.children[0] : kids;
    const top = left.kind === 'split' ? left.children[0] : left;
    act(() => useDesign.getState().select(top.id));
    const sel = items().find((e) => e.getAttribute('aria-selected') === 'true')!;
    expect(sel.textContent).toMatch(/^Top: Empty/);
    expect(sel.getAttribute('aria-level')).toBe('4');
    expect(
      items()
        .find((e) => /^Left: Divided/.test(e.textContent ?? ''))!
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('a click on a row selects it; the whole-piece row selects the piece', () => {
    render(<StructureTree />);
    act(() => useDesign.getState().select('r'));
    expect(useDesign.getState().selectedId).toBe('r');
    fireEvent.click(items()[0]);
    expect(useDesign.getState().selectedId).toBeNull();
    fireEvent.click(items()[1]);
    expect(useDesign.getState().selectedId).toBe('r');
  });

  it('arrows, Home and End move focus and never change the selection; Enter and Space select', () => {
    render(<StructureTree />);
    act(() => useDesign.getState().select('r'));
    const before = useDesign.getState().selectedId;
    const key = (el: Element, k: string) => fireEvent.keyDown(el, { key: k });
    // Right opens the closed root, a second Right moves to its first child.
    key(items()[1], 'ArrowRight');
    expect(items()[1].getAttribute('aria-expanded')).toBe('true');
    expect(items()).toHaveLength(4);
    key(items()[1], 'ArrowRight');
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(items()[3]);
    key(document.activeElement!, 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
    key(document.activeElement!, 'End');
    expect(document.activeElement).toBe(items()[items().length - 1]);
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(items()[0]);
    // Left on a child goes to its parent; on an open row it closes it.
    key(items()[2], 'ArrowLeft');
    expect(document.activeElement).toBe(items()[1]);
    key(items()[1], 'ArrowLeft');
    expect(items()[1].getAttribute('aria-expanded')).toBe('false');
    expect(useDesign.getState().selectedId).toBe(before);
    // Enter and Space select.
    key(items()[0], 'Enter');
    expect(useDesign.getState().selectedId).toBeNull();
    key(items()[1], ' ');
    expect(useDesign.getState().selectedId).toBe('r');
  });

  it('has one tab stop (roving tabindex)', () => {
    render(<StructureTree />);
    expect(items().filter((e) => e.tabIndex === 0)).toHaveLength(1);
  });
});
