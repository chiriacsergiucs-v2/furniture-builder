import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { RemoteRecord } from '../core/account';
import { t, type Key } from '../core/i18n';
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
import { tNode } from './i18n';
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
      aria-label={t('Account')}
      title={user ? t('Signed in as {email}', { email: user.email }) : t('Sign in')}
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
    ? t('Your account')
    : sync.state === 'syncing'
      ? t('Uploading…')
      : sync.state === 'offline'
        ? sync.waiting
          ? t('Waiting for a connection ({n})', { n: sync.waiting })
          : t('Waiting for a connection')
        : sync.state === 'error'
          ? t('Upload failed — Retry')
          : sync.conflicts.length
            ? t('Kept both: {n}', { n: sync.conflicts.length })
            : sync.waiting
              ? t('Waiting to upload ({n})', { n: sync.waiting })
              : t('In your account');
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
      <summary
        className="btn sm icon"
        aria-label={t('Account actions for {name}', { name })}
        title={t('Account')}
      >
        <Icon name="cloud" className="sm" />
      </summary>
      <div className="menu-items">
        <button type="button" onClick={() => set({ shareFor: { table, id, name } })}>
          <Icon name="link" />
          {t('Share link')}
        </button>
        {state === 'device-only' ? (
          <button type="button" onClick={() => void setDeviceOnly(table, id, false)}>
            <Icon name="cloud" />
            {t('Save to account')}
          </button>
        ) : (
          <button type="button" onClick={() => void setDeviceOnly(table, id, true)}>
            <Icon name="hdd" />
            {t('Keep on this device only')} <small>{t('removes it from your account')}</small>
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
    } else setMsg(t('“{name}” is now in Catalog › Templates on this device.', { name: r.name }));
  };
  return (
    <section className="home-section" aria-labelledby="home-account">
      <div className="home-section-head">
        <h2 id="home-account">{t('In your account')}</h2>
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
                  {r.kind === 'template' ? t('Template') : t('Piece')} · {t('not on this device')} ·{' '}
                  {t('Open')}
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
  label: Key;
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
      <label htmlFor={id}>{t(label)}</label>
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

const PASSWORD_HINT = t(
  'The sign-in service sets the minimum length and says if a password is too short.',
);

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
      <span>{t('You are offline. Your designs still work on this device.')}</span>
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
      {t('Privacy notice')}
    </button>
  );
  let title: string;
  let body: ReactNode;
  if (dialog === 'sign-in' || dialog === 'create') {
    const creating = dialog === 'create';
    title = creating ? t('Create account') : t('Sign in');
    body = (
      <form
        className="account-form"
        onSubmit={submit(
          () => void (creating ? createAccount : signInWithPassword)(email.trim(), password),
        )}
      >
        <p>
          {t(
            'Sign in to save your pieces and templates to your account. Everything still works on this device without an account.',
          )}
        </p>
        {offline}
        <button
          type="button"
          className="btn outline block"
          disabled={busy || !isOnline}
          onClick={() => void continueWithGoogle()}
        >
          {t('Continue with Google')}
        </button>
        <p className="or" aria-hidden="true">
          {t('or')}
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
          {creating ? t('Create account') : t('Sign in')}
        </button>
        <p className="hint">
          {t('Your sign-in is kept on this device so the app opens signed in, offline too.')}
        </p>
        <div className="account-links">
          {!creating && (
            <button type="button" className="btn link" onClick={() => setDialog('forgot')}>
              {t('Forgot password?')}
            </button>
          )}
          <button
            type="button"
            className="btn link"
            onClick={() => setDialog(creating ? 'sign-in' : 'create')}
          >
            {creating ? t('I have an account') : t('Create account')}
          </button>
          {privacyLink}
        </div>
      </form>
    );
  } else if (dialog === 'forgot') {
    title = t('Forgot password');
    body = (
      <form className="account-form" onSubmit={submit(() => void sendReset(email.trim()))}>
        <p>{t('We will send a link to reset your password.')}</p>
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
          {t('Send reset link')}
        </button>
        <div className="account-links">
          <button type="button" className="btn link" onClick={() => setDialog('sign-in')}>
            {t('Back to sign in')}
          </button>
        </div>
      </form>
    );
  } else if (dialog === 'forgot-sent') {
    title = t('Check your inbox');
    body = (
      <div className="account-form">
        <p role="status">
          {t('If an account exists for {email}, we sent a link. Check your inbox.', { email })}
        </p>
        <button type="button" className="btn block" onClick={() => setDialog('sign-in')}>
          {t('Back to sign in')}
        </button>
      </div>
    );
  } else if (dialog === 'reset') {
    title = t('Reset password');
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
            {t('The two passwords are not the same.')}
          </p>
        )}
        {err}
        {error &&
          (/expired/i.test(error) || error === t('This link has expired. Ask for a new one.')) && (
            <button type="button" className="btn block" onClick={() => setDialog('forgot')}>
              {t('Send a new link')}
            </button>
          )}
        <button
          type="submit"
          className={`btn primary block${busy ? ' loading' : ''}`}
          disabled={busy || !password || !confirm}
        >
          {t('Save new password')}
        </button>
      </form>
    );
  } else if (dialog === 'account' && user) {
    title = t('Account');
    body = <AccountPanel />;
  } else if (dialog === 'sign-out' && user) {
    title = t('Sign out');
    body = (
      <div className="account-form">
        <p>{t('Sign out of {email}? Your designs stay on this device.', { email: user.email })}</p>
        <button
          type="button"
          className={`btn outline block${busy ? ' loading' : ''}`}
          disabled={busy}
          onClick={() => void signOut(false)}
        >
          {t('Sign out')}
        </button>
        <button
          type="button"
          className="btn danger block"
          disabled={busy}
          onClick={() => void signOut(true)}
        >
          {t('Sign out and remove this account’s copies from this device')}
        </button>
        <button type="button" className="btn ghost block" onClick={() => setDialog('account')}>
          {t('Cancel')}
        </button>
      </div>
    );
  } else if (dialog === 'delete' && user) {
    title = t('Delete my account');
    body = (
      <form className="account-form" onSubmit={submit(() => void deleteMyAccount())}>
        <p>
          {t(
            'This deletes your account, every item saved in it and every share link, at once. It cannot be undone. Your designs on this device stay. Type your email to confirm.',
          )}
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
          {t('Delete my account')}
        </button>
        <button type="button" className="btn ghost block" onClick={() => setDialog('account')}>
          {t('Cancel')}
        </button>
      </form>
    );
  } else if (dialog === 'privacy') {
    title = t('Privacy notice');
    body = <PrivacyNotice />;
  } else return null;
  return (
    <Dialog open onClose={close} title={title}>
      <div className="account-dialog">{body}</div>
      {known.length > 0 && (dialog === 'sign-in' || dialog === 'create') && (
        <div className="account-known">
          <p className="hint">{t('Used on this device:')}</p>
          {known.map((k) => (
            <span key={k.user.id} className="account-known-row">
              <button type="button" className="btn sm" onClick={() => setEmail(k.user.email)}>
                {k.user.email}
              </button>
              <button
                type="button"
                className="btn sm ghost"
                aria-label={t('Forget {email} on this device', { email: k.user.email })}
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
  // "Kept both" stays in the top bar until this panel has shown it (G-226).
  useEffect(
    () => () => {
      void online().then((c) => c.clearConflicts());
    },
    [],
  );
  return (
    <div className="account-form">
      <p className="account-who">
        <span className="account-initial lg">{initial(user.name || user.email)}</span>
        <span>
          {user.name && <strong>{user.name}</strong>}
          <span className="sub">{user.email}</span>
          <span className="sub">
            {user.provider === 'google' ? t('Signed in with Google') : t('Signed in with email')}
          </span>
        </span>
      </p>
      {sync && (
        <p className="hint" role="status">
          {sync.state === 'offline'
            ? t('Offline: changes wait on this device and upload when you are back online.')
            : sync.waiting
              ? t('{n} waiting to upload.', { n: sync.waiting })
              : t('Everything is in your account.')}
          {sync.conflicts.length > 0 &&
            t(' Changed on two devices, both kept: {names}.', {
              names: sync.conflicts.join(', '),
            })}
        </p>
      )}
      <button type="button" className="btn" disabled={busy} onClick={() => void syncNow()}>
        <Icon name="refresh" className="sm" />
        {t('Sync now')}
      </button>
      <SharedLinks />
      {others.length > 0 && (
        <div className="account-switch">
          <p className="hint">{t('Other accounts on this device')}</p>
          {others.map((k) => (
            <button
              key={k.user.id}
              type="button"
              className="btn sm"
              onClick={() => void switchTo(k.user.email)}
            >
              {t('Switch to {email}', { email: k.user.email })}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn" onClick={() => void switchTo('')}>
        <Icon name="plus" className="sm" />
        {t('Add another account')}
      </button>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn" disabled={busy} onClick={() => void exportMyData()}>
          <Icon name="download" className="sm" />
          {t('Export my data')}
        </button>
        <button type="button" className="btn danger" onClick={() => setDialog('delete')}>
          {t('Delete my account')}
        </button>
      </div>
      <button type="button" className="btn outline block" onClick={() => setDialog('sign-out')}>
        {t('Sign out')}
      </button>
      <button type="button" className="btn link" onClick={() => setDialog('privacy')}>
        {t('Privacy notice')}
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
      <p className="hint">{t('Shared links')}</p>
      <ul className="plain">
        {live.map((s) => (
          <li key={s.id}>
            <span>{s.name || t('Item')}</span>
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                await (await online()).stopShare(s.id);
                setRound((n) => n + 1);
              }}
            >
              {t('Stop sharing')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The privacy notice (ADR-130), in English (G-231) or Russian (ADR-153). Engineering guidance, not legal advice; not reviewed by a lawyer
 * (G-233, the user's decision).
 */
export function PrivacyNotice() {
  const setDialog = useAccount((s) => s.setDialog);
  const user = useAccount((s) => s.user);
  return (
    <div className="privacy">
      <p>
        {t(
          'Furniture Builder works on this device without an account and then sends nothing anywhere. This notice is about the optional account.',
        )}
      </p>
      <h3>{t('Who is responsible')}</h3>
      <p>
        {tNode('The app’s owner, a private person. Contact: {email}.', {
          email: <a href="mailto:Beliserii@gmail.com">Beliserii@gmail.com</a>,
        })}
      </p>
      <h3>{t('What is stored, and why')}</h3>
      <ul>
        <li>
          {t('Your email address, and your name if you sign in with Google: to sign you in.')}
        </li>
        <li>
          {t(
            'The pieces and templates you save to your account, and the board pictures they use: to keep them for you and open them on your other devices.',
          )}
        </li>
        <li>
          {t('The share links you make: so people with a link can open a copy of that item.')}
        </li>
      </ul>
      <p>{t('No tracking, analytics or advertising. Nothing is sold or shared for marketing.')}</p>
      <h3>{t('Where')}</h3>
      <p>
        {t(
          'With Supabase, the app’s database and sign-in service, in a data centre in the European Union. Google signs you in when you choose Continue with Google.',
        )}
      </p>
      <h3>{t('On this device')}</h3>
      <p>
        {t(
          'Your sign-in is kept in this browser’s storage so the app opens signed in, offline too. It is strictly needed for the account you asked for; nothing else is stored for the account.',
        )}
      </p>
      <h3>{t('How long')}</h3>
      <p>
        {t(
          'Until you delete it. An item you delete stays in your account’s Trash for 7 days. Delete my account removes your account, every item in it and every share link at once; the service’s own backups age out on its schedule.',
        )}
      </p>
      <h3>{t('Your rights')}</h3>
      <p>
        {t(
          'You can see and download your data (Export my data), correct it, and delete it (Delete my account), or write to the contact above. You can also complain to the Romanian data protection authority (ANSPDCP).',
        )}
      </p>
      <button
        type="button"
        className="btn block"
        onClick={() => setDialog(user ? 'account' : 'sign-in')}
      >
        {t('Back')}
      </button>
    </div>
  );
}

/** For lists: the table of a record kind. */
export const tableOf = TABLE_OF;
