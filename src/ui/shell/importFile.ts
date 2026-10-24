import { newId, validateDesign } from '../../core/design';
import type { Design } from '../../core/types';
import { validateProject, type Project } from '../../core/project';
import { saveDesign, saveProject, saveProjectTemplate } from '../../persist/db';
import { readProjectTemplateFile } from '../../persist/projectTemplateFile';
import { takePictures } from '../../persist/images';
import { useDesign } from '../../store/designStore';

export interface ImportResult {
  /** A design or project was saved as a new copy and is now open in the editor. */
  opened: boolean;
  /** What to tell the user; absent when the file opened cleanly. */
  message?: { ok: boolean; text: string };
}

/**
 * Import a design, project or project-template file chosen on this device (ADR-011, ADR-048, ADR-060). The file is
 * validated before anything is stored; designs and projects get new ids and open in the editor; a project template
 * is stored as a template. One importer for every place that offers "Import a file" (ADR-078).
 */
export async function importFile(f: File): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await f.text());
  } catch {
    return { opened: false, message: { ok: false, text: 'That file could not be read as JSON.' } };
  }
  try {
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { kind?: unknown }).kind === 'project-template'
    ) {
      const r = await readProjectTemplateFile(parsed);
      if (!r.ok) return { opened: false, message: { ok: false, text: r.error } };
      try {
        await saveProjectTemplate(r.template);
      } catch {
        return {
          opened: false,
          message: { ok: false, text: 'The project template could not be saved on this device.' },
        };
      }
      return {
        opened: false,
        message: {
          ok: true,
          text: `Project template “${r.template.name}” imported. Use it from Projects → Create from a project template.${r.problems.length ? ` ${r.problems.slice(0, 3).join(' ')}` : ''}`,
        },
      };
    }
    const isProject = !!parsed && typeof parsed === 'object' && 'items' in parsed;
    const errs = isProject ? validateProject(parsed) : validateDesign(parsed);
    if (errs.length)
      return {
        opened: false,
        message: {
          ok: false,
          text: `That file is not a valid ${isProject ? 'project' : 'design'}: ${errs.slice(0, 3).join('; ')}.`,
        },
      };
    // Pictures carried in the file go to this device (ADR-048); a bad one is reported, the file still opens.
    const { data, problems } = await takePictures(parsed);
    const now = new Date().toISOString();
    if (isProject) {
      const p = { ...(data as Project), id: newId(), updatedAt: now };
      await saveProject(p);
      useDesign.getState().openProject(p);
    } else {
      const copy = { ...(data as Design), id: newId(), updatedAt: now };
      await saveDesign(copy);
      useDesign.getState().load(copy);
    }
    return problems.length
      ? {
          opened: true,
          message: { ok: false, text: `Opened, but ${problems.slice(0, 3).join(' ')}` },
        }
      : { opened: true };
  } catch {
    return {
      opened: false,
      message: { ok: false, text: 'That file could not be saved on this device.' },
    };
  }
}
