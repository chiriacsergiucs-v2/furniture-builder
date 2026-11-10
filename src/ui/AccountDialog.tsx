// The account dialog's states (ADR-136), split from Account.tsx so they load on first use (ADR-222).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { t, type Key } from '../core/i18n';
import {
  continueWithGoogle,
  createAccount,
  deleteMyAccount,
  exportMyData,
  saveNewPassword,
  sendReset,
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
import { Dialog } from './Dialogs';
import { tNode } from './i18n';
import { Icon } from './icons';
import { initial, useOnline } from './Account';

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  errorId = 'acct-error',
}: {
  label: Key;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
  error?: string | null;
  /** The id of the element that holds this field's error (ADR-264); `acct-error` by default. */
  errorId?: string;
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
        aria-describedby={error ? errorId : hint ? `${id}-hint` : undefined}
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

export default function AccountDialogState({ dialog }: { dialog: NonNullable<Dialogs> }) {
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
          // Typing again clears the mismatch, so a stale alert never stays (ADR-264).
          onChange={(v) => {
            setPassword(v);
            setMismatch(false);
          }}
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={error}
        />
        <Field
          label="Confirm"
          type="password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setMismatch(false);
          }}
          autoComplete="new-password"
          error={mismatch ? 'x' : null}
          errorId="acct-mismatch"
        />
        {mismatch && (
          <p id="acct-mismatch" className="alert error" role="alert">
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
  // A failed list or Stop sharing is said here (ADR-263), never hidden as "no links".
  const [error, setError] = useState<string | null>(null);
  const [listFailed, setListFailed] = useState(false);
  useEffect(() => {
    let live = true;
    online()
      .then((c) => c.listShares())
      .then(
        (l) => {
          if (!live) return;
          setList(l);
          setListFailed(false);
        },
        () => {
          if (!live) return;
          setList([]);
          setListFailed(true);
        },
      );
    return () => {
      live = false;
    };
  }, [round]);
  const live = (list ?? []).filter((s) => !s.stoppedAt);
  if (listFailed)
    return (
      <div className="shared-links">
        <p className="alert error" role="alert">
          {t('Shared links could not be loaded.')}{' '}
          <button type="button" className="btn sm" onClick={() => setRound((n) => n + 1)}>
            {t('Retry')}
          </button>
        </p>
      </div>
    );
  if (!live.length && !error) return null;
  return (
    <div className="shared-links">
      <p className="hint">{t('Shared links')}</p>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <ul className="plain">
        {live.map((s) => (
          <li key={s.id}>
            <span>{s.name || t('Item')}</span>
            <button
              type="button"
              className="btn sm"
              onClick={async () => {
                setError(null);
                try {
                  await (await online()).stopShare(s.id);
                } catch (e) {
                  setError(
                    e instanceof Error && e.message
                      ? e.message
                      : t('Check your connection and try again.'),
                  );
                }
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
function PrivacyNotice() {
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
