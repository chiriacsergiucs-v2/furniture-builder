import { useEffect, useRef } from 'react';
import { exportFusionPython } from '../../core/fusion';
import { withPictures } from '../../persist/images';
import { withModels } from '../../persist/models';
import { useDesign } from '../../store/designStore';
import { Icon } from '../icons';
import { download, downloadFrontSvg, fileName } from './files';
import { importFile } from './importFile';
import { useUi } from './uiStore';

/**
 * The ⋯ More menu in the app bar (ADR-078): starting something new, every file in and out of the app (Files), and
 * Feature Research. Nothing here sits in the top or bottom bar itself. Escape and a click outside close it.
 */
export function MoreMenu({
  onNew,
  onOpened,
  onResearch,
}: {
  onNew: () => void;
  onOpened: () => void;
  onResearch: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const design = useDesign((s) => s.design);
  const model = useDesign((s) => s.model);
  const project = useDesign((s) => s.project);
  const editingItemId = useDesign((s) => s.editingItemId);
  const inProject = !!project && !editingItemId;
  const setNotice = useUi((s) => s.setNotice);
  const close = () => ref.current?.removeAttribute('open');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) {
        close();
        ref.current?.querySelector('summary')?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const run = (fn: () => void | Promise<void>) => () => {
    close();
    void fn();
  };

  return (
    <details className="menu more" ref={ref}>
      <summary aria-label="More" title="New, files and Feature Research">
        <Icon name="more" />
      </summary>
      <div className="menu-items">
        <button type="button" onClick={run(onNew)}>
          <Icon name="plus" />
          New… <small>piece or project</small>
        </button>
        <p className="menu-head" id="menu-files">
          Files
        </p>
        <div role="group" aria-labelledby="menu-files">
          {inProject ? (
            <button
              type="button"
              onClick={run(async () =>
                download(
                  `${fileName(project.name)}-project.json`,
                  JSON.stringify(
                    await withPictures(await withModels(project), [
                      ...project.items.map((i) => i.design),
                      { materials: (project.runParts ?? []).map((r) => r.material) },
                    ]),
                    null,
                    2,
                  ),
                  'application/json',
                ),
              )}
            >
              <Icon name="download" />
              Project file <small>to open on another device</small>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={run(async () =>
                  download(
                    `${fileName(design.name)}.json`,
                    JSON.stringify(await withPictures(design, [design]), null, 2),
                    'application/json',
                  ),
                )}
              >
                <Icon name="download" />
                Design file <small>to open on another device</small>
              </button>
              <button
                type="button"
                onClick={run(() => {
                  if (!downloadFrontSvg(design))
                    setNotice({ ok: false, text: 'Open the piece in the editor first.' });
                })}
              >
                <Icon name="front" />
                Front view drawing <small>SVG</small>
              </button>
              <button
                type="button"
                onClick={run(() =>
                  download(
                    `${fileName(design.name)}-fusion.py`,
                    exportFusionPython(design, model),
                    'text/x-python',
                  ),
                )}
              >
                <Icon name="cube" />
                Fusion 360 script <small>not yet tested in Fusion</small>
              </button>
            </>
          )}
          <label className="menu-file">
            <Icon name="upload" />
            Import a file <small>design, project or project template</small>
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import a file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                close();
                if (!f) return;
                void importFile(f).then((r) => {
                  setNotice(r.message ?? null);
                  if (r.opened) onOpened();
                });
              }}
            />
          </label>
        </div>
        <span className="menu-sep" aria-hidden="true" />
        <button type="button" onClick={run(onResearch)}>
          <Icon name="search" />
          Feature Research <small>papers and decisions</small>
        </button>
      </div>
    </details>
  );
}
