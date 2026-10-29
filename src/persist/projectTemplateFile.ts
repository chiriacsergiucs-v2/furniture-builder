/**
 * Project-template files (ADR-060) carry their pictures like design and project files do (ADR-048): export puts
 * every picture the pieces' materials use into the file; import checks the template first, then stores the pictures
 * on this device and returns the template without them. Never throws (ADR-008).
 */
import { newId } from '../core/design';
import { validateProjectTemplate, type ProjectTemplate } from '../core/projectTemplate';
import { db } from './db';
import { takePictures, withPictures } from './images';
import { t } from '../core/i18n';

/** The template as a file: the template plus `pictures` (when any are on this device). */
export const projectTemplateFile = (t: ProjectTemplate) =>
  withPictures(
    t,
    t.items.map((i) => i.design),
  );

export type ProjectTemplateImport =
  { ok: true; template: ProjectTemplate; problems: string[] } | { ok: false; error: string };

/** A parsed file as a new template (new id) ready to save, or why it cannot be one. */
export async function readProjectTemplateFile(
  parsed: unknown,
  database = db,
): Promise<ProjectTemplateImport> {
  let errs: string[];
  try {
    errs = validateProjectTemplate(parsed);
  } catch {
    errs = [t('it could not be checked')];
  }
  if (errs.length)
    return {
      ok: false,
      error: t('That file is not a valid project template: {problems}.', {
        problems: errs.slice(0, 3).join('; '),
      }),
    };
  const { data, problems } = await takePictures(parsed, database);
  return {
    ok: true,
    template: {
      ...(data as ProjectTemplate),
      id: newId(),
      updatedAt: new Date().toISOString(),
    },
    problems,
  };
}
