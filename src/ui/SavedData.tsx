import { useEffect, useRef, useState } from 'react';
import type { BackupStatus, RestorePlan } from '../core/backup';
import {
  DEFAULT_REMINDER_DAYS,
  REMINDER_DAYS,
  daysSince,
  deviceNoticeShown,
  reminderDue,
} from '../core/backupReminder';
import {
  allowFolder,
  askPersist,
  backupNow,
  backupZip,
  chooseFolder,
  folderAccess,
  folderState,
  lastBackup,
  onBackupStatus,
  restoreFromFolder,
  restoreFromZip,
  storageState,
  type FolderState,
  type StorageState,
} from '../persist/backup';
import { db, getSetting, setSetting } from '../persist/db';
import { onSavedChange } from '../persist/events';
import { getLang, t } from '../core/i18n';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { useAccount } from '../store/accountStore';
import { useUi } from './shell/uiStore';

const mb = (n?: number) =>
  n === undefined ? '?' : t('{n} MB', { n: Math.max(0.1, n / 1e6).toFixed(1) });
const when = (iso: string) =>
  new Date(iso).toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const REMINDER_KEY = 'backup-reminder-days';
const NOTICE_KEY = 'device-notice-dismissed-at';
const LATER_KEY = 'backup-reminder-later-at';
const FIRST_SAVE_KEY = 'first-save-at';
const LAST_CHANGE_KEY = 'last-change-at';

/** Keeps the first and last save time on this device, for the reminder (ADR-141). */
export function startChangeClock(): () => void {
  return onSavedChange(async (c) => {
    if (c.table === 'settings') return;
    const now = new Date().toISOString();
    if (!(await getSetting<string>(FIRST_SAVE_KEY)))
      await setSetting(FIRST_SAVE_KEY, now).catch(() => {});
    await setSetting(LAST_CHANGE_KEY, now).catch(() => {});
  });
}

function restoreText(p: RestorePlan): string {
  const parts = [t('Restored {n|# item|# items} as new copies', { n: p.actions.length })];
  if (p.identical) parts.push(t('{n} already saved', { n: p.identical }));
  if (p.skipped.length)
    parts.push(
      t('{n} skipped: {list}', {
        n: p.skipped.length,
        list: p.skipped
          .slice(0, 3)
          .map((s) => `${s.path} (${s.reason})`)
          .join('; '),
      }),
    );
  return `${parts.join('; ')}.`;
}

/**
 * Settings › Saved data (ADR-133): whether the browser keeps saved data, the backup folder, Back up now, the last
 * backup and Restore. Where the browser has no folder access, a .zip download instead (G-243).
 */
