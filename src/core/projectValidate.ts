/**
 * Validation of saved and imported projects (ADR-011, ADR-022): moved out of project.ts unchanged (cleanup audit 2026-11-09, item 13).
 */
import {} from './build';
import {} from './compat';
import { MAX_ZONE_DEPTH, SERVICE_SIDES } from './envelopes';
import { validateRoom } from './room';
import {
  type ProjectVariable,
  isBindTarget,
  MAX_EXPR,
  MAX_VARIABLE_NAME,
  MAX_VARIABLES,
  nameProblem,
} from './variables';
import { bandProblems, productRefProblems } from './materials';
import { validateDesign, validPer } from './design';
import {} from './outline';
import { validateModelItems } from './model3d';
import { planPictureProblems } from './planPicture';
import type {} from './nesting';
import {} from './nesting';
import type {} from './nesting/types';
import { t } from './i18n';

import {
  ANGLE_SINCE,
  BAR_SPACINGS,
  COMMON_SINCE,
  CONNECTION_KINDS_SINCE,
  CONNECTIONS_SINCE,
  FITTED_WALLS_SINCE,
  FOLLOW_UPS_SINCE,
  GROUPS_SINCE,
  KITCHEN_SINCE,
  LINKS_SINCE,
  LOCKS_SINCE,
  MODELS_SINCE,
  PARAM_LOCKS_SINCE,
  PIECE_LOCKS_SINCE,
  PROJECT_SCHEMAS,
  REFS_SINCE,
  REQUEST_TARGETS,
  type RequestTarget,
  RUN_EXTRAS_SINCE,
  RUN_PRODUCTS_SINCE,
  RUN_REQUESTS_SINCE,
  SELLER_ITEMS_SINCE,
  SHARED_SINCE,
  SIZE_AXES,
  SIZE_LOCK_SINCE,
  SURFACES_SINCE,
  TEMPLATE_SEEN_SINCE,
  TRIM_KINDS,
  type TrimKind,
  VARIABLES_SINCE,
  WALLS_SINCE,
} from './project';

// ---------------------------------------------------------------------------
// Validation (storage, import)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min = -1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 1e7;

/** A sink's or hob's position (ADR-209): absent, or whole mm from 0 to 3000 on each axis. */
const validOffsets = (c: Record<string, unknown>) =>
  (c.x === undefined || (isInt(c.x, 0) && (c.x as number) <= 3000)) &&
  (c.z === undefined || (isInt(c.z, 0) && (c.z as number) <= 3000));
const hasOffsets = (c: Record<string, unknown>) => c.x !== undefined || c.z !== undefined;

/** Item clearance settings (ADR-073): whole-mm depths from 1 mm, a known side, a yes/no flag. */
function validZones(z: unknown): boolean {
  if (!isObj(z)) return false;
  const depth = (v: unknown) => isInt(v, 1) && (v as number) <= MAX_ZONE_DEPTH;
  const s = z.service;
  return (
    (z.chairDepth === undefined || depth(z.chairDepth)) &&
    (z.lyingDown === undefined || typeof z.lyingDown === 'boolean') &&
    (s === undefined ||
      (isObj(s) &&
        SERVICE_SIDES.includes(s.side as never) &&
        (s.depth === undefined || depth(s.depth))))
  );
}

const validBoard = (m: unknown) =>
  isObj(m) &&
  typeof m.id === 'string' &&
  typeof m.name === 'string' &&
  isInt(m.thickness, 1) &&
  typeof m.grain === 'boolean' &&
  (m.band === undefined || bandProblems(m.band).length === 0) &&
  (m.frontBand === undefined || bandProblems(m.frontBand).length === 0);

