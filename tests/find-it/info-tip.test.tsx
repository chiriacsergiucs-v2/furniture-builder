// @vitest-environment jsdom
// Find-it for static intro text behind an info button (ADR-111, N109), in jsdom (ADR-108): from the bare app, by role
// and visible text, at phone and desktop widths.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, WIDTHS } from './setup';

const INTRO = /Pieces are cut and bought together/;

/** Every info button on the page has a name: "About …", or "Guidance: …" for ADR-010 guidance. */
function expectNamedInfoButtons() {
  const all = [...document.querySelectorAll<HTMLButtonElement>('button.info-btn')];
  expect(all.length).toBeGreaterThan(0);
  // `hidden`: buttons behind an open modal dialog count too.
  const named = screen.getAllByRole('button', { name: /^(About |Guidance: )\S/, hidden: true });
  for (const b of all) expect(named).toContain(b);
}

describe.each(WIDTHS)('info buttons at %ipx (find-it, ADR-111)', (width) => {
  it('bare app → Create a new project → Project: the intro opens from its ⓘ and Esc closes it', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'Create a new project' }));
    await user.click(await screen.findByRole('button', { name: 'Create project' }));
    await screen.findByRole('heading', { name: 'Project', level: 2 });

    // Hidden until asked for.
    expect(screen.queryByText(INTRO)).toBeNull();
    const about = screen.getByRole('button', { name: 'About the project' });
    expect(about.getAttribute('aria-expanded')).toBe('false');

    await user.click(about);
    const note = screen.getByRole('note');
    expect(note.textContent).toMatch(INTRO);
    expect(note.textContent).toMatch(/editing it here never changes your saved pieces/);
    expect(about.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{Escape}');
    expect(screen.queryByText(INTRO)).toBeNull();
    expect(document.activeElement).toBe(about);
    // Esc closed only the popover: the project is still open.
    expect(screen.getByRole('heading', { name: 'Project', level: 2 })).toBeTruthy();

    // A second tap opens it again, a third closes it.
    await user.click(about);
    expect(screen.getByText(INTRO)).toBeTruthy();
    await user.click(about);
    expect(screen.queryByText(INTRO)).toBeNull();

    expectNamedInfoButtons();
  });

  it('bare app → New single piece → Sideboard → Settings: a guidance ⓘ starts with "Guidance"; Esc keeps the dialog', async () => {
    const { user } = await renderApp(width);
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const start = await screen.findByRole('dialog');
    await user.click(within(start).getAllByRole('button', { name: /Sideboard/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /^Settings/ });

    // The section intro and the ADR-010 guidance are both one tap away, not on the page.
    expect(within(settings).queryByText(/Sizes, construction and boards/)).toBeNull();
    expect(within(settings).queryByText(/Typical values that raise warnings/)).toBeNull();

    const guidance = within(settings).getByRole('button', { name: 'Guidance: checks' });
    await user.click(guidance);
    const note = within(settings).getByRole('note');
    expect(note.textContent).toMatch(/^Guidance/);
    expect(note.textContent).toMatch(/Typical values that raise warnings, never errors/);

    // Esc closes only the popover: nothing under it (the dialog, the editor's Esc) sees the key.
    const seen: string[] = [];
    const spy = (e: KeyboardEvent) => seen.push(e.key);
    window.addEventListener('keydown', spy);
    await user.keyboard('{Escape}');
    expect(within(settings).queryByRole('note')).toBeNull();
    expect(document.activeElement).toBe(guidance);
    expect((settings as HTMLDialogElement).open).toBe(true);
    expect(seen).not.toContain('Escape');
    window.removeEventListener('keydown', spy);

    await user.click(within(settings).getByRole('button', { name: 'About the whole cabinet' }));
    expect(within(settings).getByRole('note').textContent).toMatch(
      /Sizes, construction and boards/,
    );
    await user.keyboard('{Escape}');

    expectNamedInfoButtons();
  });
});
