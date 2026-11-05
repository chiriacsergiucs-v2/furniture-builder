import { useEffect, useMemo, useRef, useState } from 'react';
import type { FinishScope } from '../core/finish';
import { getLang, t, tr } from '../core/i18n';
import { VERSION_KIND_TEXT, type ProjectVersion } from '../core/projectVersion';
import { builtInStyles, HANDLE_NAMES, yourStyles, type Style } from '../core/styles';
import { deleteProjectVersion, listProjects, listProjectVersions } from '../persist/db';
import { useDesign } from '../store/designStore';
import { restoreVersion, saveVersionNow } from '../store/versions';
import { askConfirm } from './Confirm';
import { Group, InfoTip } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';

const when = (iso: string) =>
  new Date(iso).toLocaleString(getLang() === 'ru' ? 'ru' : undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/** A project switch remounts its history, so no rows or pending messages leak to the next project (ADR-200). */
export function ProjectHistory() {
  const id = useDesign((s) => s.project!.id);
  return <HistoryForProject key={id} />;
}
function HistoryForProject() {
  const project = useDesign((s) => s.project)!;
  const dirtyAt = useDesign((s) => s.projectDirtyAt);
  const id = project.id;
  const [steps, setSteps] = useState(false);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let live = true;
    listProjectVersions(id)
      .then((v) => {
        if (live) {
          setVersions(v);
          setReadError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (live) {
          setReadError(true);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [id, reload, dirtyAt]);
  const again = () => {
    setLoading(true);
    setReload((n) => n + 1);
  };
  const run = async (work: () => Promise<void>, errorText: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMsg(null);
    try {
      await work();
      if (useDesign.getState().project?.id === id) again();
    } catch {
      setMsg({ ok: false, text: errorText });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Group
      title={
        versions.length
          ? t('History · {n|# version|# versions}', { n: versions.length })
          : t('History')
      }
      defaultOpen={false}
      info={
        <InfoTip label={t('About the history')} align="start">
          {t(
            'Undo steps last while the project is open. Versions stay on this device until you delete them; one is kept each time you open the project and change it.',
          )}
        </InfoTip>
      }
    >
      <div className="split-actions">
        <button
          type="button"
          className="btn outline"
          disabled={busy}
          onClick={() => setSteps(true)}
        >
          {t('Edit history')}
        </button>
        <button
          type="button"
          className="btn outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const v = await saveVersionNow();
              if (v && useDesign.getState().project?.id === id)
                setMsg({ ok: true, text: t('Version saved.') });
            }, t('The version could not be saved on this device.'))
          }
        >
          {t('Save a version')}
        </button>
      </div>
      {msg && (
        <p className={msg.ok ? 'hint' : 'alert error'} role={msg.ok ? 'status' : 'alert'}>
          {msg.text}
        </p>
      )}
      {readError && (
        <p className="alert error" role="alert">
          <span>{t('Versions could not be read from this device.')}</span>
          <button type="button" className="btn outline sm" disabled={loading} onClick={again}>
            {t('Retry')}
          </button>
        </p>
      )}
      {loading && (
        <p className="hint" role="status">
          {t('Loading…')}
        </p>
      )}
      {!loading && !readError && versions.length === 0 && (
        <p className="hint">{t('No versions kept yet.')}</p>
      )}
      {versions.length > 0 && (
        <ul className="versions" aria-label={t('Kept versions')}>
          {versions.map((v) => (
            <li key={v.id} className="version-row">
              <span>
                <strong>{when(v.savedAt)}</strong>
                <span className="sub">
                  {tr(VERSION_KIND_TEXT[v.kind])} · {v.project.name} ·{' '}
                  {t('{n|# piece|# pieces}', { n: v.project.items.length })}
                </span>
              </span>
              <span className="split-actions">
                <button
                  type="button"
                  className="btn sm outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (
                        !(await askConfirm(
                          t(
                            'Restore the version of {when}? The project as it is now is kept as a version first.',
                            { when: when(v.savedAt) },
                          ),
                          { confirmLabel: t('Restore') },
                        ))
                      )
                        return;
                      if (useDesign.getState().project?.id !== id) return;
                      const restored = await restoreVersion(v);
                      if (useDesign.getState().project?.id === id)
                        setMsg(
                          restored
                            ? {
                                ok: true,
                                text: t('Restored the version of {when}.', {
                                  when: when(v.savedAt),
                                }),
                              }
                            : {
                                ok: false,
                                text: t(
                                  'The project changed while saving the version. Try restoring again.',
                                ),
                              },
                        );
                    }, t('The version could not be restored.'))
                  }
                >
                  {t('Restore')}
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  disabled={busy}
                  aria-label={t('Delete the version of {when}', { when: when(v.savedAt) })}
                  onClick={() =>
                    void run(async () => {
                      if (
                        !(await askConfirm(
                          t('Delete the version of {when}? It cannot be undone.', {
                            when: when(v.savedAt),
                          }),
                          { confirmLabel: t('Delete'), danger: true },
                        ))
                      )
                        return;
                      await deleteProjectVersion(v.id);
                    }, t('The version could not be deleted from this device.'))
                  }
                >
                  <Icon name="trash" className="sm" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <EditHistory open={steps} onClose={() => setSteps(false)} />
    </Group>
  );
}

/** The named undo steps (ADR-123): earlier steps, now, and undone steps; tapping one goes back or forward to it. */
function EditHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const past = useDesign((s) => s.projectPastNames);
  const future = useDesign((s) => s.projectFutureNames);
  const jump = useDesign((s) => s.jumpProject);
  return (
    <Dialog open={open} onClose={onClose} title={t('Edit history')}>
      {past.length === 0 && future.length === 0 ? (
        <p className="empty">{t('No changes yet since the project was opened.')}</p>
      ) : (
        <ol className="steps-log">
          <li>
            <button type="button" className="row-btn" onClick={() => jump(-past.length)}>
              <span>{t('As opened')}</span>
            </button>
          </li>
          {past.map((name, i) => (
            <li key={`p${i}`}>
              <button
                type="button"
                className={`row-btn ${i === past.length - 1 ? 'on' : ''}`}
                aria-current={i === past.length - 1 ? 'step' : undefined}
                onClick={() => jump(i + 1 - past.length)}
              >
                <span>{tr(name)}</span>
                {i === past.length - 1 && <span className="sub">{t('Now')}</span>}
              </button>
            </li>
          ))}
          {future.map((name, i) => (
            <li key={`f${i}`}>
              <button type="button" className="row-btn undone" onClick={() => jump(i + 1)}>
                <span>{tr(name)}</span>
                <span className="sub">{t('Undone')}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}

/**
 * Style suggestions (ADR-123): built-in styles from the shipped boards and handle kinds, and the user's own
 * combinations from their saved projects, applied through the finish scope chosen above (ADR-055).
 */
export function StyleSuggestions({ itemId, scope }: { itemId: string; scope: FinishScope }) {
  const apply = useDesign((s) => s.applyStyle);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<Style[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    listProjects()
      .then((rows) => live && setMine(yourStyles(rows.map((r) => r.project))))
      .catch(() => live && setMine([]));
    return () => {
      live = false;
    };
  }, [open]);
  const styles = useMemo(() => [...mine, ...builtInStyles()], [mine]);
  if (!open)
    return (
      <button type="button" className="btn outline" onClick={() => setOpen(true)}>
        {t('Suggest a style')}
      </button>
    );
  return (
    <section className="style-list" aria-label={t('Suggested styles')}>
      <div className="info-row">
        <h4>{t('Suggested styles')}</h4>
        <InfoTip label={t('About suggested styles')} align="start">
          {t(
            "Suggestions only: board and handle combinations from the app's board list and from your own projects. They go on the pieces chosen under “Apply to”.",
          )}
        </InfoTip>
      </div>
      <ul>
        {styles.map((st) => (
          <li key={st.id} className="style-row">
            <span className="swatches" aria-hidden="true">
              <span className="swatch" style={{ background: st.front.color }} />
              <span className="swatch" style={{ background: st.body.color }} />
            </span>
            <span>
              <strong>{tr(st.name)}</strong>
              <span className="sub">
                {st.source === 'yours' ? t('Yours, on {n} pieces · ', { n: String(st.uses) }) : ''}
                {t('Fronts {front}, carcass {body}', {
                  front: tr(st.front.name),
                  body: tr(st.body.name),
                })}
                {st.handle ? `, ${tr(HANDLE_NAMES[st.handle])}` : ''}
              </span>
            </span>
            <button
              type="button"
              className="btn sm outline"
              aria-label={t('Apply {name}', { name: tr(st.name) })}
              onClick={() => {
                const r = apply(itemId, st, scope);
                setMsg(
                  r.applied.length
                    ? t('{name} applied to {n|# piece|# pieces}.', {
                        name: tr(st.name),
                        n: r.applied.length,
                      })
                    : t('Nothing changed: {why}.', {
                        why: r.skipped.map((s) => tr(s)).join('; ') || t('no piece reached'),
                      }),
                );
              }}
            >
              {t('Apply')}
            </button>
          </li>
        ))}
      </ul>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
      <button type="button" className="btn ghost sm" onClick={() => setOpen(false)}>
        {t('Hide styles')}
      </button>
    </section>
  );
}
