import { lazy, Suspense, useEffect, useState } from 'react';
import type { RemoteRecord } from '../core/account';
import { t } from '../core/i18n';
import { STATE_LABEL, TABLE_OF, type LocalTable } from '../core/sync';
import { setDeviceOnly, syncNow } from '../store/accountActions';
import { online, useAccount } from '../store/accountStore';
import { useDesign } from '../store/designStore';
import { Icon } from './icons';

/** Offline: sign-in buttons are disabled with this line (ADR-136). */
export function useOnline(): boolean {
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

export const initial = (s: string) => (s.trim()[0] ?? '?').toUpperCase();

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
      const { loadDesign } = await import('../store/libraryStore');
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

const AccountDialogState = lazy(() => import('./AccountDialog'));

/** The account dialog and every state of ADR-136. Each state starts with empty password fields. */
export function AccountDialog() {
  const dialog = useAccount((s) => s.dialog);
  // The dialog's states load on first use (ADR-222).
  return dialog ? (
    <Suspense fallback={null}>
      <AccountDialogState key={dialog} dialog={dialog} />
    </Suspense>
  ) : null;
}

/** For lists: the table of a record kind. */
export const tableOf = TABLE_OF;