export function SavedDataPanel() {
  const [store, setStore] = useState<StorageState | null>(null);
  const [dir, setDir] = useState<FolderState>({ permission: 'none' });
  const [status, setStatus] = useState<BackupStatus | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState<number>(DEFAULT_REMINDER_DAYS);
  const zipInput = useRef<HTMLInputElement>(null);
  const canFolder = folderAccess();

  useEffect(() => {
    let live = true;
    void storageState().then((s) => live && setStore(s));
    void folderState().then((s) => live && setDir(s));
    void lastBackup().then((s) => live && setStatus(s));
    void getSetting<number>(REMINDER_KEY).then((d) => live && d !== undefined && setDays(d));
    const off = onBackupStatus((s) => setStatus(s));
    return () => {
      live = false;
      off();
    };
  }, []);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section saved-data" aria-label={t('Saved data')}>
      <div className="card-title">
        <span>{t('Saved data')}</span>
      </div>
      {store && (
        <p className={`alert ${store.persisted ? 'ok' : 'warning'}`} role="status">
          <Icon name={store.persisted ? 'check' : 'alert-triangle'} className="sm" />
          <span>
            {store.persisted
              ? t('Kept: the browser will not clear your saved data on its own.')
              : store.supported
                ? t(
                    'Not kept: the browser may clear saved data when space runs low. Back up to a folder.',
                  )
                : t('This browser does not say whether it keeps saved data. Back up to a folder.')}
            {store.usage !== undefined && t(' Space used: {size}.', { size: mb(store.usage) })}
          </span>
        </p>
      )}
      {store && !store.persisted && store.supported && (
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const ok = await askPersist();
              setStore(await storageState());
              if (!ok)
                setMessage({
                  ok: false,
                  text: t('The browser said no. Back up to a folder instead.'),
                });
            })
          }
        >
          {t('Keep saved data')}
        </button>
      )}
      {canFolder ? (
        <>
          <p className="hint">
            {dir.name
              ? t('Backup folder: {name}', { name: dir.name })
              : t('No backup folder chosen yet.')}{' '}
            {t('Backups run after each change while the app is open, one file per item.')}
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const s = await chooseFolder();
                  if (s === 'cancelled') return;
                  setDir(s);
                  setStatus(await backupNow());
                })
              }
            >
              <Icon name="folder" className="sm" />
              {t('Choose backup folder')}
            </button>
            {dir.permission === 'prompt' ? (
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setDir(await allowFolder());
                    setStatus(await backupNow());
                  })
                }
              >
                {t('Allow backup folder')}
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={busy || dir.permission === 'none'}
                onClick={() => run(async () => setStatus(await backupNow()))}
              >
                <Icon name="hdd" className="sm" />
                {t('Back up now')}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            {t(
              'This browser cannot write to a folder. Download a backup instead: one .zip with a file per item.',
            )}
          </p>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const z = await backupZip();
                const url = URL.createObjectURL(z.blob);
                Object.assign(document.createElement('a'), { href: url, download: z.name }).click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setStatus(z.status);
              })
            }
          >
            <Icon name="download" className="sm" />
            {t('Download backup (.zip)')}
          </button>
        </>
      )}
      {status &&
        (status.error ? (
          <p className="alert error" role="alert">
            <Icon name="alert-circle" className="sm" />
            <span>{status.error}</span>
          </p>
        ) : (
          <p className="hint" role="status">
            {t('Last backup: {when} — {n|# item|# items}', {
              when: when(status.at),
              n: status.items,
            })}
          </p>
        ))}
      <div className="btn-row">
        {canFolder && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const p = await restoreFromFolder();
                if (p !== 'cancelled') setMessage({ ok: !p.skipped.length, text: restoreText(p) });
              })
            }
          >
            <Icon name="upload" className="sm" />
            {t('Restore from backup')}
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => zipInput.current?.click()}
        >
          <Icon name="upload" className="sm" />
          {t('Restore a .zip')}
        </button>
        <input
          ref={zipInput}
          type="file"
          accept=".zip,application/zip"
          aria-label={t('Restore a .zip')}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f)
              void run(async () => {
                const p = await restoreFromZip(f);
                setMessage({ ok: !p.skipped.length, text: restoreText(p) });
              });
          }}
        />
      </div>
      <p className="hint">
        {t('Restoring adds new copies; nothing saved is overwritten or deleted.')}
      </p>
      <label className="field">
        <span>{t('Remind me to back up')}</span>
        <select
          value={days}
          onChange={(e) => {
            const d = Number(e.target.value);
            setDays(d);
            void setSetting(REMINDER_KEY, d);
          }}
        >
          {REMINDER_DAYS.map((d) => (
            <option key={d} value={d}>
              {d ? t('Every {n} days', { n: d }) : t('Off')}
            </option>
          ))}
        </select>
      </label>
      {message && (
        <p className={`alert ${message.ok ? 'ok' : 'warning'}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}

/** The same panel as a dialog, opened from the ⋯ menu, the device-only notice and the reminder. */
export function SavedDataDialog() {
  const open = useUi((s) => s.savedDataOpen);
  const setOpen = useUi((s) => s.setSavedDataOpen);
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={t('Saved data and backup')}
      footer={
        <button type="button" className="btn primary" onClick={() => setOpen(false)}>
          {t('Done')}
        </button>
      }
    >
      {open && <SavedDataPanel />}
    </Dialog>
  );
}

/**
 * "Your designs are only on this device" (ADR-140): while something is saved, no backup was ever made and nothing is
 * in an account. Dismiss hides it for 7 days (G-261).
 */
export function DeviceOnlyNotice({ signIn }: { signIn?: () => void }) {
  const [shown, setShown] = useState(false);
  const setSavedData = useUi((s) => s.setSavedDataOpen);
  // Items in an account count as kept (ADR-140).
  const accountCopies = useAccount((s) =>
    s.user ? Object.values(s.sync?.items ?? {}).filter((v) => v === 'in-account').length : 0,
  );
  useEffect(() => {
    let live = true;
    const check = async () => {
      const [designs, projects, status, dismissedAt] = await Promise.all([
        db.designs.count().catch(() => 0),
        db.projects.count().catch(() => 0),
        lastBackup(),
        getSetting<string>(NOTICE_KEY),
      ]);
      if (!live) return;
      setShown(
        deviceNoticeShown({
          savedItems: designs + projects,
          lastBackupAt: status && !status.error ? status.at : undefined,
          accountCopies,
          dismissedAt,
          now: new Date().toISOString(),
        }),
      );
    };
    void check();
    const offB = onBackupStatus(() => void check());
    return () => {
      live = false;
      offB();
    };
  }, [accountCopies]);
  if (!shown) return null;
  return (
    <div className="alert info device-only" role="status">
      <Icon name="info" className="sm" />
      <span>
        {signIn
          ? t(
              'Your designs are only on this device. Back up to a folder or save them to your account.',
            )
          : t('Your designs are only on this device. Back up to a folder.')}
      </span>
      <span className="device-only-actions">
        <button type="button" className="btn sm" onClick={() => setSavedData(true)}>
          {t('Back up')}
        </button>
        {signIn && (
          <button type="button" className="btn sm" onClick={signIn}>
            {t('Sign in')}
          </button>
        )}
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => {
            setShown(false);
            void setSetting(NOTICE_KEY, new Date().toISOString());
          }}
        >
          {t('Dismiss')}
        </button>
      </span>
    </div>
  );
}

/** "Last backup: n days ago." with Back up now and Later (ADR-141), checked at start and after changes. */
export function BackupReminder() {
  const [due, setDue] = useState<{ days: number | null } | null>(null);
  const setSavedData = useUi((s) => s.setSavedDataOpen);
  useEffect(() => {
    let live = true;
    const check = async () => {
      const [days, status, firstSaveAt, lastChangeAt, laterAt] = await Promise.all([
        getSetting<number>(REMINDER_KEY),
        lastBackup(),
        getSetting<string>(FIRST_SAVE_KEY),
        getSetting<string>(LAST_CHANGE_KEY),
        getSetting<string>(LATER_KEY),
      ]);
      const lastBackupAt = status && !status.error ? status.at : undefined;
      const now = new Date().toISOString();
      if (!live) return;
      setDue(
        reminderDue({
          intervalDays: days ?? DEFAULT_REMINDER_DAYS,
          lastBackupAt,
          firstSaveAt,
          lastChangeAt,
          laterAt,
          now,
        })
          ? { days: lastBackupAt ? daysSince(lastBackupAt, now) : null }
          : null,
      );
    };
    void check();
    const offB = onBackupStatus(() => void check());
    return () => {
      live = false;
      offB();
    };
  }, []);
  if (!due) return null;
  return (
    <div className="toast backup-reminder" role="status">
      <span>
        {due.days === null ? t('No backup yet.') : t('Last backup: {n} days ago.', { n: due.days })}
      </span>
      <button
        type="button"
        className="btn sm primary"
        onClick={() => {
          setDue(null);
          if (folderAccess())
            void folderState().then((s) =>
              s.permission === 'granted' ? void backupNow() : setSavedData(true),
            );
          else setSavedData(true);
        }}
      >
        {t('Back up now')}
      </button>
      <button
        type="button"
        className="btn sm ghost"
        onClick={() => {
          setDue(null);
          void setSetting(LATER_KEY, new Date().toISOString());
        }}
      >
        {t('Later')}
      </button>
    </div>
  );
}
