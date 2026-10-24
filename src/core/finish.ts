/**
 * Finish scope (ADR-055): put one board on the fronts or the carcass of this piece, this run or the whole project.
 * A one-time change: every piece stays its own copy (ADR-022) and can be changed again on its own.
 */
import { newId } from './design';
import { materialKey, runOf, type Project, type ProjectItem } from './project';
import type { Design, Material } from './types';

export type FinishRole = 'front' | 'body';
export type FinishScope = 'piece' | 'run' | 'project';

/** Every board used by a piece in the project, one per board (name + thickness + grain + picture). */
export function projectBoards(project: Project): Material[] {
  const out = new Map<string, Material>();
  for (const it of project.items)
    for (const m of it.design.materials) if (!out.has(materialKey(m))) out.set(materialKey(m), m);
  return [...out.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.thickness - b.thickness,
  );
}

/** The board id this role uses on a piece, or null when the piece has no such part (a bed has no fronts). */
export function roleBoard(d: Design, role: FinishRole): string | null {
  const p = d.product;
  if (p.kind === 'cabinet' || p.kind === 'corner' || p.kind === 'desk')
    return role === 'front' ? p.params.frontMaterialId : p.params.bodyMaterialId;
  if (p.kind === 'panel') return role === 'front' ? p.params.materialId : null;
  return null;
}

function withRoleBoard(d: Design, role: FinishRole, id: string): Design {
  const p = d.product;
  if (p.kind === 'cabinet')
    return {
      ...d,
      product: {
        ...p,
        params: { ...p.params, [role === 'front' ? 'frontMaterialId' : 'bodyMaterialId']: id },
      },
    };
  if (p.kind === 'corner')
    return {
      ...d,
      product: {
        ...p,
        params: { ...p.params, [role === 'front' ? 'frontMaterialId' : 'bodyMaterialId']: id },
      },
    };
  if (p.kind === 'desk')
    return {
      ...d,
      product: {
        ...p,
        params: { ...p.params, [role === 'front' ? 'frontMaterialId' : 'bodyMaterialId']: id },
      },
    };
  if (p.kind === 'panel' && role === 'front')
    return { ...d, product: { ...p, params: { ...p.params, materialId: id } } };
  return d;
}

/** The pieces a scope reaches from the selected piece; "run" falls back to the piece when it is not in a run. */
export function finishTargets(project: Project, id: string, scope: FinishScope): ProjectItem[] {
  if (scope === 'project') return project.items;
  const ids = scope === 'run' ? (runOf(project, id) ?? [id]) : [id];
  return project.items.filter((i) => ids.includes(i.id));
}

export interface FinishResult {
  project: Project;
  applied: string[];
  skipped: string[];
}

export function applyFinish(
  project: Project,
  id: string,
  role: FinishRole,
  board: Material,
  scope: FinishScope,
): FinishResult {
  const targets = new Set(finishTargets(project, id, scope).map((i) => i.id));
  const key = materialKey(board);
  const applied: string[] = [],
    skipped: string[] = [];
  const items = project.items.map((it) => {
    if (!targets.has(it.id)) return it;
    if (roleBoard(it.design, role) === null) {
      skipped.push(`${it.design.name} has no ${role === 'front' ? 'fronts' : 'carcass'}`);
      return it;
    }
    const have = it.design.materials.find((m) => materialKey(m) === key);
    const mat = have ?? { ...board, id: newId() };
    applied.push(it.design.name);
    const d = {
      ...it.design,
      materials: have ? it.design.materials : [...it.design.materials, mat],
    };
    return { ...it, design: withRoleBoard(d, role, mat.id) };
  });
  // Fillers and covers next to changed fronts take the new board; the worktop keeps its own.
  const runParts =
    role === 'front' && project.runParts
      ? project.runParts.map((rp) =>
          (rp.kind === 'filler' || rp.kind === 'cover') && rp.from?.some((x) => targets.has(x))
            ? { ...rp, material: { ...board, id: rp.material.id } }
            : rp,
        )
      : project.runParts;
  return { project: { ...project, items, ...(runParts ? { runParts } : {}) }, applied, skipped };
}
