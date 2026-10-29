import { useEffect, useState } from 'react';
import {
  projectFromTemplate,
  templateFromProject,
  type ProjectTemplate,
} from '../core/projectTemplate';
import {
  deleteProjectTemplate,
  listProjectTemplates,
  saveProject,
  saveProjectTemplate,
} from '../persist/db';
import { projectTemplateFile } from '../persist/projectTemplateFile';
import { useDesign } from '../store/designStore';
import { askConfirm, askText } from './Confirm';
import { Icon } from './icons';
import { t } from '../core/i18n';

/** Project → "Save as project template" (ADR-060). */
export function SaveProjectTemplate() {
  const project = useDesign((s) => s.project)!;
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    const name = await askText(t('Name of the project template'), project.name, t('Save template'));
    if (name === null) return;
    const includeRoom =
      !!project.room &&
      (await askConfirm(
        t(
          'Include the room (walls, doors, windows) in the template? Without it, the pieces keep their places relative to each other.',
        ),
        { confirmLabel: t('Include the room') },
      ));
    const pt = templateFromProject(project, name.trim() || project.name, { includeRoom });
    try {
      await saveProjectTemplate(pt);
      setMsg(
        t(
          'Saved as project template “{name}”. Use it from Projects → Create from a project template.',
          { name: pt.name },
        ),
      );
    } catch {
      setMsg(t('The template could not be saved on this device.'));
    }
  };
  return (
    <div className="save-template">
      <button
        type="button"
        className="btn outline block"
        onClick={() => void go()}
        disabled={!project.items.length}
      >
        <Icon name="copy" className="sm" />
        {t('Save as project template')}
      </button>
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Start a project from a template: a new project with new ids, saved and opened. */
export async function startFromProjectTemplate(pt: ProjectTemplate) {
  const name = await askText(t('Name of the new project'), pt.name, t('Create project'));
  if (name === null) return false;
  const p = projectFromTemplate(pt, name.trim() || pt.name);
  await saveProject(p);
  useDesign.getState().openProject(p);
  return true;
}

/** Project templates saved on this device, with Use, Rename, Export and Delete (ADR-060). */
export function ProjectTemplateList({
  onOpened,
  manage = false,
}: {
  onOpened: () => void;
  manage?: boolean;
}) {
  const [rows, setRows] = useState<ProjectTemplate[] | null>(null);
  const [error, setError] = useState(false);
  const refresh = () =>
    listProjectTemplates()
      .then(setRows)
      .catch(() => {
        setRows([]);
        setError(true);
      });
  useEffect(() => {
    void refresh();
  }, []);
  if (error)
    return (
      <p className="alert error" role="alert">
        <Icon name="alert-circle" className="sm" />
        <span>{t('Project templates could not be read from this browser.')}</span>
      </p>
    );
  if (!rows || (!rows.length && !manage)) return null;
  return (
    <section className="project-templates" aria-labelledby="pt-head">
      <h3 className="list-head" id="pt-head">
        {t('Create from a project template')}
      </h3>
      {!rows.length ? (
        <p className="empty">
          {t('No project templates yet. Open a project and choose “Save as project template”.')}
        </p>
      ) : (
        <ul className="home-list">
          {rows.map((pt) => (
            <li key={pt.id} className={manage ? 'with-actions' : undefined}>
              <button
                type="button"
                className="row-btn"
                onClick={async () => {
                  if (await startFromProjectTemplate(pt)) onOpened();
                }}
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
                    onClick={async () => {
                      const n = await askText(t('New name'), pt.name, t('Rename'));
                      if (n?.trim()) {
                        await saveProjectTemplate({
                          ...pt,
                          name: n.trim(),
                          updatedAt: new Date().toISOString(),
                        });
                        void refresh();
                      }
                    }}
                  >
                    {t('Rename')}
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={async () => {
                      // With its pictures, like design and project files (ADR-048).
                      const file = await projectTemplateFile(pt);
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
                      );
                      Object.assign(document.createElement('a'), {
                        href: url,
                        download: `${pt.name}.project-template.json`,
                      }).click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    {t('Export')}
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={async () => {
                      if (
                        await askConfirm(
                          t('Delete project template “{name}”? Projects made from it stay.', {
                            name: pt.name,
                          }),
                          { confirmLabel: t('Delete'), danger: true },
                        )
                      ) {
                        await deleteProjectTemplate(pt.id);
                        void refresh();
                      }
                    }}
                  >
                    {t('Delete')}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
