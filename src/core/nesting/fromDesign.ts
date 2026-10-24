import { cutlist, type CutRow } from '../cutlist';
import { kerfOf, sheetOf } from '../design';
import type { Design, FurnitureModel } from '../types';
import { jobsFromCutlist, type SheetSettings } from './index';
import type { NestJob } from './types';

/** Nesting jobs for every material in the design, from the cut list (ADR-004, ADR-018, ADR-019). */
export function nestingJobs(
  design: Design,
  model: FurnitureModel,
): { jobs: NestJob[]; rows: CutRow[] } {
  const rows = cutlist(model, design.materials);
  const kerf = kerfOf(design);
  const settings = new Map<string, SheetSettings>();
  for (const m of design.materials) {
    const s = sheetOf(m);
    settings.set(m.id, {
      sheet: { length: s.length, width: s.width, count: s.count },
      trim: s.trim,
      kerf,
    });
  }
  return { jobs: jobsFromCutlist(rows, settings), rows };
}
