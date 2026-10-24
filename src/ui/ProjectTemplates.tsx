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

/** Project → "Save as project template" (ADR-060). */
export function SaveProjectTemplate() {
  const project = useDesign((s) => s.project)!;
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    const name = await askText('Name of the project template', project.name, 'Save template');
    if (name === null) return;
    const includeRoom =
      !!project.room &&
      (await askConfirm(
        'Include the room (walls, doors, windows) in the template? Without it, the pieces keep their places relative to each other.',
        { confirmLabel: 'Include the room' },
      ));
    const t = templateFromProject(project, name.trim() || project.name, { includeRoom });
    try {
      await saveProjectTemplate(t);
      setMsg(
        `Saved as project template “${t.name}”. Use it from Home → Create from a project template.`,
      );
    } catch {
      setMsg('The template could not be saved on this device.');
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
        Save as project template
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
export async function startFromProjectTemplate(t: ProjectTemplate) {
  const name = await askText('Name of the new project', t.name, 'Create project');
  if (name === null) return false;
  const p = projectFromTemplate(t, name.trim() || t.name);
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
        <span>Project templates could not be read from this browser.</span>
      </p>
    );
  if (!rows || (!rows.length && !manage)) return null;
  return (
    <section className="project-templates" aria-labelledby="pt-head">
      <h3 className="list-head" id="pt-head">
        Create from a project template
      </h3>
      {!rows.length ? (
        <p className="empty">
          No project templates yet. Open a project and choose “Save as project template”.
        </p>
      ) : (
        <ul className="home-list">
          {rows.map((t) => (
            <li key={t.id} className={manage ? 'with-actions' : undefined}>
              <button
                type="button"
                className="row-btn"
                onClick={async () => {
                  if (await startFromProjectTemplate(t)) onOpened();
                }}
              >
                <span className="glyph">
                  <Icon name="project" />
                </span>
                <span>
                  <strong>{t.name}</strong>
                  <span className="sub">
                    {t.items.length} {t.items.length === 1 ? 'piece' : 'pieces'}
                    {t.room ? ', with the room' : ''}
                    {t.runRecipe ? ', run parts suggested' : ''}
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
                      const n = await askText('New name', t.name, 'Rename');
                      if (n?.trim()) {
                        await saveProjectTemplate({
                          ...t,
                          name: n.trim(),
                          updatedAt: new Date().toISOString(),
                        });
                        void refresh();
                      }
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={async () => {
                      // With its pictures, like design and project files (ADR-048).
                      const file = await projectTemplateFile(t);
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
                      );
                      Object.assign(document.createElement('a'), {
                        href: url,
                        download: `${t.name}.project-template.json`,
                      }).click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={async () => {
                      if (
                        await askConfirm(
                          `Delete project template “${t.name}”? Projects made from it stay.`,
                          { confirmLabel: 'Delete', danger: true },
                        )
                      ) {
                        await deleteProjectTemplate(t.id);
                        void refresh();
                      }
                    }}
                  >
                    Delete
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
