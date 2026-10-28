// @vitest-environment jsdom
// Catch-up find-it (ADR-066, user 2026-10-28 "All find it") for ADR-129 to ADR-143 (N130 to N144), in jsdom
// (ADR-108): from the bare app, by role and visible text, at 1280 and 390 px. The build has a backend URL; the backend
// itself is the in-memory one (`src/online/fake.ts`), so nothing leaves the test.
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, WIDTHS } from './setup';

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
  URL.createObjectURL ??= () => 'blob:test';
  URL.revokeObjectURL ??= () => {};
  HTMLAnchorElement.prototype.click = () => {};
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => {} },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe.each(WIDTHS)('accounts, backup and share links at %ipx (find-it, N130–N144)', (width) => {
  it('bare app → piece → notice → Saved data → sign in → In your account → share link → preview → account', async () => {
    const { user } = await renderApp(width);
    const { fakeBackend, fakeServer } = await import('../../src/online/fake');
    const client = await import('../../src/online/client');
    const server = fakeServer();
    client.setBackend(fakeBackend(server));
    // jsdom keeps one IndexedDB across the two widths: start each run empty, as a first visit.
    const { db } = await import('../../src/persist/db');
    await Promise.all(db.tables.map((t) => t.clear()));
    const places = () => within(screen.getByRole('navigation', { name: 'Places' }));

    // A saved piece.
    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const pick = await screen.findByRole('dialog');
    await user.click(within(pick).getAllByRole('button', { name: /Sideboard/ })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(async () => expect(await db.designs.count()).toBe(1), { timeout: 5000 }); // autosave
    await user.click(places().getByRole('link', { name: /Projects/ }));

    // N141 (ADR-140): the device-only notice with Back up and Sign in.
    const notice = await screen.findByText(/Your designs are only on this device/);
    const noticeBox = within(notice.closest('.device-only') as HTMLElement);
    expect(noticeBox.getByRole('button', { name: 'Sign in' })).toBeTruthy();

    // N134, N142 (ADR-133, ADR-141): Saved data — the .zip backup where folders are missing, the last backup, the
    // reminder interval.
    await user.click(noticeBox.getByRole('button', { name: 'Back up' }));
    let dlg = within(await screen.findByRole('dialog', { name: 'Saved data and backup' }));
    expect(dlg.getByText('Saved data')).toBeTruthy();
    await user.click(dlg.getByRole('button', { name: 'Download backup (.zip)' }));
    expect(await dlg.findByText(/Last backup: .* — \d+ items?/)).toBeTruthy();
    expect(dlg.getByLabelText('Remind me to back up')).toBeTruthy();
    expect(dlg.getByRole('button', { name: 'Restore a .zip' })).toBeTruthy();
    await user.click(dlg.getByRole('button', { name: 'Done' }));

    // N136, N137, N131 (ADR-135, ADR-136, ADR-130): the sign-in dialog.
    await user.click(screen.getByRole('button', { name: 'Account' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Sign in' }));
    expect(dlg.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    await user.click(dlg.getByRole('button', { name: 'Privacy notice' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Privacy notice' }));
    expect(dlg.getByText(/Supabase.*European Union/)).toBeTruthy();
    await user.click(dlg.getByRole('button', { name: 'Back' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Sign in' }));
    await user.click(dlg.getByRole('button', { name: 'Forgot password?' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Forgot password' }));
    await user.type(dlg.getByLabelText('Email'), 'me@example.com');
    await user.click(dlg.getByRole('button', { name: 'Send reset link' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Check your inbox' }));
    await user.click(dlg.getByRole('button', { name: 'Back to sign in' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Sign in' }));
    await user.click(dlg.getByRole('button', { name: 'Create account' }));
    dlg = within(await screen.findByRole('dialog', { name: 'Create account' }));
    await user.clear(dlg.getByLabelText('Email'));
    await user.type(dlg.getByLabelText('Email'), 'me@example.com');
    await user.type(dlg.getByLabelText('Password'), 'pw-123456');
    await user.click(dlg.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // N140, N138 (ADR-139, ADR-137): the sync status and the item's badge; the notice is gone.
    await waitFor(
      () => expect(document.querySelector('.sync-status')?.textContent).toMatch(/In your account/),
      { timeout: 5000 },
    );
    expect(await screen.findByText('In your account', { selector: '.badge' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText(/Your designs are only on this device/)).toBeNull(),
    );

    // N139, N144 (ADR-138, ADR-143): Share link → Make a link → Copy link; the link opens the preview → Open a copy.
    await user.click(screen.getByLabelText(/^Account actions for /));
    await user.click(screen.getByRole('button', { name: 'Share link' }));
    dlg = within(await screen.findByRole('dialog', { name: /^Share link: / }));
    await user.click(dlg.getByRole('button', { name: 'Make a link' }));
    const link = (await dlg.findByLabelText('Share link')) as HTMLInputElement;
    expect(dlg.getByRole('button', { name: /Copy link/ })).toBeTruthy();
    await user.click(dlg.getByRole('button', { name: 'Done' }));
    window.location.hash = link.value.slice(link.value.indexOf('#'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    dlg = within(await screen.findByRole('dialog', { name: /Sideboard/ }));
    expect(await dlg.findByText(/Piece · \d+ × \d+ × \d+ mm · \d+ parts/)).toBeTruthy();
    expect(dlg.getByRole('img', { name: /^Front view of / })).toBeTruthy();
    expect(dlg.getByRole('button', { name: 'Show in 3D' })).toBeTruthy();
    await user.click(dlg.getByRole('button', { name: 'Open a copy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // N138 (ADR-137): a record only in the account is listed under In your account.
    const b = (await import('../../src/online/client')).getBackend;
    const backend = await b();
    const { templates } = await import('../../src/core/design');
    await backend.saveRecord({
      kind: 'design',
      name: 'From my other phone',
      body: templates[0].create(),
      bodySchema: 3,
    });
    await user.click(places().getByRole('link', { name: /Projects/ }));
    const status = () => document.querySelector<HTMLButtonElement>('.sync-status')!;
    await user.click(status());
    dlg = within(await screen.findByRole('dialog', { name: 'Account' }));
    await user.click(dlg.getByRole('button', { name: 'Sync now' }));

    // N131, N143 (ADR-130, ADR-142): the account panel.
    expect(dlg.getByRole('button', { name: 'Export my data' })).toBeTruthy();
    expect(dlg.getByRole('button', { name: 'Delete my account' })).toBeTruthy();
    expect(dlg.getByRole('button', { name: 'Add another account' })).toBeTruthy();
    expect(dlg.getByText('Shared links')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    const section = await screen.findByRole('heading', { name: 'In your account' });
    expect(
      within(section.closest('section')!).getByText('From my other phone', { selector: 'strong' }),
    ).toBeTruthy();

    // N130 (ADR-129): offline, a change waits.
    server.offline = true;
    const row = (await db.designs.toArray())[0];
    await db.designs.put({
      ...row,
      name: 'Changed offline',
      design: { ...row.design, name: 'Changed offline' },
    });
    await client.sync();
    await waitFor(() => expect(status().textContent).toMatch(/Waiting for a connection/));
    expect(await screen.findByText('Waiting to upload', { selector: '.badge' })).toBeTruthy();

    // N130 (ADR-129): changed here and in the account too — both are kept.
    server.offline = false;
    // The account record of exactly this piece (two pieces are both named Sideboard).
    const own = (await db.accountLinks.toArray()).find((l) => l.localId === row.id)!;
    const rec = (await backend.listRecords()).find((r) => r.id === own.remoteId)!;
    await backend.saveRecord({
      id: rec.id,
      kind: 'design',
      name: 'Changed elsewhere',
      body: { ...(rec.body as object), name: 'Changed elsewhere' },
      bodySchema: 3,
      baseRevision: rec.revision,
    });
    await client.sync();
    await waitFor(() => expect(status().textContent).toMatch(/Kept both: 1/));
    expect(
      await screen.findByText('Changed elsewhere (from your account)', { selector: 'strong' }),
    ).toBeTruthy();

    // N135 (ADR-134, reading B): after a reload the account shows at once, offline too.
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    cleanup();
    await renderApp(width);
    expect((await screen.findByRole('button', { name: 'Account' })).textContent).toBe('M');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  });
});
