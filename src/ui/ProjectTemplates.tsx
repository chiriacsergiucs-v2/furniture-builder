import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  projectFromTemplate,
  templateFromProject,
  type ProjectTemplate,
} from '../core/projectTemplate';
import type { Project } from '../core/project';
import {
  deleteProjectTemplate,
  listProjectTemplates,
  saveProject,
  saveProjectTemplate,
} from '../persist/db';
import { projectTemplateFile } from '../persist/projectTemplateFile';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { Dialog } from './Dialogs';
import { Toggle } from './controls';
import { Icon } from './icons';
import { t } from '../core/i18n';

/** A failed write keeps the name and room choice available for retry (ADR-200). */
function TemplateNameDialog({
  title,
  label,
  initialName,
  saveLabel,
  hasRoom = false,
  errorText,
  onSave,
  onClose,
}: {
  title: string;
  label: string;
  initialName: string;
  saveLabel: string;
  hasRoom?: boolean;
  errorText: string;
  onSave: (name: string, includeRoom: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [includeRoom, setIncludeRoom] = useState(true);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (pending.current || !name.trim()) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim(), includeRoom);
    } catch {
      setError(errorText);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title={title}
      onClose={() => {
        if (!pending.current) onClose();
      }}
      footer={
        <>
          <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" form={id} className="btn primary" disabled={busy || !name.trim()}>
            {saveLabel}
          </button>
        </>
      }
    >
      <form
        id={id}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="field">
          <label htmlFor={`${id}-name`}>{label}</label>
          <input
            id={`${id}-name`}
            value={name}
            disabled={busy}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {hasRoom && (
          <Toggle
            label={t('Include the room')}
            disabled={busy}
            checked={includeRoom}
            onChange={(v) => {
              if (!pending.current) setIncludeRoom(v);
            }}
          />
        )}
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/** Project → Save as project template: Cancel/Escape never saves, with or without a room (ADR-200). */
export function SaveProjectTemplate() {
  const id = useDesign((s) => s.project!.id);
  return <SaveTemplateForProject key={id} />;
}
function SaveTemplateForProject() {
  const project = useDesign((s) => s.project)!;
  const [draft, setDraft] = useState<Project | null>(null);
  const savedDraft = useRef<ProjectTemplate | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="save-template">
      <button
        type="button"
        className="btn outline block"
        disabled={!project.items.length}
        onClick={() => {
          savedDraft.current = null;
          setMsg(null);
          setDraft(project);
        }}
      >
        <Icon name="copy" className="sm" />
        {t('Save as project template')}
      </button>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
      {draft && (
        <TemplateNameDialog
          title={t('Save as project template')}
          label={t('Name of the project template')}
          initialName={draft.name}
          saveLabel={t('Save template')}
          hasRoom={!!draft.room}
          errorText={t('The template could not be saved on this device.')}
          onClose={() => setDraft(null)}
          onSave={async (name, includeRoom) => {
            const made = templateFromProject(draft, name, { includeRoom });
            // Reuse the operation's id on retry, even after a name/room correction.
            const template = { ...made, id: savedDraft.current?.id ?? made.id };
            savedDraft.current = template;
            await saveProjectTemplate(template);
            setDraft(null);
            setMsg(
              t(
                'Saved as project template “{name}”. Use it from Projects → Create from a project template.',
                { name: template.name },
              ),
            );
          }}
        />
      )}
    </div>
  );
}

type Action = { kind: 'create' | 'rename'; template: ProjectTemplate };

/** Project templates: failures keep the list/input; every operation can be retried (ADR-200). */
export function ProjectTemplateList({
  onOpened,
  manage = false,
}: {
  onOpened: () => void;
  manage?: boolean;
}) {
  const [rows, setRows] = useState<ProjectTemplate[] | null>(null);
  const [readError, setReadError] = useState(false);
  const live = useRef(true);
  const reading = useRef(false);
  const refresh = useCallback(async () => {
    if (reading.current) return;
    reading.current = true;
    try {
      const next = await listProjectTemplates();
      if (live.current) {
        setRows(next);
        setReadError(false);
      }
    } catch {
      if (live.current) setReadError(true);
    } finally {
      reading.current = false;
    }
  }, []);
  useEffect(() => {
    live.current = true;
    let cancelled = false;
    listProjectTemplates()
      .then((next) => {
        if (!cancelled) {
          setRows(next);
          setReadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setReadError(true);
      });
    return () => {
      cancelled = true;
      live.current = false;
    };
  }, []);
  const [action, setAction] = useState<Action | null>(null);
  const active = useRef<Action | null>(null);
  const created = useRef<Project | null>(null);
  const choose = (value: Action | null) => {
    active.current = value;
    created.current = null;
    setAction(value);
  };
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const retry = useRef<(() => void) | null>(null);
  const run = async (work: () => Promise<void>, errorText: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    retry.current = null;
    try {
      await work();
    } catch {
      if (live.current) {
        setError(errorText);
        retry.current = () => void run(work, errorText);
      }
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  if (rows?.length === 0 && !manage && !readError && !error) return null;
  return (
    <section className="project-templates" aria-labelledby="pt-head">
      <h3 className="list-head" id="pt-head">
        {t('Create from a project template')}
      </h3>
      {readError && (
        <p className="alert error" role="alert">
          <span>{t('Project templates could not be read from this browser.')}</span>
          <button type="button" className="btn outline sm" onClick={() => void refresh()}>
            {t('Retry')}
          </button>
        </p>
      )}
      {error && (
        <p className="alert error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn outline sm"
            disabled={busy}
            onClick={() => retry.current?.()}
          >
            {t('Retry')}
          </button>
        </p>
      )}
      {!rows && !readError && (
        <p className="hint" role="status">
          {t('Loading…')}
        </p>
      )}
      {rows?.length === 0 && !readError && (
        <p className="empty">
          {t('No project templates yet. Open a project and choose “Save as project template”.')}
        </p>
      )}
      {!!rows?.length && (
        <ul className="home-list">
          {rows.map((pt) => (
            <li key={pt.id} className={manage ? 'with-actions' : undefined}>
              <button
                type="button"
                className="row-btn"
                disabled={busy}
                onClick={() => choose({ kind: 'create', template: pt })}
              >
                <span className="glyph">
                  <Icon name="project" />
                </span>
                <span>
                  <strong>{pt.name}</strong>
                  <span className="sub">
                    {t('{n|# piece|# pieces}', { n: pt.items.length })}
                    {pt.room ? t(', with the room') : ''}
                    {pt.runRecipe ? t(', run parts suggested') : ''}
                  </span>
                </span>
                <Icon name="chevron-right" className="chev sm" />
              </button>
              {manage && (
                <span className="row-actions">
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() => choose({ kind: 'rename', template: pt })}
                  >
                    {t('Rename')}
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const file = await projectTemplateFile(pt);
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
                        );
                        try {
                          Object.assign(document.createElement('a'), {
                            href: url,
                            download: `${pt.name}.project-template.json`,
                          }).click();
                        } finally {
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }
                      }, t('The project template could not be exported.'))
                    }
                  >
                    {t('Export')}
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if (
                          !(await askConfirm(
                            t('Delete project template “{name}”? Projects made from it stay.', {
                              name: pt.name,
                            }),
                            { confirmLabel: t('Delete'), danger: true },
                          ))
                        )
                          return;
                        await deleteProjectTemplate(pt.id);
                        await refresh();
                      }, t('The project template could not be deleted from this device.'))
                    }
                  >
                    {t('Delete')}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {action && (
        <TemplateNameDialog
          key={`${action.kind}:${action.template.id}`}
          title={action.kind === 'create' ? t('Create project') : t('Rename')}
          label={action.kind === 'create' ? t('Name of the new project') : t('New name')}
          initialName={action.template.name}
          saveLabel={action.kind === 'create' ? t('Create project') : t('Rename')}
          errorText={
            action.kind === 'create'
              ? t('The project could not be created on this device.')
              : t('The project template could not be renamed on this device.')
          }
          onClose={() => choose(null)}
          onSave={async (name) => {
            if (action.kind === 'create') {
              const project = {
                ...(created.current ?? projectFromTemplate(action.template, name)),
                name,
              };
              created.current = project;
              await saveProject(project);
              if (live.current && active.current === action) {
                useDesign.getState().openProject(project);
                choose(null);
                onOpened();
              }
            } else {
              await saveProjectTemplate({
                ...action.template,
                name,
                updatedAt: new Date().toISOString(),
              });
              if (live.current && active.current === action) {
                choose(null);
                await refresh();
              }
            }
          }}
        />
      )}
    </section>
  );
}
