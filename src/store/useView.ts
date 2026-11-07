import { createContext, useContext, useMemo } from 'react';
import { cutlist, hardwareSummary, type CutRow } from '../core/cutlist';
import { kerfOf } from '../core/design';
import { nestingJobs } from '../core/nesting/fromDesign';
import type { NestJob } from '../core/nesting/types';
import { projectCutlist, projectHardware, projectNestingJobs } from '../core/project';
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
import { fixingNote, fixingPositions, type FixingPart } from '../core/fasteners';
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
   */
  fixings?: { parts: Map<string, FixingPart>; tooShort: number };
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
  const own = useMemo((): ViewData => {
    if (project && projectModel && !editing) {
      const fixings = { parts: new Map<string, FixingPart>(), tooShort: 0 };
      if (carcass?.edge !== undefined)
        for (const item of project.items) {
          const f = fixingPositions(buildModel(item.design), carcass, `${item.id}:`);
          for (const [k, v] of f.parts) fixings.parts.set(k, v);
          fixings.tooShort += f.tooShort;
        }
      const rows = withFixingNotes(projectCutlist(project, projectModel), fixings.parts);
      return {
        mode: 'project',
        title: project.name,
        model: projectModel.model,
        pieces: projectModel.piecePanels,
        materials: projectModel.materials,
        rows,
        hardware: projectHardware(project, projectModel),
        diagnostics: projectModel.diagnostics,
        kerf: project.cutting?.kerf ?? 4,
        jobs: () => projectNestingJobs(project, rows, projectModel.materials),
        ...projectSellerChoices(project),
        fixings,
      };
    }
    const fixings = fixingPositions(model, carcass);
    return {
      mode: 'design',
      title: design.name,
      model,
      pieces: [model.panels],
      materials: design.materials,
      rows: withFixingNotes(cutlist(model, design.materials), fixings.parts),
      fixings,
      hardware: hardwareSummary(model),
      diagnostics: model.diagnostics,
      kerf: kerfOf(design),
      jobs: () => nestingJobs(design, model).jobs,
      hardwareProducts: design.hardwareProducts,
      sellerItems: design.sellerItems,
    };
  }, [design, model, project, projectModel, editing, carcass]);
  return override ?? own;
}
