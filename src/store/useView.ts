import { createContext, useContext, useMemo } from 'react';
import { cutlist, hardwareSummary, type CutRow } from '../core/cutlist';
import { kerfOf } from '../core/design';
import { nestingJobs } from '../core/nesting/fromDesign';
import type { NestJob } from '@furniture-builder/nesting';
import { projectCutlist, projectHardware, projectNestingJobs } from '../core/project';
import { applyOwned, type OwnedSplit } from '../core/owned';
import { projectSellerChoices } from '../core/sellers/choices';
import type {
  Diagnostic,
  FurnitureModel,
  HardwareItem,
  HardwareProduct,
  Material,
  Panel,
  SellerItem,
} from '../core/types';
import { useDesign } from './designStore';
import { buildModel } from '../core/build';
import {
  backFixingPositions,
  fixingNote,
  fixingPositions,
  type FastenerChoice,
  type FixingPart,
} from '../core/fasteners';
import { useFastenerChoices } from './fastenerStore';

/** What the result panels, 3D and printout show: the piece being edited, or the whole open project. */
export interface ViewData {
  mode: 'design' | 'project';
  title: string;
  model: FurnitureModel;
  /** The model's panels grouped by piece (one group for a single piece). */
  pieces: Panel[][];
  materials: Material[];
  rows: CutRow[];
  /**
   * The rows still to cut (ADR-271): `rows` without the parts the user owns. The cut list, its CSV, the printed
   * cutting sheet and the sheet layouts use these; the estimate and shopping list keep `rows`.
   */
  cutRows: CutRow[];
  /** The owned parts of this view, and the marks that match no part now (ADR-271). */
  owned: OwnedSplit;
  hardware: HardwareItem[];
  diagnostics: Diagnostic[];
  kerf: number;
  jobs: () => NestJob[];
  /** Seller products chosen for hardware lines and added items (ADR-161); a project gathers its pieces'. */
  hardwareProducts?: Record<string, HardwareProduct>;
  sellerItems?: SellerItem[];
  /**
   * Drilling positions of the carcass joints by panel id (ADR-209), only once the user typed the edge distance of their
   * carcass-joint fastener; guidance, never saved. `tooShort`: joints shorter than twice that distance (none drawn).
   * With the back-fixing edge and spacing typed, the backs' positions too (G-439); `backsNotDrawn`: backs too small
   * for that edge distance or not rectangular (none drawn).
   */
  fixings?: { parts: Map<string, FixingPart>; tooShort: number; backsNotDrawn?: number };
}

/** Carcass-joint and back-fixing positions of one model (ADR-209, G-439), keyed by `prefix` + panel id. */
function allFixings(
  model: Pick<FurnitureModel, 'panels' | 'hardware'>,
  carcass: FastenerChoice | undefined,
  back: FastenerChoice | undefined,
  prefix = '',
): { parts: Map<string, FixingPart>; tooShort: number; backsNotDrawn: number } {
  const joints = fixingPositions(model, carcass, prefix);
  const backs = backFixingPositions(model, back, prefix);
  const parts = new Map(joints.parts);
  for (const [k, v] of backs.parts) {
    const cur = parts.get(k);
    parts.set(k, cur ? { ...cur, at: [...cur.at, ...v.at] } : v);
  }
  return { parts, tooShort: joints.tooShort, backsNotDrawn: backs.notDrawn };
}

/** The rows with each part's drilling positions in its notes (ADR-209); the same rows when there are none. */
function withFixingNotes(rows: CutRow[], parts: Map<string, FixingPart>): CutRow[] {
  if (!parts.size) return rows;
  return rows.map((r) => {
    const notes = [
      ...new Set(r.panelIds.flatMap((id) => (parts.has(id) ? [fixingNote(parts.get(id)!)] : []))),
    ];
    return notes.length ? { ...r, drilling: [r.drilling, ...notes].filter(Boolean).join('; ') } : r;
  });
}

/**
 * A view shown instead of the open design or project: a shared item's preview (ADR-143). Read-only: the 3D viewer
 * selects nothing and shows no tools while it is set.
 */
export const ViewOverride = createContext<ViewData | null>(null);

export function useView(): ViewData {
  const override = useContext(ViewOverride);
  const design = useDesign((s) => s.design);
  const model = useDesign((s) => s.model);
  const project = useDesign((s) => s.project);
  const projectModel = useDesign((s) => s.projectModel);
  const editing = useDesign((s) => s.editingItemId);
  // The user's carcass-joint fastener (ADR-209): drilling positions only once its edge distance is typed.
  const choices = useFastenerChoices();
  const carcass = choices.find((c) => c.joint === 'carcass-joint');
  // The user's back fixing (G-439): positions only once its edge distance and spacing are typed.
  const back = choices.find((c) => c.joint === 'back-fixing');
  const own = useMemo((): ViewData => {
    if (project && projectModel && !editing) {
      const fixings = { parts: new Map<string, FixingPart>(), tooShort: 0, backsNotDrawn: 0 };
      if (carcass?.edge !== undefined || (back?.edge !== undefined && back.spacing !== undefined))
        for (const item of project.items) {
          const f = allFixings(buildModel(item.design), carcass, back, `${item.id}:`);
          for (const [k, v] of f.parts) fixings.parts.set(k, v);
          fixings.tooShort += f.tooShort;
          fixings.backsNotDrawn += f.backsNotDrawn;
        }
      // Owned parts are taken off before the drilling notes are added: a note must not change a part's key.
      const base = projectCutlist(project, projectModel);
      const split = applyOwned(base, project.ownedParts, projectModel.materials);
      const rows = withFixingNotes(base, fixings.parts);
      const cutRows = withFixingNotes(split.cut, fixings.parts);
      return {
        mode: 'project',
        title: project.name,
        model: projectModel.model,
        pieces: projectModel.piecePanels,
        materials: projectModel.materials,
        rows,
        cutRows,
        owned: split,
        hardware: projectHardware(project, projectModel),
        diagnostics: projectModel.diagnostics,
        kerf: project.cutting?.kerf ?? 4,
        jobs: () => projectNestingJobs(project, cutRows, projectModel.materials),
        ...projectSellerChoices(project),
        fixings,
      };
    }
    const fixings = allFixings(model, carcass, back);
    const base = cutlist(model, design.materials);
    const split = applyOwned(base, design.ownedParts, design.materials);
    return {
      mode: 'design',
      title: design.name,
      model,
      pieces: [model.panels],
      materials: design.materials,
      rows: withFixingNotes(base, fixings.parts),
      cutRows: withFixingNotes(split.cut, fixings.parts),
      owned: split,
      fixings,
      hardware: hardwareSummary(model),
      diagnostics: model.diagnostics,
      kerf: kerfOf(design),
      jobs: () => nestingJobs(design, model, split.cut).jobs,
      hardwareProducts: design.hardwareProducts,
      sellerItems: design.sellerItems,
    };
  }, [design, model, project, projectModel, editing, carcass, back]);
  return override ?? own;
}
