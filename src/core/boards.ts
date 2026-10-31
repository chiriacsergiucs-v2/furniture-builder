/**
 * Board choices (ADR-164): every board select offers the project's boards (every piece, merged by `materialKey`;
 * outside a project the piece's own boards), then the user's decor list (ADR-049). The built-in boards are offered
 * only when there is nothing else (a new piece outside a project).
 */
import { t, tr } from './i18n';
import { defaultMaterials } from './design';
import { projectBoards } from './finish';
import { decorPatch, type Decor } from './materials';
import { materialKey, type Project } from './project';
import { bandKey } from './cutlist';
import type { Design, EdgeBand, Material } from './types';

export interface BoardChoice {
  /** `materialKey` of a board, or `decor:<id>` for a decor. */
  key: string;
  label: string;
  board: Material;
}

export const decorKey = (d: Decor) => `decor:${d.id}`;

/** A board in a select: "name, thickness mm" (the maker and type labels stay on the Boards panel, ADR-163). */
export const boardLabel = (m: Material) =>
  t('{name}, {thickness} mm', { name: tr(m.name), thickness: m.thickness });

/** A decor as a board: the list's values on a copy of `like` (grain and sheet stay, ADR-055). */
export const decorBoard = (d: Decor, like?: Material): Material =>
  ({
    id: 'decor',
    grain: like?.grain ?? false,
    ...(like?.sheet ? { sheet: like.sheet } : {}),
    ...decorPatch(d),
  }) as Material;

export function boardChoices(
  project: Project | null | undefined,
  design: Design | null | undefined,
  decors: readonly Decor[] = [],
  like?: Material,
): BoardChoice[] {
  const own = project ? projectBoards(project) : design ? uniqueBoards(design.materials) : [];
  const boards = own.length || decors.length ? own : defaultMaterials();
  return [
    ...boards.map((m) => ({ key: materialKey(m), label: boardLabel(m), board: m })),
    ...decors.map((d) => ({
      key: decorKey(d),
      label: t('{name}, {thickness} mm (your list)', {
        name: `${d.makerText} ${d.code} ${d.name}`,
        thickness: d.thickness,
      }),
      board: decorBoard(d, like),
    })),
  ];
}

function uniqueBoards(materials: readonly Material[]): Material[] {
  const out = new Map<string, Material>();
  for (const m of materials) if (!out.has(materialKey(m))) out.set(materialKey(m), m);
  return [...out.values()];
}

/** Every edge band named in a project (or a piece): on boards, roles, parts and run parts, one per spec (ADR-168). */
export function projectBands(
  project: Project | null | undefined,
  design: Design | null | undefined,
): EdgeBand[] {
  const out = new Map<string, EdgeBand>();
  const put = (b: EdgeBand | undefined) => {
    if (b && !out.has(bandKey(b))) out.set(bandKey(b), b);
  };
  const designs = project ? project.items.map((i) => i.design) : design ? [design] : [];
  for (const d of designs) {
    for (const m of d.materials) {
      put(m.band);
      put(m.frontBand);
    }
    for (const b of Object.values(d.roleBands ?? {})) put(b);
    for (const b of Object.values(d.partBands ?? {})) put(b);
  }
  for (const rp of project?.runParts ?? []) put(rp.material.band);
  return [...out.values()];
}
