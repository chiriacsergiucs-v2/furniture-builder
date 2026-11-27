import { useEffect, useState } from 'react';
import { t, tr } from '@furniture-builder/i18n';
import {
  deleteForever,
  listRecentlyDeleted,
  restoreRecentlyDeleted,
  type RecentlyDeleted,
} from '../../store/libraryStore';
import { askConfirm } from '../Confirm';
import { Group, InfoTip } from '../controls';
import { Icon } from '../icons';

const when = (iso: unknown) => {
  const d = typeof iso === 'string' ? new Date(iso) : null;
  return d && Number.isFinite(d.getTime()) ? d.toLocaleDateString() : '—';
};

/**
 * Recently deleted (ADR-302, G-014): projects and single pieces deleted on the Projects page, kept 30 days, with
 * Restore and Delete forever. Rows the app cannot read are listed too and never removed without the user (ADR-012).
 */
export function RecentlyDeletedList({
  reload,
  onRestored,
}: {
  reload: number;
  onRestored: () => void;
}) {
  const [rows, setRows] = useState<RecentlyDeleted[]>([]);
  const [again, setAgain] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [readError, setReadError] = useState(false);
  useEffect(() => {
    let live = true;
    listRecentlyDeleted()
      .then((r) => {
        if (!live) return;
        setRows(r);
        setReadError(false);
      })
      .catch(() => {
        if (!live) return;
        setRows([]);
        setReadError(true);
      });
    return () => {
      live = false;
    };
  }, [reload, again]);
  const title = t('Recently deleted ({n})', { n: rows.length });
  if (readError)
    return (
      <Group title={t('Recently deleted')} id="recently-deleted" defaultOpen={false}>
        <p className="alert error" role="alert">
          <span>{t('Saved work could not be read from this browser.')}</span>
          <button type="button" className="btn outline sm" onClick={() => setAgain((n) => n + 1)}>
            {t('Retry')}
          </button>
        </p>
      </Group>
    );
  if (!rows.length) return null;
  const run = async (work: () => Promise<string | null>, errorText: string) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      setMsg(await work());
    } catch {
      setMsg(errorText);
    } finally {
      setBusy(false);
      setAgain((n) => n + 1);
    }
  };
  const restore = (r: RecentlyDeleted) =>
    run(
      async () => {
        const res = await restoreRecentlyDeleted(r.key);
        if (res.ok) {
          onRestored();
          return null;
        }
        return res.reason === 'taken'
          ? t('“{name}” could not be restored: an item with the same id is saved again.', {
              name: tr(r.name),
            })
          : t('“{name}” could not be restored.', { name: tr(r.name) });
      },
      t('“{name}” could not be restored.', { name: tr(r.name) }),
    );
  const remove = (r: RecentlyDeleted) =>
    run(
      async () => {
        if (
          !(await askConfirm(
            t('Delete “{name}” forever? This cannot be undone.', { name: tr(r.name) }),
            { confirmLabel: t('Delete forever'), danger: true },
          ))
        )
          return null;
        await deleteForever(r.key);
        return null;
      },
      t('“{name}” could not be deleted from this browser’s storage.', { name: tr(r.name) }),
    );
  return (
    <Group
      title={title}
      id="recently-deleted"
      defaultOpen={false}
      info={
        <InfoTip label={t('About Recently deleted')} align="start">
          {t(
            'Projects and pieces you delete stay here for 30 days. Older ones are removed when the app starts.',
          )}
        </InfoTip>
      }
    >
      {msg && (
        <p className="alert error" role="alert">
          {msg}
        </p>
      )}
      <ul className="versions" aria-label={title}>
        {rows.map((r) => {
          const name = tr(r.name) || '—';
          return (
            <li key={r.key} className="version-row">
              <span>
                <strong>{name}</strong>
                <span className="sub">
                  {r.table === 'projects' ? t('Project') : t('Single piece')} ·{' '}
                  {t('deleted {date}', { date: when(r.deletedAt) })}
                </span>
              </span>
              <span className="split-actions">
                <button
                  type="button"
                  className="btn sm outline"
                  disabled={busy}
                  aria-label={t('Restore {name}', { name })}
                  onClick={() => void restore(r)}
                >
                  {t('Restore')}
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  disabled={busy}
                  aria-label={t('Delete {name} forever', { name })}
                  title={t('Delete forever')}
                  onClick={() => void remove(r)}
                >
                  <Icon name="trash" className="sm" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </Group>
  );
}
