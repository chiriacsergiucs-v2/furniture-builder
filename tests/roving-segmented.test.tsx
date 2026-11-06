// @vitest-environment jsdom
// ADR-202 (G-361): the roving tab stop of single-choice groups. `rovingTab` makes only the selected option a Tab stop
// (the first when none); `rovingKeys` moves and selects with the arrow keys, wrapping, and Home/End go to the ends.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { rovingKeys, rovingTab, Segmented } from '../src/ui/controls';

afterEach(cleanup);

const OPTIONS = ['a', 'b', 'c', 'd'] as const;

function Seg({ start, wrap }: { start: string; wrap?: boolean }) {
  const [v, setV] = useState(start);
  return (
    <>
      <button type="button">before</button>
      <Segmented
        label="Letter"
        value={v}
        options={OPTIONS.map((o) => ({ value: o, label: o.toUpperCase() }))}
        onChange={setV}
        wrap={wrap}
      />
      <button type="button">after</button>
    </>
  );
}

/** A hand-written group as App.tsx writes them: tabs with a disabled one in the middle. */
function Tabs() {
  const [v, setV] = useState('one');
  const all = [
    { id: 'one', disabled: false },
    { id: 'two', disabled: true },
    { id: 'three', disabled: false },
  ];
  return (
    <div role="tablist" aria-label="Tabs" onKeyDown={rovingKeys}>
      {all.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={v === o.id}
          disabled={o.disabled}
          tabIndex={rovingTab(v === o.id, i, true)}
          onClick={() => setV(o.id)}
        >
          {o.id}
        </button>
      ))}
    </div>
  );
}

const radios = () =>
  within(screen.getByRole('radiogroup', { name: 'Letter' })).getAllByRole('radio');
const checked = () => radios().find((r) => r.getAttribute('aria-checked') === 'true')?.textContent;

describe('rovingTab (ADR-202)', () => {
  it('only the selected option is a Tab stop; the first when none is selected', () => {
    expect([0, 1, 2].map((i) => rovingTab(i === 1, i, true))).toEqual([-1, 0, -1]);
    expect([0, 1, 2].map((i) => rovingTab(false, i, false))).toEqual([0, -1, -1]);
  });
});

describe('Segmented with arrow keys (ADR-202)', () => {
  it('Tab reaches only the selected option and leaves the group in one step', async () => {
    const user = userEvent.setup();
    render(<Seg start="c" />);
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, -1, 0, -1]);
    screen.getByRole('button', { name: 'before' }).focus();
    await user.tab();
    expect(document.activeElement?.textContent).toBe('C');
    await user.tab();
    expect(document.activeElement?.textContent).toBe('after');
  });

  it('with nothing selected, the first option is the Tab stop', () => {
    render(<Seg start="none" />);
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('→/↓ and ←/↑ move and select, wrapping; Home and End go to the ends', async () => {
    const user = userEvent.setup();
    render(<Seg start="a" />);
    radios()[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(checked()).toBe('B');
    expect(document.activeElement).toBe(radios()[1]);
    expect(radios()[1].tabIndex).toBe(0);
    await user.keyboard('{ArrowDown}');
    expect(checked()).toBe('C');
    await user.keyboard('{ArrowUp}{ArrowLeft}');
    expect(checked()).toBe('A');
    await user.keyboard('{ArrowLeft}');
    expect(checked()).toBe('D');
    expect(document.activeElement).toBe(radios()[3]);
    await user.keyboard('{ArrowRight}');
    expect(checked()).toBe('A');
    await user.keyboard('{End}');
    expect(checked()).toBe('D');
    await user.keyboard('{Home}');
    expect(checked()).toBe('A');
    expect(document.activeElement).toBe(radios()[0]);
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('other keys and modified arrows leave the choice alone', async () => {
    const user = userEvent.setup();
    render(<Seg start="b" />);
    radios()[1].focus();
    await user.keyboard('x{Control>}{ArrowRight}{/Control}{Alt>}{ArrowLeft}{/Alt}');
    expect(checked()).toBe('B');
  });

  it('wrap gives the control the .segmented.wrap class', () => {
    render(<Seg start="a" wrap />);
    expect(screen.getByRole('radiogroup', { name: 'Letter' }).className).toBe('segmented wrap');
  });
});

describe('a hand-written group with rovingKeys (ADR-202)', () => {
  it('tabs: arrows skip a disabled option and select', async () => {
    const user = userEvent.setup();
    render(<Tabs />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(tabs.map((b) => b.tabIndex)).toEqual([-1, -1, 0]);
    await user.keyboard('{ArrowRight}');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });
});
