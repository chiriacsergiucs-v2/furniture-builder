// @vitest-environment jsdom
// Find-it for audit finding F-28 (G-518) in jsdom (ADR-108): a share link whose fetch fails says so and offers
// "Try again"; the link does not have to be opened anew. The backend is the in-memory one (`src/online/fake.ts`).
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
});
afterEach(() => vi.unstubAllEnvs());

describe.each(WIDTHS)('a failed share link at %ipx (find-it, F-28)', (width) => {
  it('opens the link while the connection fails → Try again → the shared piece shows', async () => {
    const { user } = await renderApp(width);
    const { fakeBackend, fakeServer } = await import('../../src/online/fake');
    const client = await import('../../src/online/client');
    const { templates } = await import('../../src/core/design');
    const server = fakeServer();
    const backend = fakeBackend(server);
    client.setBackend(backend);
    const res = await backend.signUp('a@example.com', 'long-password-1');
    if (!res.ok) throw new Error('sign up');
    const saved = await backend.saveRecord({
      kind: 'design',
      name: 'Shared sideboard',
      body: templates[0].create(),
      bodySchema: 3,
    });
    if (!saved.ok) throw new Error('save');
    const share = await backend.createShare(saved.record.id, 'abcdefghijklmnopqrstuv');
    server.offline = true;
    window.location.hash = `#share=${share.id}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const dlg = within(await screen.findByRole('dialog', { name: 'Shared item' }));
    expect(await dlg.findByText('Check your connection and try again.')).toBeTruthy();
    server.offline = false;
    await user.click(dlg.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Shared item' })).toBeNull());
    expect(await screen.findByRole('dialog', { name: /Shared sideboard/ })).toBeTruthy();
  });
});