/** Project-wide settings (ADR-124): each one optional, each one checked. */
function validateSettings(s: unknown): string[] {
  if (!isObj(s)) return [t('Invalid project settings')];
  const errs: string[] = [];
  for (const k of ['body', 'front', 'back'] as const)
    if (s[k] !== undefined && !validBoard(s[k])) errs.push(t('Invalid project {k} board', { k }));
  const h = s.handle;
  if (
    h !== undefined &&
    h !== null &&
    !(
      isObj(h) &&
      ['bar', 'knob', 'push'].includes(h.kind as string) &&
      (h.holeSpacing === undefined || isInt(h.holeSpacing, 1)) &&
      (h.position === undefined || ['top', 'centre', 'bottom'].includes(h.position as string))
    )
  )
    errs.push(t('Invalid project handle'));
  if (s.frontStyle !== undefined && !['overlay', 'half', 'inset'].includes(s.frontStyle as string))
    errs.push(t('Invalid project front overlay'));
  if (
    s.plinthHeight !== undefined &&
    !(isInt(s.plinthHeight, 0) && (s.plinthHeight as number) <= 500)
  )
    errs.push(t('Project plinth height must be 0 to 500 mm'));
  return errs;
}

/** Variables and value sets (ADR-166, ADR-167). */
function validateVariables(p: Record<string, unknown>): string[] {
  const errs: string[] = [];
  const vars: ProjectVariable[] = [];
  if (p.variables !== undefined) {
    if (!Array.isArray(p.variables) || p.variables.length > MAX_VARIABLES)
      return [t('Invalid variables')];
    if ((p.schemaVersion as number) < VARIABLES_SINCE)
      errs.push(t('Variables need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    for (const v of p.variables) {
      if (
        !isObj(v) ||
        typeof v.id !== 'string' ||
        !v.id ||
        typeof v.name !== 'string' ||
        v.name.length > MAX_VARIABLE_NAME ||
        typeof v.expr !== 'string' ||
        v.expr.length > MAX_EXPR ||
        nameProblem(v.name, vars, false) !== null ||
        vars.some((x) => x.id === v.id)
      ) {
        errs.push(t('Invalid variable'));
        continue;
      }
      vars.push({ id: v.id, name: v.name, expr: v.expr });
    }
  }
  if (p.variableSets !== undefined) {
    if (!Array.isArray(p.variableSets) || p.variableSets.length > MAX_VARIABLES)
      return [...errs, t('Invalid value sets')];
    if ((p.schemaVersion as number) < VARIABLES_SINCE)
      errs.push(t('Value sets need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    const ids = new Set<string>();
    for (const s of p.variableSets) {
      if (
        !isObj(s) ||
        typeof s.id !== 'string' ||
        !s.id ||
        ids.has(s.id) ||
        typeof s.name !== 'string' ||
        !s.name ||
        s.name.length > MAX_VARIABLE_NAME ||
        !isObj(s.values) ||
        !Object.values(s.values).every((x) => typeof x === 'string' && x.length <= MAX_EXPR) ||
        !isObj(s.origin) ||
        !isInt(s.origin.x) ||
        !isInt(s.origin.z)
      ) {
        errs.push(t('Invalid value set'));
        continue;
      }
      ids.add(s.id);
    }
    if (Array.isArray(p.items))
      for (const it of p.items)
        if (isObj(it) && isObj(it.set) && typeof it.set.id === 'string' && !ids.has(it.set.id))
          errs.push(t('Item {id}: unknown value set', { id: String(it.id) }));
  }
  return errs;
}

export function validateProject(p: unknown): string[] {
  if (!isObj(p)) return [t('Project must be an object')];
  const errs: string[] = [];
  if (!PROJECT_SCHEMAS.includes(p.schemaVersion as number))
    errs.push(t('Unsupported project schemaVersion'));
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name)
    errs.push(t('Missing project id or name'));
  if (
    p.cutting !== undefined &&
    !(isObj(p.cutting) && isInt(p.cutting.kerf, 0) && (p.cutting.kerf as number) <= 20)
  )
    errs.push(t('Invalid cutting settings'));
  if (!Array.isArray(p.items)) return [...errs, t('Items missing')];
  const ids = new Set<string>();
  for (const it of p.items) {
    if (!isObj(it) || typeof it.id !== 'string' || !it.id) {
      errs.push(t('Invalid item'));
      continue;
    }
    if (ids.has(it.id)) errs.push(t('Duplicate item {id}', { id: it.id }));
    ids.add(it.id);
    if (!isInt(it.quantity, 1) || (it.quantity as number) > 99)
      errs.push(t('Item quantity must be 1 to 99'));
    if (
      !isObj(it.position) ||
      !isInt(it.position.x) ||
      !isInt(it.position.y, 0) ||
      !isInt(it.position.z)
    )
      errs.push(t('Item position must be whole mm (height ≥ 0)'));
    if (![0, 90, 180, 270].includes(it.rotationY as number))
      errs.push(t('Item rotation must be a quarter turn'));
    if (it.angle !== undefined) {
      if (!isInt(it.angle, 1) || (it.angle as number) > 89)
        errs.push(t('Item angle must be whole degrees from 1 to 89'));
      else if ((p.schemaVersion as number) < ANGLE_SINCE)
        errs.push(t('Pieces at an angle need project schemaVersion {v}', { v: ANGLE_SINCE }));
    }
    const pl = it.placement;
    if (
      pl !== undefined &&
      !(
        isObj(pl) &&
        (pl.kind === 'floor' ||
          (pl.kind === 'wall' && isInt(pl.height, 0)) ||
          (pl.kind === 'above' &&
            typeof pl.baseId === 'string' &&
            !!pl.baseId &&
            pl.baseId !== it.id &&
            isInt(pl.gap, 0) &&
            isInt(pl.offsetX)))
      )
    )
      errs.push(t('Invalid item placement'));
    if (it.zones !== undefined && !validZones(it.zones))
      errs.push(t('Invalid item clearance zones'));
    if (it.locked !== undefined) {
      if (it.locked !== true) errs.push(t('Invalid item lock'));
      else if ((p.schemaVersion as number) < LOCKS_SINCE)
        errs.push(t('Locked pieces need project schemaVersion {v}', { v: LOCKS_SINCE }));
    }
    if (it.templateSeen !== undefined) {
      if (!isInt(it.templateSeen, 1)) errs.push(t('Invalid kept template revision'));
      else if ((p.schemaVersion as number) < TEMPLATE_SEEN_SINCE)
        errs.push(
          t('Kept template revisions need project schemaVersion {v}', { v: TEMPLATE_SEEN_SINCE }),
        );
    }
    if (it.linkId !== undefined) {
      if (typeof it.linkId !== 'string' || !it.linkId || it.linkId.length > 100)
        errs.push(t('Invalid item link'));
      else if ((p.schemaVersion as number) < LINKS_SINCE)
        errs.push(t('Linked copies need project schemaVersion {v}', { v: LINKS_SINCE }));
    }
    if (it.turnLocked !== undefined) {
      if (it.turnLocked !== true) errs.push(t('Invalid item turn lock'));
      else if ((p.schemaVersion as number) < PARAM_LOCKS_SINCE)
        errs.push(
          t('Turn and size locks need project schemaVersion {v}', { v: PARAM_LOCKS_SINCE }),
        );
    }
    for (const [key, bad] of [
      ['boardsLocked', t('Invalid item boards lock')],
      ['constructionLocked', t('Invalid item construction lock')],
    ] as const) {
      if (it[key] === undefined) continue;
      if (it[key] !== true) errs.push(bad);
      else if ((p.schemaVersion as number) < PIECE_LOCKS_SINCE)
        errs.push(
          t('Board and construction locks need project schemaVersion {v}', {
            v: PIECE_LOCKS_SINCE,
          }),
        );
    }
    if (it.sizeLocks !== undefined) {
      if (
        !Array.isArray(it.sizeLocks) ||
        !it.sizeLocks.length ||
        !it.sizeLocks.every((a) => (SIZE_AXES as readonly unknown[]).includes(a)) ||
        new Set(it.sizeLocks).size !== it.sizeLocks.length
      )
        errs.push(t('Invalid item size locks'));
      else if ((p.schemaVersion as number) < PARAM_LOCKS_SINCE)
        errs.push(
          t('Turn and size locks need project schemaVersion {v}', { v: PARAM_LOCKS_SINCE }),
        );
    }
    if (it.sizeLocked !== undefined) {
      if (it.sizeLocked !== true) errs.push(t('Invalid item size lock'));
      else if ((p.schemaVersion as number) < SIZE_LOCK_SINCE)
        errs.push(t('Size-locked pieces need project schemaVersion {v}', { v: SIZE_LOCK_SINCE }));
    }
    if (it.ref !== undefined) {
      if (!isObj(it.ref) || !isObj(it.ref.overrides)) errs.push(t('Invalid template reference'));
      else if ((p.schemaVersion as number) < REFS_SINCE)
        errs.push(t('Template references need project schemaVersion {v}', { v: REFS_SINCE }));
    }
    if (it.bindings !== undefined) {
      if (
        !Array.isArray(it.bindings) ||
        !it.bindings.every(
          (b) =>
            isObj(b) &&
            isBindTarget(b.target) &&
            typeof b.expr === 'string' &&
            b.expr.length <= MAX_EXPR,
        ) ||
        new Set(it.bindings.map((b) => (isObj(b) ? b.target : ''))).size !== it.bindings.length
      )
        errs.push(t('Invalid item bindings'));
      else if ((p.schemaVersion as number) < VARIABLES_SINCE)
        errs.push(t('Bindings need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    }
    if (it.set !== undefined) {
      if (!isObj(it.set) || typeof it.set.id !== 'string' || typeof it.set.of !== 'string')
        errs.push(t('Invalid item value set'));
      else if ((p.schemaVersion as number) < VARIABLES_SINCE)
        errs.push(t('Value sets need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    }
    if (it.backCuts !== undefined) {
      if (
        !Array.isArray(it.backCuts) ||
        !it.backCuts.length ||
        !it.backCuts.every((x) => typeof x === 'string' && !!x) ||
        new Set(it.backCuts).size !== it.backCuts.length
      )
        errs.push(t('Invalid back cut-outs'));
      else if ((p.schemaVersion as number) < KITCHEN_SINCE)
        errs.push(t('Backs cut around pipes need project schemaVersion {v}', { v: KITCHEN_SINCE }));
    }
    const de = validateDesign(it.design);
    if (de.length) errs.push(t('Item {id}: {problem}', { id: String(it.id), problem: de[0] }));
  }
  errs.push(...validateVariables(p));
  if (p.runParts !== undefined) {
    if (!Array.isArray(p.runParts)) errs.push(t('Invalid run parts'));
    else
      for (const rp of p.runParts) {
        const b = isObj(rp) ? rp.box : null;
        const m = isObj(rp) ? rp.material : null;
        if (
          !isObj(rp) ||
          typeof rp.id !== 'string' ||
          !['worktop', 'filler', 'cover', 'plinth', ...TRIM_KINDS].includes(rp.kind as string) ||
          typeof rp.label !== 'string' ||
          typeof rp.reason !== 'string' ||
          (rp.key !== undefined && typeof rp.key !== 'string') ||
          (rp.from !== undefined &&
            !(Array.isArray(rp.from) && rp.from.every((x) => typeof x === 'string'))) ||
          (rp.scribe !== undefined && !isInt(rp.scribe, 0)) ||
          (rp.changed !== undefined && typeof rp.changed !== 'string') ||
          !isObj(b) ||
          !['x', 'y', 'z'].every((k) => isInt(b[k])) ||
          !['w', 'h', 'd'].every((k) => isInt(b[k], 1)) ||
          !isObj(m) ||
          typeof m.name !== 'string' ||
          !isInt(m.thickness, 1) ||
          typeof m.grain !== 'boolean' ||
          (m.band !== undefined && bandProblems(m.band).length > 0) ||
          (m.frontBand !== undefined && bandProblems(m.frontBand).length > 0) ||
          !['x', 'y', 'z'].includes(rp.thicknessAxis as string) ||
          !['x', 'y', 'z'].includes(rp.grainAxis as string) ||
          !Array.isArray(rp.banded)
        )
          errs.push(t('Invalid run part'));
      }
  }
  if (
    p.runSettings !== undefined &&
    !(
      isObj(p.runSettings) &&
      isInt(p.runSettings.scribe, 0) &&
      (p.runSettings.scribe as number) <= 200 &&
      typeof p.runSettings.auto === 'boolean'
    )
  )
    errs.push(t('Invalid run settings'));
  if (p.runRequests !== undefined) {
    if (!Array.isArray(p.runRequests)) errs.push(t('Invalid run requests'));
    else
      for (const r of p.runRequests) {
        const m = isObj(r) ? r.material : undefined;
        // ADR-209: a profile (crown, pelmet), bindings and the repair filler, from schemaVersion 21. A profile's shape is
        // checked as a diagnostic (`trim-profile-invalid`), not here: only its whole-mm points are.
        if (
          isObj(r) &&
          (r.profile !== undefined || r.bindings !== undefined || r.kind === 'filler') &&
          (p.schemaVersion as number) < FOLLOW_UPS_SINCE
        )
          errs.push(
            t('Moulding profiles, bindings and repair fillers need project schemaVersion {v}', {
              v: FOLLOW_UPS_SINCE,
            }),
          );
        if (
          isObj(r) &&
          ((r.profile !== undefined &&
            (!(r.kind === 'crown' || r.kind === 'pelmet') ||
              !Array.isArray(r.profile) ||
              r.profile.length > 100 ||
              !r.profile.every(
                (pt) =>
                  Array.isArray(pt) &&
                  pt.length === 2 &&
                  pt.every((n) => isInt(n) && Math.abs(n as number) <= 1000),
              ))) ||
            (r.bindings !== undefined &&
              (!Array.isArray(r.bindings) ||
                r.bindings.length > REQUEST_TARGETS.length ||
                !r.bindings.every(
                  (b) =>
                    isObj(b) &&
                    REQUEST_TARGETS.includes(b.target as RequestTarget) &&
                    typeof b.expr === 'string' &&
                    b.expr.length <= MAX_EXPR,
                ))) ||
            (r.kind === 'filler' &&
              (!Array.isArray(r.from) ||
                r.from.length !== 2 ||
                !(isInt(r.width, 1) && (r.width as number) <= 3000))) ||
            (r.kind !== 'filler' && r.width !== undefined))
        )
          errs.push(t('Invalid run request'));
        if (
          !isObj(r) ||
          !['worktop', 'filler', ...TRIM_KINDS].includes(r.kind as string) ||
          !Array.isArray(r.from) ||
          !r.from.length ||
          !r.from.every((x) => typeof x === 'string') ||
          (r.front !== undefined && !(isInt(r.front, 0) && (r.front as number) <= 1000)) ||
          (r.side !== undefined && !(isInt(r.side, 0) && (r.side as number) <= 1000)) ||
          (r.height !== undefined && !(isInt(r.height, 1) && (r.height as number) <= 3000)) ||
          (m !== undefined &&
            !(
              isObj(m) &&
              typeof m.name === 'string' &&
              isInt(m.thickness, 1) &&
              typeof m.grain === 'boolean'
            ))
        )
          errs.push(t('Invalid run request'));
      }
  }
  // Run requests and trim run parts came with version 2 (ADR-075).
  if (
    (p.schemaVersion as number) < RUN_REQUESTS_SINCE &&
    (p.runRequests !== undefined ||
      (Array.isArray(p.runParts) &&
        p.runParts.some((rp) => isObj(rp) && TRIM_KINDS.includes(rp.kind as TrimKind))))
  )
    errs.push(
      t('Trims and chosen worktops need project schemaVersion {v}', { v: RUN_REQUESTS_SINCE }),
    );
  if (p.room !== undefined) {
    errs.push(...validateRoom(p.room));
    if (isObj(p.room) && p.room.walls !== undefined && (p.schemaVersion as number) < WALLS_SINCE)
      errs.push(t('Wall backgrounds need project schemaVersion {v}', { v: WALLS_SINCE }));
    if (
      isObj(p.room) &&
      Array.isArray(p.room.walls) &&
      p.room.walls.some(
        (f) =>
          isObj(f) &&
          isObj(f.image) &&
          (f.image.fit !== undefined || f.image.straighten !== undefined),
      ) &&
      (p.schemaVersion as number) < FITTED_WALLS_SINCE
    )
      errs.push(
        t('Fitted wall pictures need project schemaVersion {v}', { v: FITTED_WALLS_SINCE }),
      );
  }
  if (
    p.runPartsRemoved !== undefined &&
    !(Array.isArray(p.runPartsRemoved) && p.runPartsRemoved.every((k) => typeof k === 'string'))
  )
    errs.push(t('Invalid removed run parts'));
  if (p.groups !== undefined) {
    if ((p.schemaVersion as number) < GROUPS_SINCE)
      errs.push(t('Groups need project schemaVersion {v}', { v: GROUPS_SINCE }));
    const grouped = new Set<string>();
    const groupIds = new Set<string>();
    if (!Array.isArray(p.groups)) errs.push(t('Invalid groups'));
    else
      for (const g of p.groups) {
        if (
          !isObj(g) ||
          typeof g.id !== 'string' ||
          !g.id ||
          groupIds.has(g.id) ||
          typeof g.name !== 'string' ||
          !g.name.trim() ||
          g.name.length > 200 ||
          !Array.isArray(g.itemIds) ||
          g.itemIds.length < 2 ||
          !g.itemIds.every((x) => typeof x === 'string' && ids.has(x) && !grouped.has(x))
        ) {
          errs.push(t('Invalid group'));
          continue;
        }
        groupIds.add(g.id);
        for (const x of g.itemIds) grouped.add(x as string);
      }
  }
  if (p.common !== undefined) {
    if ((p.schemaVersion as number) < COMMON_SINCE)
      errs.push(t('Common tops and bottoms need project schemaVersion {v}', { v: COMMON_SINCE }));
    const seen = new Set<string>();
    const inKind = { top: new Set<string>(), bottom: new Set<string>() };
    if (!Array.isArray(p.common)) errs.push(t('Invalid common tops and bottoms'));
    else
      for (const c of p.common) {
        if (
          !isObj(c) ||
          typeof c.id !== 'string' ||
          !c.id ||
          seen.has(c.id) ||
          (c.kind !== 'top' && c.kind !== 'bottom') ||
          !Array.isArray(c.itemIds) ||
          c.itemIds.length < 2 ||
          !c.itemIds.every(
            (x) =>
              typeof x === 'string' && ids.has(x) && !inKind[c.kind as 'top' | 'bottom'].has(x),
          )
        ) {
          errs.push(t('Invalid common top or bottom'));
          continue;
        }
        seen.add(c.id);
        for (const x of c.itemIds) inKind[c.kind as 'top' | 'bottom'].add(x as string);
      }
  }
  if (p.sharedSides !== undefined) {
    if ((p.schemaVersion as number) < SHARED_SINCE)
      errs.push(t('Shared sides need project schemaVersion {v}', { v: SHARED_SINCE }));
    const seen = new Set<string>();
    const sharing = new Set<string>();
    if (!Array.isArray(p.sharedSides)) errs.push(t('Invalid shared sides'));
    else
      for (const c of p.sharedSides) {
        if (
          !isObj(c) ||
          typeof c.id !== 'string' ||
          !c.id ||
          seen.has(c.id) ||
          !Array.isArray(c.itemIds) ||
          c.itemIds.length < 2 ||
          !c.itemIds.every((x) => typeof x === 'string' && ids.has(x) && !sharing.has(x))
        ) {
          errs.push(t('Invalid shared sides'));
          continue;
        }
        seen.add(c.id);
        for (const x of c.itemIds) sharing.add(x as string);
      }
  }
  if (p.connections !== undefined) {
    if ((p.schemaVersion as number) < CONNECTIONS_SINCE)
      errs.push(t('Connections need project schemaVersion {v}', { v: CONNECTIONS_SINCE }));
    const seen = new Set<string>();
    const pairs = new Set<string>();
    if (!Array.isArray(p.connections)) errs.push(t('Invalid connections'));
    else
      for (const c of p.connections) {
        // A kind (ADR-207) needs version 21; a wall connection holds one piece and the index of its wall.
        const kind = isObj(c) ? c.kind : undefined;
        if (kind !== undefined && (p.schemaVersion as number) < CONNECTION_KINDS_SINCE) {
          errs.push(
            t('Connection kinds need project schemaVersion {v}', { v: CONNECTION_KINDS_SINCE }),
          );
          continue;
        }
        const wall = kind === 'wall';
        const pair = isObj(c) && Array.isArray(c.itemIds) ? (c.itemIds as unknown[]) : null;
        // A wall connection holds its one piece twice (ADR-207).
        const key =
          pair &&
          pair.length === 2 &&
          pair.every((x) => typeof x === 'string') &&
          (!wall || pair[0] === pair[1])
            ? wall
              ? `wall:${pair[0] as string}:${String(c.wall)}`
              : [...(pair as string[])].sort().join('|')
            : '';
        if (
          !isObj(c) ||
          typeof c.id !== 'string' ||
          !c.id ||
          seen.has(c.id) ||
          (kind !== undefined && !['side', 'corner', 'stacked', 'wall'].includes(kind as string)) ||
          (wall ? !isInt(c.wall, 0) || (c.wall as number) > 999 : c.wall !== undefined) ||
          !key ||
          (!wall && pair![0] === pair![1]) ||
          !pair!.every((x) => ids.has(x as string)) ||
          pairs.has(key)
        ) {
          errs.push(t('Invalid connection'));
          continue;
        }
        seen.add(c.id);
        pairs.add(key);
      }
  }
  if (p.settings !== undefined) {
    if ((p.schemaVersion as number) < REFS_SINCE)
      errs.push(t('Project settings need project schemaVersion {v}', { v: REFS_SINCE }));
    errs.push(...validateSettings(p.settings));
  }
  if (p.runHandles !== undefined || p.sinks !== undefined) {
    if ((p.schemaVersion as number) < RUN_EXTRAS_SINCE)
      errs.push(t('Run handles and sinks need project schemaVersion {v}', { v: RUN_EXTRAS_SINCE }));
    const strs = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
    if (p.runHandles !== undefined) {
      if (!Array.isArray(p.runHandles)) errs.push(t('Invalid run handles'));
      else
        for (const rh of p.runHandles) {
          const h = isObj(rh) ? rh.handle : null;
          if (
            !isObj(rh) ||
            typeof rh.id !== 'string' ||
            !rh.id ||
            !strs(rh.from) ||
            !(rh.from as string[]).length ||
            (rh.own !== undefined && !strs(rh.own)) ||
            (rh.height !== undefined && !(isInt(rh.height, 1) && (rh.height as number) <= 3000)) ||
            !isObj(h) ||
            !['bar', 'knob', 'push'].includes(h.kind as string) ||
            (h.holeSpacing !== undefined && !BAR_SPACINGS.includes(h.holeSpacing as number))
          )
            errs.push(t('Invalid run handle'));
        }
    }
    if (p.sinks !== undefined) {
      if (!Array.isArray(p.sinks)) errs.push(t('Invalid sinks'));
      else
        for (const sk of p.sinks)
          if (
            !isObj(sk) ||
            typeof sk.id !== 'string' ||
            !sk.id ||
            typeof sk.baseId !== 'string' ||
            !ids.has(sk.baseId) ||
            !isInt(sk.w, 1) ||
            (sk.w as number) > 3000 ||
            !isInt(sk.d, 1) ||
            (sk.d as number) > 3000 ||
            !validOffsets(sk)
          )
            errs.push(t('Invalid sink'));
          else if (hasOffsets(sk) && (p.schemaVersion as number) < FOLLOW_UPS_SINCE)
            errs.push(
              t('Cut-out positions need project schemaVersion {v}', { v: FOLLOW_UPS_SINCE }),
            );
    }
  }
  if (p.runProducts !== undefined) {
    if ((p.schemaVersion as number) < RUN_PRODUCTS_SINCE)
      errs.push(t('Run part products need project schemaVersion {v}', { v: RUN_PRODUCTS_SINCE }));
    if (!isObj(p.runProducts) || Object.keys(p.runProducts).length > 500)
      errs.push(t('Invalid run part products'));
    else
      for (const [k, v] of Object.entries(p.runProducts))
        if (
          !k ||
          k.length > 300 ||
          productRefProblems(v).length > 0 ||
          !validPer((v as { per?: unknown }).per)
        )
          errs.push(t('Invalid run part product for {k}', { k }));
  }
  // Hobs and worktop corner joints (ADR-205).
  if (p.hobs !== undefined) {
    if ((p.schemaVersion as number) < KITCHEN_SINCE)
      errs.push(t('Hobs need project schemaVersion {v}', { v: KITCHEN_SINCE }));
    if (!Array.isArray(p.hobs)) errs.push(t('Invalid hobs'));
    else
      for (const hb of p.hobs)
        if (
          !isObj(hb) ||
          typeof hb.id !== 'string' ||
          !hb.id ||
          typeof hb.baseId !== 'string' ||
          !ids.has(hb.baseId) ||
          !isInt(hb.w, 1) ||
          (hb.w as number) > 3000 ||
          !isInt(hb.d, 1) ||
          (hb.d as number) > 3000 ||
          !validOffsets(hb)
        )
          errs.push(t('Invalid hob'));
  }
  // Worktop front edges (ADR-209).
  if (p.worktopEdges !== undefined) {
    if ((p.schemaVersion as number) < FOLLOW_UPS_SINCE)
      errs.push(t('Worktop edges need project schemaVersion {v}', { v: FOLLOW_UPS_SINCE }));
    if (!Array.isArray(p.worktopEdges)) errs.push(t('Invalid worktop edges'));
    else {
      const seen = new Set<string>();
      for (const e of p.worktopEdges) {
        if (
          !isObj(e) ||
          typeof e.key !== 'string' ||
          !e.key ||
          e.key.length > 2000 ||
          seen.has(e.key) ||
          !['square', 'rounded', 'bevel'].includes(e.kind as string) ||
          (e.size !== undefined && !(isInt(e.size, 1) && (e.size as number) <= 200))
        ) {
          errs.push(t('Invalid worktop edge'));
          continue;
        }
        seen.add(e.key);
      }
    }
  }
  if (p.worktopJoints !== undefined) {
    if ((p.schemaVersion as number) < KITCHEN_SINCE)
      errs.push(t('Worktop joints need project schemaVersion {v}', { v: KITCHEN_SINCE }));
    if (!Array.isArray(p.worktopJoints)) errs.push(t('Invalid worktop joints'));
    else {
      const seen = new Set<string>();
      for (const j of p.worktopJoints) {
        if (
          !isObj(j) ||
          typeof j.id !== 'string' ||
          !j.id ||
          seen.has(j.id) ||
          typeof j.a !== 'string' ||
          !j.a ||
          typeof j.b !== 'string' ||
          !j.b ||
          j.a === j.b ||
          (j.kind !== 'mitre' && j.kind !== 'butt') ||
          (j.through !== undefined && j.through !== 'a' && j.through !== 'b')
        ) {
          errs.push(t('Invalid worktop joint'));
          continue;
        }
        seen.add(j.id);
      }
    }
  }
  if (p.sellerItems !== undefined) {
    if ((p.schemaVersion as number) < SELLER_ITEMS_SINCE)
      errs.push(
        t('Project seller items need project schemaVersion {v}', { v: SELLER_ITEMS_SINCE }),
      );
    if (!Array.isArray(p.sellerItems) || p.sellerItems.length > 500)
      errs.push(t('Invalid seller items'));
    else
      for (const v of p.sellerItems)
        if (productRefProblems(v).length || !isInt(v.quantity, 1) || v.quantity > 9999)
          errs.push(t('Invalid seller item'));
  }
  if (p.models !== undefined) {
    if ((p.schemaVersion as number) < MODELS_SINCE)
      errs.push(t('3D models need project schemaVersion {v}', { v: MODELS_SINCE }));
    errs.push(...validateModelItems(p.models, ids));
    if (Array.isArray(p.models)) {
      const pieces = new Set(
        p.items.flatMap((it) => (isObj(it) && typeof it.id === 'string' ? [it.id] : [])),
      );
      for (const m of p.models) {
        const pl = isObj(m) ? m.placement : undefined;
        if (pl === undefined) continue;
        if ((p.schemaVersion as number) < SURFACES_SINCE)
          errs.push(t('Placed 3D models need project schemaVersion {v}', { v: SURFACES_SINCE }));
        // A model stands on a piece, never on another model (ADR-208).
        if (isObj(pl) && pl.kind === 'above' && !pieces.has(pl.baseId as string))
          errs.push(t('Invalid 3D model placement'));
      }
    }
  }
  if (p.planPicture !== undefined) {
    if ((p.schemaVersion as number) < SURFACES_SINCE)
      errs.push(t('Plan pictures need project schemaVersion {v}', { v: SURFACES_SINCE }));
    errs.push(...planPictureProblems(p.planPicture));
  }
  if (isObj(p.room) && p.room.floor !== undefined && (p.schemaVersion as number) < SURFACES_SINCE)
    errs.push(t('Floor backgrounds need project schemaVersion {v}', { v: SURFACES_SINCE }));
  return errs;
}
