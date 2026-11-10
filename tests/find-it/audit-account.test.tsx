// @vitest-environment jsdom
// ADR-264 item 5, from the bare app at 1280 and 390 px: signed in, the row menu's Keep on this device only says when it
// fails. The backend is the in-memory one (`src/online/fake.ts`); nothing leaves the test.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
});
afterEach(() => vi.unstubAllEnvs());

describe.each(WIDTHS)('UI audit, Account, at %ipx (find-it, ADR-264)', (width) => {
  it('Keep on this device only offline shows its alert in the row menu', async () => {
    const { user } = await renderApp(width);
    const { fakeBackend, fakeServer } = await import('../../src/online/fake');
    const client = await import('../../src/online/client');
    const server = fakeServer();
    client.setBackend(fakeBackend(server));
    const { db } = await import('../../src/persist/db');
    await Promise.all(db.tables.map((t) => t.clear()));

    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const pick = await screen.findByRole('dialog');
    await user.click(within(pick).getAllByRole('button', { name: /Sideboard/ })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(async () => expect(await db.designs.count()).toBe(1), { timeout: 5000 });
    await user.click(
      within(screen.getByRole('navigation', { name: 'Places' })).getByRole('link', {
        name: /Projects/,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Account' }));
    let dlg = within(await screen.findByRole('dialog', { name: 'Sign in' }));
    await user.click(dlg.getByRole('button', { name: 'Create account' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Create account' }));
    await user.clear(dlg.getByLabelText('Email'));
    await user.type(dlg.getByLabelText('Email'), 'me@example.com');
    await user.type(dlg.getByLabelText('Password'), 'pw-123456');
    await user.click(dlg.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(server.records.size).toBe(1), { timeout: 15000 });

    server.offline = true;
    await user.click(screen.getByLabelText(/^Account actions for /));
    await user.click(
      screen.getByRole('button', { name: 'Keep on this device only removes it from your account' }),
    );
    expect(
      await screen.findByText(
        'It could not be taken out of your account. Check your connection and try again.',
      ),
    ).toBeTruthy();

    server.offline = false;
    client.stopAutoSync();
    const backend = await client.getBackend();
    await backend.signOut();
    await client.sync();
  }, 30000);
});
