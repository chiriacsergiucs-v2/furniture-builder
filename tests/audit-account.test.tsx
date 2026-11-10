// @vitest-environment jsdom
// ADR-264 (UI audit, Account), against the in-memory backend (no request leaves the test): a failed account delete
// keeps the automatic upload running, Keep on this device only says a failure, the password mismatch clears when the
// user types again and Confirm points to it, Account › Shared links says a failed Stop sharing (D17-F3, ADR-263), and
// the conflict copy's name goes through t().
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { templates } from '../src/core/design';
import { t } from '../src/core/i18n';
import { db, saveDesign } from '../src/persist/db';
import { fakeBackend, fakeServer, type FakeServer } from '../src/online/fake';
import * as client from '../src/online/client';
import { useAccount } from '../src/store/accountStore';
import { AccountButton, AccountDialog, AccountRowActions, SyncStatus } from '../src/ui/Account';

vi.stubGlobal('fetch', () => {
  throw new Error('real fetch attempted');
});
beforeAll(() => {
  const d = HTMLDialogElement.prototype;
  d.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  d.close ??= function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});
let server: FakeServer;
beforeEach(async () => {
  server = fakeServer();
  client.stopAutoSync();
  client.setBackend(fakeBackend(server));
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  localStorage.clear();
  useAccount.setState({
    configured: true,
    user: null,
    known: [],
    dialog: null,
    email: '',
    error: null,
    sync: null,
    busy: false,
    shareFor: null,
    opening: null,
    hidden: new Set(),
  });
  await db.designs.clear();
  await db.accountLinks.clear();
});
afterEach(() => cleanup());
const ui = () =>
  render(
    <>
      <SyncStatus />
      <AccountButton />
      <AccountDialog />
    </>,
  );
const dlg = () => within(screen.getByRole('dialog'));
const signIn = async () => {
  const u = userEvent.setup();
  ui();
  useAccount.setState({ dialog: 'create' });
  await u.type(
    await within(await screen.findByRole('dialog')).findByLabelText('Email'),
    'me@example.com',
  );
  await u.type(dlg().getByLabelText('Password'), 'pw-123456');
  await u.click(dlg().getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(useAccount.getState().user).not.toBeNull());
  return u;
};

describe('ADR-264 account', () => {
  it('a failed account delete leaves the automatic upload running', async () => {
    const u = await signIn();
    await waitFor(() => expect(useAccount.getState().sync?.state).toBe('idle'));
    useAccount.setState({ dialog: 'delete' });
    await u.type(
      await within(await screen.findByRole('dialog')).findByLabelText('Your email'),
      'me@example.com',
    );
    server.offline = true;
    await u.click(dlg().getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeNull());
    server.offline = false;
    await saveDesign(templates[0].create());
    await waitFor(() => expect(server.records.size).toBe(1), { timeout: 8000 });
  }, 20000);

  it('Keep on this device only offline says it could not be taken out; Stop sharing offline says why', async () => {
    const d = templates[0].create();
    await saveDesign(d);
    const u = await signIn();
    await waitFor(() => expect(server.records.size).toBe(1));
    await client.createShare('designs', d.id);
    render(<AccountRowActions table="designs" id={d.id} name="Mine" />);
    useAccount.setState({ dialog: 'account' });
    const stop = await within(await screen.findByRole('dialog')).findByRole('button', {
      name: 'Stop sharing',
    });
    server.offline = true;
    await u.click(stop);
    expect(await dlg().findByRole('alert')).toBeTruthy();
    useAccount.setState({ dialog: null });
    await u.click(
      screen.getByRole('button', { name: 'Keep on this device only removes it from your account' }),
    );
    expect(
      await screen.findByText(
        'It could not be taken out of your account. Check your connection and try again.',
      ),
    ).toBeTruthy();
  }, 20000);

  it('the password mismatch clears when the user types again; Confirm points to it', async () => {
    const u = userEvent.setup();
    useAccount.setState({ dialog: 'reset' });
    ui();
    await u.type(dlg().getByLabelText('New password'), 'new-pass-1');
    await u.type(dlg().getByLabelText('Confirm'), 'new-pass-2');
    await u.click(dlg().getByRole('button', { name: 'Save new password' }));
    const c = dlg().getByLabelText('Confirm');
    expect(c.getAttribute('aria-describedby')).toBe('acct-mismatch');
    expect(dlg().getByText('The two passwords are not the same.').id).toBe('acct-mismatch');
    await u.type(c, 'x');
    expect(dlg().queryByText('The two passwords are not the same.')).toBeNull();
  });

  it('the conflict copy suffix is a translated text', () => {
    expect(t('{name} (from your account)', { name: 'Desk' })).toBe('Desk (from your account)');
  });
});
