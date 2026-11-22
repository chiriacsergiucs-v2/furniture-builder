// @vitest-environment jsdom
// The canvas editor's pure parts (ADR-283): the device flag, chips ordered by use, and one titled block at a time.
import { describe, expect, it } from 'vitest';
import {
  applyLens,
  clearLens,
  controlByLabel,
  keyboardInset,
  lensKeys,
  OVERVIEW,
} from '../src/ui/CanvasEditor';
import { orderByUse, parseCanvasEditor } from '../src/store/useCanvasEditor';
import { partSizeAfterMove } from '../src/ui/Elevation';

const editor = () => {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="inspector">
      <header id="head"><h2>Drawers</h2></header>
      <section data-lens-key="Divide this space" id="divide"><p>x</p></section>
      <section data-lens-key="Contents" id="contents">
        <details data-lens-key="Drawer heights" id="inner"></details>
      </section>
      <details data-lens-key="Layouts" id="layouts"></details>
      <button id="link">Select the divided space around this one</button>
    </div>`;
  return root;
};
const off = (root: Element, id: string) =>
  root.querySelector(`#${id}`)!.hasAttribute('data-lens-off');

describe('canvas editor (ADR-283)', () => {
  it('is off unless "on" is stored', () => {
    expect(parseCanvasEditor(null)).toBe(false);
    expect(parseCanvasEditor('off')).toBe(false);
    expect(parseCanvasEditor('on')).toBe(true);
  });

  it('orders chips by use, ties keep their order', () => {
    expect(orderByUse(['A', 'B', 'C'], {})).toEqual(['A', 'B', 'C']);
    expect(orderByUse(['A', 'B', 'C'], { C: 3, B: 1 })).toEqual(['C', 'B', 'A']);
  });

  it('lists only top-level titled blocks, in page order', () => {
    expect(lensKeys(editor())).toEqual(['Divide this space', 'Contents', 'Layouts']);
  });

  it('shows one block and hides the rest, its own children included', () => {
    const root = editor();
    applyLens(root, 'Contents');
    expect(off(root, 'contents')).toBe(false);
    expect(off(root, 'inner')).toBe(false);
    for (const id of ['divide', 'layouts', 'head', 'link']) expect(off(root, id)).toBe(true);
  });

  it('the overview shows everything but the titled blocks', () => {
    const root = editor();
    applyLens(root, OVERVIEW);
    for (const id of ['head', 'link']) expect(off(root, id)).toBe(false);
    for (const id of ['divide', 'contents', 'layouts']) expect(off(root, id)).toBe(true);
  });

  it('clearing restores the whole editor', () => {
    const root = editor();
    applyLens(root, 'Layouts');
    clearLens(root);
    expect(root.querySelectorAll('[data-lens-off]').length).toBe(0);
  });

  it('docks the card on the keyboard: its height is what the visual viewport no longer covers (ADR-284)', () => {
    expect(keyboardInset(800, undefined)).toBe(0);
    expect(keyboardInset(800, 800, 0)).toBe(0);
    expect(keyboardInset(800, 500, 0)).toBe(300);
    expect(keyboardInset(800, 500, 40)).toBe(260);
    expect(keyboardInset(800, 900, 0)).toBe(0);
  });

  it('finds a field by its visible label (ADR-284)', () => {
    const body = document.createElement('div');
    body.innerHTML =
      '<label for="w1">Width</label><input id="w1"><label for="h1">Height</label><input id="h1">';
    document.body.appendChild(body);
    expect(controlByLabel(body, 'Height')?.id).toBe('h1');
    expect(controlByLabel(body, 'Depth')).toBeNull();
    body.remove();
  });

  it('a divider move sizes the part before it, in whole mm or 10 mm steps (ADR-285)', () => {
    // Low side (left or lower): moving the divider up the axis grows the part.
    expect(partSizeAfterMove(400, true, 500, 537, false)).toBe(437);
    expect(partSizeAfterMove(400, true, 500, 537, true)).toBe(440);
    // High side: the same move shrinks it.
    expect(partSizeAfterMove(400, false, 500, 537, false)).toBe(363);
    expect(partSizeAfterMove(10, true, 500, 0, false)).toBe(1);
  });
});
