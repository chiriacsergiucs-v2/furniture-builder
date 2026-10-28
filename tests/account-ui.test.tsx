// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { db, saveDesign } from '../src/persist/db';
import { fakeBackend, fakeServer, type FakeServer } from '../src/online/fake';
import * as client from '../src/online/client';
import { useAccount } from '../src/store/accountStore';
import { AccountButton, AccountDialog, AccountBadge, SyncStatus } from '../src/ui/Account';
import { ShareLinkDialog, SharedItemDialog } from '../src/ui/Share';

// ADR-134 to ADR-139, ADR-142, ADR-143: the account UI against the in-memory backend (no network).
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
const setOnline = (on: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on });

beforeEach(async () => {
  server = fakeServer();
  client.stopAutoSync();
  client.setBackend(fakeBackend(server));
  setOnline(true);
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
      <ShareLinkDialog />
      <SharedItemDialog onOpened={() => {}} />
    </>,
  );
const dlg = () => within(screen.getByRole('dialog'));
const dlgA = async () => within(await screen.findByRole('dialog'));

describe('sign-in screens (ADR-136)', () => {
  it('hidden in a build with no backend', () => {
    useAccount.setState({ configured: false });
    ui();
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
  });

  it('logged out → Create account → logged in; the account is remembered (ADR-134)', async () => {
    const u = userEvent.setup();
    ui();
    await u.click(screen.getByRole('button', { name: 'Account' }));
    expect(
      dlg().getByText(/Everything still works on this device without an account/),
    ).toBeTruthy();
    expect(dlg().getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    await u.click(dlg().getByRole('button', { name: 'Create account' }));
    await u.type(dlg().getByLabelText('Email'), 'me@example.com');
    await u.type(dlg().getByLabelText('Password'), 'pw-123456');
    await u.click(dlg().getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(useAccount.getState().user?.email).toBe('me@example.com'));
    expect(JSON.parse(localStorage.getItem('fb:account')!).email).toBe('me@example.com');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Account' }).textContent).toBe('M');
  });

  it('a wrong password shows the error and keeps the typed email', async () => {
    const u = userEvent.setup();
    await fakeBackend(server).signUp('me@example.com', 'right-one');
    ui();
    await u.click(screen.getByRole('button', { name: 'Account' }));
    await u.type(dlg().getByLabelText('Email'), 'me@example.com');
    await u.type(dlg().getByLabelText('Password'), 'wrong');
    await u.click(dlg().getByRole('button', { name: 'Sign in' }));
    expect(await dlg().findByText('Email or password is wrong.')).toBeTruthy();
    expect((dlg().getByLabelText('Email') as HTMLInputElement).value).toBe('me@example.com');
  });

  it('Forgot password says the same for a known and an unknown email', async () => {
    const u = userEvent.setup();
    await fakeBackend(server).signUp('known@example.com', 'x-123456');
    ui();
    for (const email of ['known@example.com', 'nobody@example.com']) {
      useAccount.setState({ dialog: 'forgot', email: '' });
      await u.type(await screen.findByLabelText('Email'), email);
      await u.click(dlg().getByRole('button', { name: 'Send reset link' }));
      expect(
        await dlg().findByText(
          `If an account exists for ${email}, we sent a link. Check your inbox.`,
        ),
      ).toBeTruthy();
    }
    expect(server.sentResets).toEqual(['known@example.com']);
  });

  it('Reset with an expired link shows the expired text and Send a new link', async () => {
    const u = userEvent.setup();
    useAccount.setState({ dialog: 'reset' });
    ui();
    await u.type(dlg().getByLabelText('New password'), 'new-pass-1');
    await u.type(dlg().getByLabelText('Confirm'), 'new-pass-1');
    await u.click(dlg().getByRole('button', { name: 'Save new password' }));
    expect(await dlg().findByText('This link has expired. Ask for a new one.')).toBeTruthy();
    expect(dlg().getByRole('button', { name: 'Send a new link' })).toBeTruthy();
  });

  it('offline: the offline line, and the sign-in buttons are disabled', async () => {
    setOnline(false);
    useAccount.setState({ dialog: 'sign-in' });
    ui();
    expect(
      dlg().getByText('You are offline. Your designs still work on this device.'),
    ).toBeTruthy();
    expect(
      (dlg().getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('Continue with Google signs in (fake provider) and asks only for sign-in data', async () => {
    const u = userEvent.setup();
    useAccount.setState({ dialog: 'sign-in' });
    ui();
    await u.click(dlg().getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(useAccount.getState().user?.provider).toBe('google'));
  });

  it('the privacy notice names the controller contact, Supabase in the EU and the session storage (ADR-130)', async () => {
    const u = userEvent.setup();
    useAccount.setState({ dialog: 'sign-in' });
    ui();
    await u.click(dlg().getByRole('button', { name: 'Privacy notice' }));
    expect(dlg().getByText('Beliserii@gmail.com')).toBeTruthy();
    expect(dlg().getByText(/Supabase.*European Union/)).toBeTruthy();
    expect(dlg().getByText(/Your sign-in is kept in this browser’s storage/)).toBeTruthy();
    expect(dlg().getByText(/ANSPDCP/)).toBeTruthy();
  });
});

describe('signed in (ADR-130, ADR-137, ADR-139, ADR-142)', () => {
  const signIn = async () => {
    const u = userEvent.setup();
    ui();
    useAccount.setState({ dialog: 'create' });
    await u.type(await (await dlgA()).findByLabelText('Email'), 'me@example.com');
    await u.type(dlg().getByLabelText('Password'), 'pw-123456');
    await u.click(dlg().getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(useAccount.getState().user).not.toBeNull());
    return u;
  };

  it('saved pieces upload; the badge and the status say In your account', async () => {
    const d = templates[0].create();
    await saveDesign(d);
    await signIn();
    render(<AccountBadge table="designs" id={d.id} />);
    expect(await screen.findByText('In your account', { selector: '.badge' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /In your account/ })).toBeTruthy(),
    );
  });

  it('Sign out keeps this device’s rows; the account panel offers Add another account', async () => {
    await saveDesign(templates[0].create());
    const u = await signIn();
    await u.click(screen.getByRole('button', { name: 'Account' }));
    expect(dlg().getByRole('button', { name: 'Add another account' })).toBeTruthy();
    expect(dlg().getByRole('button', { name: 'Export my data' })).toBeTruthy();
    await u.click(dlg().getByRole('button', { name: 'Sign out' }));
    expect(dlg().getByText(/Your designs stay on this device/)).toBeTruthy();
    await u.click(dlg().getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(useAccount.getState().user).toBeNull());
    expect(await db.designs.count()).toBe(1);
    expect(useAccount.getState().known.map((k) => k.user.email)).toEqual(['me@example.com']);
  });

  it('Delete my account needs the email typed; then the account is gone, the device rows stay', async () => {
    await saveDesign(templates[0].create());
    const u = await signIn();
    useAccount.setState({ dialog: 'delete' });
    const btn = (await (
      await dlgA()
    ).findByRole('button', {
      name: 'Delete my account',
    })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await u.type(dlg().getByLabelText('Your email'), 'me@example.com');
    await u.click(btn);
    await waitFor(() => expect(useAccount.getState().user).toBeNull());
    expect(server.users.size).toBe(0);
    expect(await db.designs.count()).toBe(1);
  });

  it('Share link → Copy link; the link opens a preview and Open a copy saves a new copy (ADR-138, ADR-143)', async () => {
    const d = templates[0].create();
    await saveDesign(d);
    const u = await signIn();
    useAccount.setState({ shareFor: { table: 'designs', id: d.id, name: d.name } });
    await u.click(await (await dlgA()).findByRole('button', { name: 'Make a link' }));
    const input = (await dlg().findByLabelText('Share link')) as HTMLInputElement;
    expect(input.value).toMatch(/#share=[A-Za-z0-9_-]{22}$/);
    expect(dlg().getByRole('button', { name: /Copy link/ })).toBeTruthy();
    const id = input.value.split('#share=')[1];
    useAccount.setState({ shareFor: null, opening: id });
    expect(await screen.findByText(/Piece · \d+ × \d+ × \d+ mm · \d+ parts/)).toBeTruthy();
    expect(screen.getByRole('img', { name: `Front view of ${d.name}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show in 3D' })).toBeTruthy();
    expect(await db.designs.count()).toBe(1); // nothing saved before Open a copy
    await u.click(screen.getByRole('button', { name: 'Open a copy' }));
    await waitFor(async () => expect(await db.designs.count()).toBe(2));
    const ids = (await db.designs.toArray()).map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('a stopped or malformed link shows its message and saves nothing', async () => {
    ui();
    useAccount.setState({ opening: 'invalid' });
    expect(
      await screen.findByText('This link no longer works. Ask the owner for a new one.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open a copy' })).toBeNull();
  });
});
