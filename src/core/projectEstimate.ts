/**
 * The cost estimate of a whole project (ADR-172 `estimate`), pure (ADR-210): its shopping lines from the project's cut
 * list, hardware, run parts, sinks and seller items, with the boards' sheet counts from a quick layout, priced by the
 * user's prices and the seller prices. Fill the room shows it on each mix and checks the budget ceiling with it.
 */
import { nest } from './nesting/place';
import { estimate, type Estimate, type PriceEntry, type SellerLookup } from './prices';
import {
  projectCutlist,
  projectHardware,
  projectNestingJobs,
  sinkList,
  type Project,
  type ProjectModel,
} from './project';
import { projectSellerChoices } from './sellers/choices';
import { shoppingList, type ShopLine } from './shopping';

interface ProjectEstimate {
  lines: ShopLine[];
  est: Estimate;
}

/**
 * The project's shopping lines and estimate. `sheets` (board id → sheets used) comes from the editor's layout when it
 * has one; absent, each board is laid out once here (one attempt, a fixed seed: deterministic).
 */
export function projectEstimate(
  project: Project,
  pm: ProjectModel,
  prices: readonly PriceEntry[],
  seller?: SellerLookup,
  sheets?: Map<string, number> | null,
): ProjectEstimate {
  const rows = projectCutlist(project);
  let counts = sheets;
  if (counts === undefined) {
    counts = new Map<string, number>();
    for (const job of projectNestingJobs(project, rows, pm.materials)) {
      const r = nest(job, { seed: 1, maxAttempts: 1 });
      if (!r.unplaced.length) counts.set(r.materialId, r.stats.sheetsUsed);
    }
  }
  const lines = shoppingList({
    rows,
    materials: pm.materials,
    hardware: projectHardware(project),
    sheets: counts,
    runParts: project.runParts,
    sinks: sinkList(project),
    diagnostics: pm.diagnostics,
    runProducts: project.runProducts,
    ...projectSellerChoices(project),
  });
  return { lines, est: estimate(lines, [...prices], seller) };
}
