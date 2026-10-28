import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { RemoteRecord } from '../core/account';
import { STATE_LABEL, TABLE_OF, type LocalTable } from '../core/sync';
import {
  continueWithGoogle,
  createAccount,
  deleteMyAccount,
  exportMyData,
  saveNewPassword,
  sendReset,
  setDeviceOnly,
  signInWithPassword,
  signOut,
  switchTo,
  syncNow,
} from '../store/accountActions';
import {
  forgetAccount,
  online,
  useAccount,
  type AccountDialog as Dialogs,
} from '../store/accountStore';
import { useDesign } from '../store/designStore';
import { Dialog } from './Dialogs';
import { Icon } from './icons';

/** Offline: sign-in buttons are disabled with this line (ADR-136). */
function useOnline(): boolean {
  const [on, setOn] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false,
  );
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

const initial = (s: string) => (s.trim()[0] ?? '?').toUpperCase();

/** The Account button in the top bar (ADR-136, G-251): the initial once signed in. Hidden in a build with no backend. */
export function AccountButton() {
  const configured = useAccount((s) => s.configured);
  const user = useAccount((s) => s.user);
  const setDialog = useAccount((s) => s.setDialog);
  if (!configured) return null;
  return (
    <button
      type="button"
      className={`btn icon account-btn${user ? ' signed-in' : ''}`}
      aria-label="Account"
      title={user ? `Signed in as ${user.email}` : 'Sign in'}
      onClick={() => setDialog(user ? 'account' : 'sign-in')}
    >
      {user ? (
        <span className="account-initial">{initial(user.name || user.email)}</span>
      ) : (
        <Icon name="user" />
      )}
    </button>
  );
}

/** The sync status beside the save status (ADR-139, G-260): failures stay until resolved. */
export function SyncStatus() {
  const user = useAccount((s) => s.user);
  const sync = useAccount((s) => s.sync);
  const setDialog = useAccount((s) => s.setDialog);
  if (!user) return null;
  const text = !sync
    ? 'Your account'
    : sync.state === 'syncing'
      ? 'Uploading…'
      : sync.state === 'offline'
        ? `Waiting for a connection${sync.waiting ? ` (${sync.waiting})` : ''}`
        : sync.state === 'error'
          ? 'Upload failed — Retry'
          : sync.conflicts.length
            ? `Kept both: ${sync.conflicts.length}`
            : sync.waiting
              ? `Waiting to upload (${sync.waiting})`
              : 'In your account';
  const tone =
    sync?.state === 'error'
      ? 'failed'
      : sync?.state === 'syncing'
        ? 'saving'
        : sync?.state === 'offline'
          ? 'waiting'
          : 'saved';
  return (
    <button
      type="button"
      className={`status sync-status ${tone}`}
      title={sync?.error ?? text}
      onClick={() => (sync?.state === 'error' ? void syncNow() : setDialog('account'))}
    >
      <Icon name="cloud" className="sm" />
      <span className="txt">{text}</span>
    </button>
  );
}

/** An own item's badge while signed in (ADR-137): In your account, Waiting to upload, Only on this device. */
export function AccountBadge({ table, id }: { table: LocalTable; id: string }) {
  const state = useAccount((s) => (s.user ? s.sync?.items[`${table}:${id}`] : undefined));
  if (!state) return null;
  return (
    <span className={`badge account-badge ${state}`} title={STATE_LABEL[state]}>
      {STATE_LABEL[state]}
    </span>
  );
}

/** An own item's account actions (ADR-137, ADR-138): Share link, Keep on this device only / Save to account. */
export function AccountRowActions({
  table,
  id,
  name,
}: {
  table: LocalTable;
  id: string;
  name: string;
}) {
  const user = useAccount((s) => s.user);
  const state = useAccount((s) => s.sync?.items[`${table}:${id}`]);
  const set = useAccount((s) => s.set);
  if (!user) return null;
  return (
    <details className="menu row-menu account-row">
      <summary className="btn sm icon" aria-label={`Account actions for ${name}`} title="Account">
        <Icon name="cloud" className="sm" />
      </summary>
      <div className="menu-items">
        <button type="button" onClick={() => set({ shareFor: { table, id, name } })}>
          <Icon name="link" />
          Share link
        </button>
        {state === 'device-only' ? (
          <button type="button" onClick={() => void setDeviceOnly(table, id, false)}>
            <Icon name="cloud" />
            Save to account
          </button>
        ) : (
          <button type="button" onClick={() => void setDeviceOnly(table, id, true)}>
            <Icon name="hdd" />
            Keep on this device only <small>removes it from your account</small>
          </button>
        )}
      </div>
    </details>
  );
}

