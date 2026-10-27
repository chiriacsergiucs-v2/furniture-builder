// @vitest-environment jsdom
// Button labels never wrap; a cut label shows its full text in `title` (ADR-113). jsdom has no layout, so the
// widths are set by hand.
import { afterEach, describe, expect, it } from 'vitest';
import { installCutTitles, syncCutTitle } from '../src/ui/cutTitle';

function button(label: string, scroll: number, client: number, title?: string) {
  const b = document.createElement('button');
  b.className = 'btn';
  const span = document.createElement('span');
  span.textContent = label;
  b.append(span);
  if (title) b.title = title;
  Object.defineProperty(span, 'scrollWidth', { configurable: true, get: () => scroll });
  Object.defineProperty(span, 'clientWidth', { configurable: true, get: () => client });
  document.body.append(b);
  return { b, span };
}
const widths = (el: HTMLElement, scroll: number, client: number) => {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scroll });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => client });
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('cut button labels get their full text in title (ADR-113)', () => {
  it('a cut label gets a title; it goes again once the label fits', () => {
    const { b, span } = button('Merge with right piece', 180, 120);
    syncCutTitle(b);
    expect(b.title).toBe('Merge with right piece');
    widths(span, 120, 120);
    syncCutTitle(b);
    expect(b.hasAttribute('title')).toBe(false);
  });

  it('a label that fits has no title', () => {
    const { b } = button('Prices', 50, 50);
    syncCutTitle(b);
    expect(b.hasAttribute('title')).toBe(false);
  });

  it("a button's own title is kept", () => {
    const { b } = button(
      'Suggest run parts',
      200,
      100,
      'Suggest worktop, plinth, fillers and covers',
    );
    syncCutTitle(b);
    expect(b.title).toBe('Suggest worktop, plinth, fillers and covers');
  });

  it('the pointer or the keyboard reaching a button sets it; uninstalling stops it', () => {
    const stop = installCutTitles(document);
    const { b, span } = button('Print shopping list', 160, 90);
    span.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(b.title).toBe('Print shopping list');
    stop();
    const other = button('Shopping list CSV', 160, 90).b;
    other.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(other.hasAttribute('title')).toBe(false);
  });
});
