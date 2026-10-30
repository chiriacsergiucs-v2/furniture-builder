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
import { useDesign } from '../store/designStore';

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
  /** Seller products chosen for hardware lines and added items (ADR-160); a project gathers its pieces'. */
  hardwareProducts?: Record<string, HardwareProduct>;
  sellerItems?: SellerItem[];
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
  const own = useMemo((): ViewData => {
    if (project && projectModel && !editing) {
      const rows = projectCutlist(project);
      return {
        mode: 'project',
        title: project.name,
        model: projectModel.model,
        pieces: projectModel.piecePanels,
        materials: projectModel.materials,
        rows,
        hardware: projectHardware(project),
        diagnostics: projectModel.diagnostics,
        kerf: project.cutting?.kerf ?? 4,
        jobs: () => projectNestingJobs(project, rows, projectModel.materials),
        ...projectSellerChoices(project),
      };
    }
    return {
      mode: 'design',
      title: design.name,
      model,
      pieces: [model.panels],
      materials: design.materials,
      rows: cutlist(model, design.materials),
      hardware: hardwareSummary(model),
      diagnostics: model.diagnostics,
      kerf: kerfOf(design),
      jobs: () => nestingJobs(design, model).jobs,
      hardwareProducts: design.hardwareProducts,
      sellerItems: design.sellerItems,
    };
  }, [design, model, project, projectModel, editing]);
  return override ?? own;
}