/** "In your account": account items that are not on this device, with Open (ADR-137). */
export function InYourAccount({ onOpened }: { onOpened: () => void }) {
  const user = useAccount((s) => s.user);
  const elsewhere = useAccount((s) => s.sync?.elsewhere);
  const [msg, setMsg] = useState<string | null>(null);
  if (!user || !elsewhere?.length) return null;
  const open = async (r: RemoteRecord) => {
    const c = await online();
    const res = await c.openFromAccount(r);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    if (res.table === 'designs') {
      const { loadDesign } = await import('../persist/db');
      const d = await loadDesign(res.id);
      if (d) {
        useDesign.getState().load(d, { fromStorage: true });
        onOpened();
      }
    } else setMsg(`“${r.name}” is now in Catalog › Templates on this device.`);
  };
  return (
    <section className="home-section" aria-labelledby="home-account">
      <div className="home-section-head">
        <h2 id="home-account">In your account</h2>
      </div>
      {msg && (
        <p className="alert info" role="status">
          {msg}
        </p>
      )}
      <ul className="library">
        {elsewhere.map((r) => (
          <li key={r.id}>
            <button type="button" className="row-btn" onClick={() => void open(r)}>
              <span className="glyph">
                <Icon name={r.kind === 'template' ? 'catalog' : 'cube'} />
              </span>
              <span>
                <strong>{r.name}</strong>
                <span className="sub">
                  {r.kind === 'template' ? 'Template' : 'Piece'} · not on this device · Open
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
  error,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  error?: string | null;
}) {
  const id = `acct-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-describedby={error ? 'acct-error' : hint ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
    </div>
  );
}

const PASSWORD_HINT =
  'The sign-in service sets the minimum length and says if a password is too short.';

/** The account dialog and every state of ADR-136. Each state starts with empty password fields. */
export function AccountDialog() {
  const dialog = useAccount((s) => s.dialog);
  return dialog ? <AccountDialogState key={dialog} dialog={dialog} /> : null;
}

function AccountDialogState({ dialog }: { dialog: NonNullable<Dialogs> }) {
  const setDialog = useAccount((s) => s.setDialog);
  const user = useAccount((s) => s.user);
  const busy = useAccount((s) => s.busy);
  const error = useAccount((s) => s.error);
  const email = useAccount((s) => s.email);
  const setEmail = useAccount((s) => s.setEmail);
  const known = useAccount((s) => s.known);
  const isOnline = useOnline();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [typed, setTyped] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const close = () => setDialog(null);
  const offline = !isOnline && (
    <p className="alert info" role="status">
      <Icon name="info" className="sm" />
      <span>You are offline. Your designs still work on this device.</span>
    </p>
  );
  const err = error && (
    <p className="alert error" role="alert" id="acct-error">
      <Icon name="alert-circle" className="sm" />
      <span>{error}</span>
    </p>
  );
  const submit = (f: () => void) => (e: FormEvent) => {
    e.preventDefault();
    f();
  };
  const privacyLink = (
    <button type="button" className="btn link" onClick={() => setDialog('privacy')}>
      Privacy notice
    </button>
  );
  let title: string;
  let body: ReactNode;
  if (dialog === 'sign-in' || dialog === 'create') {
    const creating = dialog === 'create';
    title = creating ? 'Create account' : 'Sign in';
    body = (
      <form
        className="account-form"
        onSubmit={submit(
          () => void (creating ? createAccount : signInWithPassword)(email.trim(), password),
        )}
      >
        <p>
          Sign in to save your pieces and templates to your account. Everything still works on this
          device without an account.
        </p>
        {offline}
        <button
          type="button"
          className="btn outline block"
          disabled={busy || !isOnline}
          onClick={() => void continueWithGoogle()}
        >
          Continue with Google
        </button>
        <p className="or" aria-hidden="true">
          or
        </p>
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={error}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={creating ? 'new-password' : 'current-password'}
          hint={creating ? PASSWORD_HINT : undefined}
          error={error}
        />
        {err}
        <button
          type="submit"
          className={`btn primary block${busy ? ' loading' : ''}`}
          disabled={busy || !isOnline || !email.trim() || !password}
        >
          {creating ? 'Create account' : 'Sign in'}
        </button>
        <p className="hint">
          Your sign-in is kept on this device so the app opens signed in, offline too.
        </p>
        <div className="account-links">
          {!creating && (
            <button type="button" className="btn link" onClick={() => setDialog('forgot')}>
              Forgot password?
            </button>
          )}
          <button
            type="button"
            className="btn link"
            onClick={() => setDialog(creating ? 'sign-in' : 'create')}
          >
            {creating ? 'I have an account' : 'Create account'}
          </button>
          {privacyLink}
        </div>
      </form>
    );
  } else if (dialog === 'forgot') {
    title = 'Forgot password';
    body = (
      <form className="account-form" onSubmit={submit(() => void sendReset(email.trim()))}>
        <p>We will send a link to reset your password.</p>
        {offline}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={error}
        />
        {err}
        <button
          type="submit"
          className={`btn primary block${busy ? ' loading' : ''}`}
          disabled={busy || !isOnline || !email.trim()}
        >
          Send reset link
        </button>
        <div className="account-links">
          <button type="button" className="btn link" onClick={() => setDialog('sign-in')}>
            Back to sign in
          </button>
        </div>
      </form>
    );
  } else if (dialog === 'forgot-sent') {
    title = 'Check your inbox';
    body = (
      <div className="account-form">
        <p role="status">If an account exists for {email}, we sent a link. Check your inbox.</p>
        <button type="button" className="btn block" onClick={() => setDialog('sign-in')}>
          Back to sign in
        </button>
      </div>
    );
  } else if (dialog === 'reset') {
    title = 'Reset password';
    body = (
      <form
        className="account-form"
        onSubmit={submit(() => {
          if (password !== confirm) {
            setMismatch(true);
            return;
          }
          void saveNewPassword(password);
        })}
      >
        <Field
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={error}
        />
        <Field
          label="Confirm"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={mismatch ? 'x' : null}
        />
        {mismatch && (
          <p className="alert error" role="alert">
            The two passwords are not the same.
          </p>
        )}
        {err}
        {error && /expired/i.test(error) && (
          <button type="button" className="btn block" onClick={() => setDialog('forgot')}>
            Send a new link
          </button>
        )}
        <button
          type="submit"
          className={`btn primary block${busy ? ' loading' : ''}`}
          disabled={busy || !password || !confirm}
        >
          Save new password
        </button>
      </form>
    );
  } else if (dialog === 'account' && user) {
    title = 'Account';
    body = <AccountPanel />;
  } else if (dialog === 'sign-out' && user) {
    title = 'Sign out';
    body = (
      <div className="account-form">
        <p>Sign out of {user.email}? Your designs stay on this device.</p>
        <button
          type="button"
          className={`btn outline block${busy ? ' loading' : ''}`}
          disabled={busy}
          onClick={() => void signOut(false)}
        >
          Sign out
        </button>
        <button
          type="button"
          className="btn danger block"
          disabled={busy}
          onClick={() => void signOut(true)}
        >
          Sign out and remove this account’s copies from this device
        </button>
        <button type="button" className="btn ghost block" onClick={() => setDialog('account')}>
          Cancel
        </button>
      </div>
    );
  } else if (dialog === 'delete' && user) {
    title = 'Delete my account';
    body = (
      <form className="account-form" onSubmit={submit(() => void deleteMyAccount())}>
        <p>
          This deletes your account, every item saved in it and every share link, at once. It cannot
          be undone. Your designs on this device stay. Type your email to confirm.
        </p>
        <Field
          label="Your email"
          type="email"
          value={typed}
          onChange={setTyped}
          autoComplete="off"
        />
        {err}
        <button
          type="submit"
          className={`btn danger block${busy ? ' loading' : ''}`}
          disabled={busy || !isOnline || typed.trim() !== user.email}
        >
          Delete my account
        </button>
        <button type="button" className="btn ghost block" onClick={() => setDialog('account')}>
          Cancel
        </button>
      </form>
    );
  } else if (dialog === 'privacy') {
    title = 'Privacy notice';
    body = <PrivacyNotice />;
  } else return null;
  return (
    <Dialog open onClose={close} title={title}>
      <div className="account-dialog">{body}</div>
      {known.length > 0 && (dialog === 'sign-in' || dialog === 'create') && (
        <div className="account-known">
          <p className="hint">Used on this device:</p>
          {known.map((k) => (
            <span key={k.user.id} className="account-known-row">
              <button type="button" className="btn sm" onClick={() => setEmail(k.user.email)}>
                {k.user.email}
              </button>
              <button
                type="button"
                className="btn sm ghost"
                aria-label={`Forget ${k.user.email} on this device`}
                onClick={() => forgetAccount(k.user.id)}
              >
                <Icon name="x" className="sm" />
              </button>
            </span>
          ))}
        </div>
      )}
    </Dialog>
  );
}

/** Signed in: who, sync, other accounts, privacy actions and Sign out (ADR-130, ADR-136, ADR-139, ADR-142). */
function AccountPanel() {
  const user = useAccount((s) => s.user)!;
  const sync = useAccount((s) => s.sync);
  const known = useAccount((s) => s.known);
  const busy = useAccount((s) => s.busy);
  const error = useAccount((s) => s.error);
  const setDialog = useAccount((s) => s.setDialog);
  const others = known.filter((k) => k.user.id !== user.id);
  return (
    <div className="account-form">
      <p className="account-who">
        <span className="account-initial lg">{initial(user.name || user.email)}</span>
        <span>
          {user.name && <strong>{user.name}</strong>}
          <span className="sub">{user.email}</span>
          <span className="sub">
            {user.provider === 'google' ? 'Signed in with Google' : 'Signed in with email'}
          </span>
        </span>
      </p>
      {sync && (
        <p className="hint" role="status">
          {sync.state === 'offline'
            ? 'Offline: changes wait on this device and upload when you are back online.'
            : sync.waiting
              ? `${sync.waiting} waiting to upload.`
              : 'Everything is in your account.'}
          {sync.conflicts.length > 0 &&
            ` Changed on two devices, both kept: ${sync.conflicts.join(', ')}.`}
        </p>
      )}
      <button type="button" className="btn" disabled={busy} onClick={() => void syncNow()}>
        <Icon name="refresh" className="sm" />
        Sync now
      </button>
      <SharedLinks />
      {others.length > 0 && (
        <div className="account-switch">
          <p className="hint">Other accounts on this device</p>
          {others.map((k) => (
            <button
              key={k.user.id}
              type="button"
              className="btn sm"
              onClick={() => void switchTo(k.user.email)}
            >
              Switch to {k.user.email}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn" onClick={() => void switchTo('')}>
        <Icon name="plus" className="sm" />
        Add another account
      </button>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn" disabled={busy} onClick={() => void exportMyData()}>
          <Icon name="download" className="sm" />
          Export my data
        </button>
        <button type="button" className="btn danger" onClick={() => setDialog('delete')}>
          Delete my account
        </button>
      </div>
      <button type="button" className="btn outline block" onClick={() => setDialog('sign-out')}>
        Sign out
      </button>
      <button type="button" className="btn link" onClick={() => setDialog('privacy')}>
        Privacy notice
      </button>
    </div>
  );
}

/** Your share links with Stop sharing (ADR-138, G-259). */
function SharedLinks() {
  const [list, setList] = useState<
    { id: string; name: string; stoppedAt?: string | null }[] | null
  >(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    online()
      .then((c) => c.listShares())
      .then(
        (l) => live && setList(l),
        () => live && setList([]),
      );
    return () => {
      live = false;
    };
  }, [round]);
  const live = (list ?? []).filter((s) => !s.stoppedAt);
  if (!live.length) return null;
  return (
    <div className="shared-links">
      <p className="hint">Shared links</p>
      <ul className="plain">
        {live.map((s) => (
          <li key={s.id}>
            <span>{s.name || 'Item'}</span>
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                await (await online()).stopShare(s.id);
                setRound((n) => n + 1);
              }}
            >
              Stop sharing
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The privacy notice (ADR-130), in English (G-231). Engineering guidance, not legal advice; not reviewed by a lawyer
 * (G-233, the user's decision).
 */
export function PrivacyNotice() {
  const setDialog = useAccount((s) => s.setDialog);
  const user = useAccount((s) => s.user);
  return (
    <div className="privacy">
      <p>
        Furniture Builder works on this device without an account and then sends nothing anywhere.
        This notice is about the optional account.
      </p>
      <h3>Who is responsible</h3>
      <p>
        The app’s owner, a private person. Contact:{' '}
        <a href="mailto:Beliserii@gmail.com">Beliserii@gmail.com</a>.
      </p>
      <h3>What is stored, and why</h3>
      <ul>
        <li>Your email address, and your name if you sign in with Google: to sign you in.</li>
        <li>
          The pieces and templates you save to your account, and the board pictures they use: to
          keep them for you and open them on your other devices.
        </li>
        <li>The share links you make: so people with a link can open a copy of that item.</li>
      </ul>
      <p>No tracking, analytics or advertising. Nothing is sold or shared for marketing.</p>
      <h3>Where</h3>
      <p>
        With Supabase, the app’s database and sign-in service, in a data centre in the European
        Union. Google signs you in when you choose Continue with Google.
      </p>
      <h3>On this device</h3>
      <p>
        Your sign-in is kept in this browser’s storage so the app opens signed in, offline too. It
        is strictly needed for the account you asked for; nothing else is stored for the account.
      </p>
      <h3>How long</h3>
      <p>
        Until you delete it. An item you delete stays in your account’s Trash for 7 days. Delete my
        account removes your account, every item in it and every share link at once; the service’s
        own backups age out on its schedule.
      </p>
      <h3>Your rights</h3>
      <p>
        You can see and download your data (Export my data), correct it, and delete it (Delete my
        account), or write to the contact above. You can also complain to the Romanian data
        protection authority (ANSPDCP).
      </p>
      <button
        type="button"
        className="btn block"
        onClick={() => setDialog(user ? 'account' : 'sign-in')}
      >
        Back
      </button>
    </div>
  );
}

/** For lists: the table of a record kind. */
export const tableOf = TABLE_OF;
