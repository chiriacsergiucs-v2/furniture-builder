// @vitest-environment jsdom
// G-373: the size-lock note in the piece editor shows the store's notice only when it is a size-lock refusal (ADR-122,
// ADR-203), not a move refused or a plan notice; it still shows for a locked piece.
import 'fake-indexeddb/auto';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeItem, newProject } from '../src/core/project';
import { templates } from '../src/core/design';
import { useDesign } from '../src/store/designStore';
import { Inspector } from '../src/ui/Inspector';

afterEach(cleanup);

function open(locked: boolean) {
  const project = newProject('Lock note');
  const item = makeItem(project, templates[0].create());
  act(() => {
    useDesign.getState().openProject({ ...project, items: [item] });
    if (locked) useDesign.getState().setSizeLocked(item.id, true);
    useDesign.getState().editItem(item.id);
  });
}

describe('SizeLockNote (G-373)', () => {
  it('an unlocked piece does not show another notice in the size-lock box', () => {
    open(false);
    act(() => useDesign.setState({ notice: 'Piece A cannot move there — it would overlap.' }));
    render(<Inspector mode="configure" />);
    expect(screen.queryByText(/cannot move there/)).toBeNull();
    expect(screen.queryByText(/Edits that change its width/)).toBeNull();
  });

  it('an unlocked piece shows a size-lock refusal (a locked piece sits on it)', () => {
    open(false);
    const why = 'Wall unit sits on Base and is locked — unlock it to resize Base.';
    act(() => useDesign.setState({ notice: why }));
    render(<Inspector mode="configure" />);
    expect(screen.getByText(why)).toBeTruthy();
  });

  it('a locked piece shows the lock note, with the refusal when there is one', () => {
    open(true);
    act(() => useDesign.setState({ notice: 'Something else happened.' }));
    render(<Inspector mode="configure" />);
    expect(
      screen.getByText(/locked — unlock to change\. Edits that change its width/),
    ).toBeTruthy();
    expect(screen.queryByText(/Something else happened/)).toBeNull();
  });
});
