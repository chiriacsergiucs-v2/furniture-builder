// @vitest-environment jsdom
// Find-it for ADR-222 (N227), in jsdom (ADR-108): the pages loaded on demand — Feature Research, Gaps, Information and
// guides, Catalog, the account dialog and a shared link's preview — are each reached from the bare app, through their
// loading fallback, by role and visible text, at phone and desktop widths.
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openMore, renderApp, WIDTHS } from './setup';

beforeEach(() => {
  // A build with a backend URL, so the Account button shows; nothing is contacted (no sign-in is made).
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
});
afterEach(() => vi.unstubAllEnvs());

describe.each(WIDTHS)('pages loaded on demand at %ipx (find-it, ADR-222)', (width) => {
  it('⋯ › Feature Research shows the page with its research data', async () => {
    const { user } = await renderApp(width);
    await openMore(user);
    await user.click(await screen.findByRole('button', { name: /^Feature Research/ }));
    const research = await screen.findByRole('main', { name: 'Feature Research & Catalog' });
    expect(within(research).getByRole('heading', { level: 1 }).textContent).toBe(
      'Feature Research & Catalog',
    );
    expect(within(research).getAllByText(/ADR-\d{3}/).length).toBeGreaterThan(0);
  });

  it('⋯ › Gaps shows the Gaps page', async () => {
    const { user } = await renderApp(width);
    await openMore(user);
    await user.click(await screen.findByRole('button', { name: /^Gaps/ }));
    const gaps = await screen.findByRole('main', { name: 'Gaps' });
    expect(within(gaps).getByRole('region', { name: 'Totals' })).toBeTruthy();
  });

  it('⋯ › Information and guides shows its Features', async () => {
    const { user } = await renderApp(width);
    await openMore(user);
    await user.click(await screen.findByRole('button', { name: /^Information and guides/ }));
    const info = await screen.findByRole('main', { name: 'Information and guides' });
    expect(within(info).getByRole('region', { name: 'Features' })).toBeTruthy();
  });

  it('the Catalog link shows the Catalog page', async () => {
    const { user } = await renderApp(width);
    await user.click((await screen.findAllByRole('link', { name: /^Catalog/ }))[0]);
    const catalog = await screen.findByRole('main', { name: 'Catalog' });
    expect(within(catalog).getByRole('heading', { level: 1, name: 'Catalog' })).toBeTruthy();
  });

  it('the Account button opens the sign-in dialog', async () => {
    const { user } = await renderApp(width);
    await user.click(screen.getByRole('button', { name: 'Account' }));
    const signIn = await screen.findByRole('dialog', { name: 'Sign in' });
    expect(within(signIn).getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  });

  it('a share link that no longer works opens the shared item dialog with its message', async () => {
    await renderApp(width);
    window.location.hash = '#share=';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(
      await screen.findByText('This link no longer works. Ask the owner for a new one.'),
    ).toBeTruthy();
  });
});
