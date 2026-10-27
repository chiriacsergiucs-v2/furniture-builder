import { useMemo } from 'react';
import { cutlist, hardwareSummary, type CutRow } from '../core/cutlist';
import { kerfOf } from '../core/design';
import { nestingJobs } from '../core/nesting/fromDesign';
import type { NestJob } from '../core/nesting/types';
import {
  buildProjectModel,
  projectCutlist,
  projectHardware,
  projectNestingJobs,
  selectionProject,
} from '../core/project';
import type { Diagnostic, FurnitureModel, HardwareItem, Material, Panel } from '../core/types';
import { useDesign } from '../store/designStore';
import { useUi } from './shell/uiStore';

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
}

export function useView(): ViewData {
  const design = useDesign((s) => s.design);
  const model = useDesign((s) => s.model);
  const project = useDesign((s) => s.project);
  const projectModel = useDesign((s) => s.projectModel);
  const editing = useDesign((s) => s.editingItemId);
  return useMemo((): ViewData => {
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
    };
  }, [design, model, project, projectModel, editing]);
}

/** Two pieces or more selected in the open project (N125): Parts and Sheets may show them alone. */
export function useMultiSelection(): string[] | null {
  const ids = useDesign((s) => s.selectedItemIds);
  const project = useDesign((s) => s.project);
  const editing = useDesign((s) => s.editingItemId);
  const n =
    project && !editing ? ids.filter((x) => project.items.some((i) => i.id === x)).length : 0;
  return n >= 2 ? ids : null;
}

/**
 * What Parts and Sheets show (N125): the whole project, or, with "Selection" chosen and two pieces or more selected,
 * the selected pieces as a project of their own (`selectionProject`). Everything else keeps `useView`.
 */
export function useResultView(): ViewData {
  const all = useView();
  const project = useDesign((s) => s.project);
  const ids = useMultiSelection();
  const only = useUi((s) => s.selectionOnly);
  return useMemo((): ViewData => {
    if (!project || !ids || !only) return all;
    const sub = selectionProject(project, ids);
    const pm = buildProjectModel(sub);
    const rows = projectCutlist(sub);
    return {
      mode: 'project',
      title: `${project.name} — selection (${sub.items.length} pieces)`,
      model: pm.model,
      pieces: pm.piecePanels,
      materials: pm.materials,
      rows,
      hardware: projectHardware(sub),
      diagnostics: pm.diagnostics,
      kerf: sub.cutting?.kerf ?? 4,
      jobs: () => projectNestingJobs(sub, rows, pm.materials),
    };
  }, [all, project, ids, only]);
}
