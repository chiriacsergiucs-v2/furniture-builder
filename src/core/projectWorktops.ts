/**
 * Worktop corners, joints and edges of a run (ADR-205): moved out of project.ts unchanged (cleanup audit 2026-11-09, item 13).
 */
import { planRepairFiller, profileBounds } from './projectProfiles';
import {} from './build';
import {} from './compat';
import { type Room } from './room';
import { overlaps } from './geometry';
import {} from './outline';
import { overlapsBox } from './shape';
import {} from './planPicture';
import type { Axis, Box, CabinetParams, Diagnostic, Mm, PanelShape } from './types';
import { t, type Key } from './i18n';

import {
  FILLER_MAX_GAP,
  groupRuns,
  isWallHung,
  materialKey,
  type PlacedPiece,
  placeItem,
  type Project,
  requestKey,
  resolvePlacements,
  RUN_MAX_HEIGHT,
  runFrame,
  type RunPart,
  type RunRequest,
  spans,
  WORKTOP_OVERHANG,
  type WorktopJoint,
  worktopMaterial,
} from './project';

// ---------------------------------------------------------------------------
// Worktop corners (ADR-205)
// ---------------------------------------------------------------------------

/** Two worktops at right angles that overlap or meet in plan: `a` along the back wall (x), `b` along a side wall (z). */
interface WorktopCorner {
  a: RunPart;
  b: RunPart;
  /** The joint the user chose; absent = none yet (the corner is an error until one is chosen). */
  joint?: WorktopJoint;
}

export const runPartKey = (rp: RunPart) => rp.key ?? rp.id;

/** A side worktop faces +x (its back edge is its smaller x): its banded front edge says so. */
export const facesPlusX = (b: RunPart) => !b.banded.includes('-x');

/**
 * The worktop corners of a project (ADR-205): a worktop along x and one along z that overlap or touch in plan at the
 * same height, the side one reaching out in front of the back one, the back one reaching away from the side one.
 */
export function worktopCorners(project: Project): WorktopCorner[] {
  const tops = (project.runParts ?? []).filter((rp) => rp.kind === 'worktop');
  const out: WorktopCorner[] = [];
  for (const a of tops) {
    if (a.grainAxis !== 'x') continue;
    for (const b of tops) {
      if (b.grainAxis !== 'z') continue;
      const A = a.box,
        B = b.box;
      const meets =
        A.x <= B.x + B.w &&
        B.x <= A.x + A.w &&
        A.z <= B.z + B.d &&
        B.z <= A.z + A.d &&
        A.y < B.y + B.h &&
        B.y < A.y + A.h;
      if (!meets || B.z + B.d <= A.z + A.d) continue;
      if (facesPlusX(b) ? A.x + A.w <= B.x + B.w : A.x >= B.x) continue;
      const ka = runPartKey(a),
        kb = runPartKey(b);
      const joint = (project.worktopJoints ?? []).find(
        (j) => (j.a === ka && j.b === kb) || (j.a === kb && j.b === ka),
      );
      out.push({ a, b, ...(joint ? { joint } : {}) });
    }
  }
  return out;
}

/** Whether the corner's worktop `a` (else `b`) runs through its butt joint; undefined when not chosen. */
function aRunsThrough(c: WorktopCorner): boolean | undefined {
  const j = c.joint;
  if (j?.kind !== 'butt' || !j.through) return undefined;
  return (j.through === 'a' ? j.a : j.b) === runPartKey(c.a);
}

/** "Base 600 + Base 800": the pieces a run part was made from. */
export const runPartNames = (project: Project, rp: RunPart) =>
  (rp.from ?? [])
    .map((id) => project.items.find((i) => i.id === id)?.design.name ?? t('a removed piece'))
    .join(' + ');

/** The corner's lines in plan: the side worktop's back and front edge (x), the back worktop's back and front edge (z). */
function cornerLines(c: WorktopCorner) {
  const A = c.a.box,
    B = c.b.box;
  const plus = facesPlusX(c.b);
  return {
    plus,
    xb: plus ? B.x : B.x + B.w,
    xf: plus ? B.x + B.w : B.x,
    zb: A.z,
    zf: A.z + A.d,
  };
}

/**
 * Each worktop of a corner as cut (ADR-205), by run-part id: its blank, mitred also the profile cut along the line from
 * the inner corner (where the front edges meet) to the outer corner, and its cut-list notes. Mitred, both reach the
 * outer corner; butt, the worktop that runs through reaches it and the other stops at its front edge. Corners without
 * a joint leave their worktops as they are. Whole mm; the stored run parts never change.
 */
export function worktopJointCuts(
  project: Project,
): Map<string, { box: Box; shape?: PanelShape; notes: string[] }> {
  /** Along the worktop: where its near (l) and far (r) ends are, at its back (b) and at its front (f) edge. */
  type Ends = { lb: Mm; lf: Mm; rb: Mm; rf: Mm };
  const ends = new Map<string, Ends>();
  const notes = new Map<string, string[]>();
  const endsOf = (rp: RunPart) => {
    let e = ends.get(rp.id);
    if (!e) {
      const b = rp.box;
      e =
        rp.grainAxis === 'z'
          ? { lb: b.z, lf: b.z, rb: b.z + b.d, rf: b.z + b.d }
          : { lb: b.x, lf: b.x, rb: b.x + b.w, rf: b.x + b.w };
      ends.set(rp.id, e);
    }
    return e;
  };
  const note = (rp: RunPart, n: string) => notes.set(rp.id, [...(notes.get(rp.id) ?? []), n]);
  for (const c of worktopCorners(project)) {
    const j = c.joint;
    const through = aRunsThrough(c);
    if (!j || (j.kind === 'butt' && through === undefined)) continue;
    const { plus, xb, xf, zb, zf } = cornerLines(c);
    const ea = endsOf(c.a),
      eb = endsOf(c.b);
    // The end of `a` at the corner: its left end when the side worktop faces +x, else its right end.
    const setA = (back: Mm, front: Mm) => {
      if (plus) [ea.lb, ea.lf] = [back, front];
      else [ea.rb, ea.rf] = [back, front];
    };
    if (j.kind === 'mitre') {
      setA(xb, xf);
      [eb.lb, eb.lf] = [zb, zf];
      note(c.a, 'mitre joint');
      note(c.b, 'mitre joint');
      continue;
    }
    if (through) {
      setA(xb, xb);
      [eb.lb, eb.lf] = [zf, zf];
    } else {
      setA(xf, xf);
      [eb.lb, eb.lf] = [zb, zb];
    }
    note(c.a, `butt joint against ${runPartNames(project, c.b)}`);
    note(c.b, `butt joint against ${runPartNames(project, c.a)}`);
  }
  const out = new Map<string, { box: Box; shape?: PanelShape; notes: string[] }>();
  for (const rp of project.runParts ?? []) {
    const e = ends.get(rp.id);
    if (!e) continue;
    const b = rp.box;
    const lo = Math.min(e.lb, e.lf),
      hi = Math.max(e.rb, e.rf);
    const side = rp.grainAxis === 'z';
    const box: Box = side ? { ...b, z: lo, d: hi - lo } : { ...b, x: lo, w: hi - lo };
    // On the worktop's face, [u, v] = [x, z] from the blank's corner (ADR-040).
    const plus = facesPlusX(rp);
    const ub = plus ? 0 : b.w,
      uf = plus ? b.w : 0;
    const points: [Mm, Mm][] = side
      ? [
          [ub, e.lb - lo],
          [uf, e.lf - lo],
          [uf, e.rf - lo],
          [ub, e.rb - lo],
        ]
      : [
          [e.lb - lo, 0],
          [e.rb - lo, 0],
          [e.rf - lo, b.d],
          [e.lf - lo, b.d],
        ];
    const shaped = e.lb !== e.lf || e.rb !== e.rf;
    out.set(rp.id, {
      box,
      ...(shaped ? { shape: { kind: 'profile', points } } : {}),
      notes: notes.get(rp.id) ?? [],
    });
  }
  return out;
}

/** The joint line of each chosen corner on the plan (ADR-205): x1 z1 x2 z2, room mm. */
export function worktopJointLines(
  project: Project,
): { id: string; kind: WorktopJoint['kind']; line: [Mm, Mm, Mm, Mm] }[] {
  const out: { id: string; kind: WorktopJoint['kind']; line: [Mm, Mm, Mm, Mm] }[] = [];
  for (const c of worktopCorners(project)) {
    const through = aRunsThrough(c);
    if (!c.joint || (c.joint.kind === 'butt' && through === undefined)) continue;
    const { xb, xf, zb, zf } = cornerLines(c);
    const line: [Mm, Mm, Mm, Mm] =
      c.joint.kind === 'mitre' ? [xf, zf, xb, zb] : through ? [xb, zf, xf, zf] : [xf, zb, xf, zf];
    out.push({ id: c.joint.id, kind: c.joint.kind, line });
  }
  return out;
}

/** A corner without a chosen joint is an error (ADR-205, ADR-008): the app picks no default joint. */
export function worktopJointChecks(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of worktopCorners(project)) {
    const names = { a: runPartNames(project, c.a), b: runPartNames(project, c.b) };
    const nodeId = `corner:${runPartKey(c.a)}|${runPartKey(c.b)}`;
    if (!c.joint)
      out.push({
        severity: 'error',
        code: 'worktop-corner-joint',
        message: t(
          'The worktops over {a} and {b} overlap at the corner: choose a mitred or butt joint.',
          names,
        ),
        nodeId,
      });
    else if (c.joint.kind === 'butt' && aRunsThrough(c) === undefined)
      out.push({
        severity: 'error',
        code: 'worktop-corner-joint',
        message: t(
          'The worktops over {a} and {b} meet in a butt joint: choose the one that runs through.',
          names,
        ),
        nodeId,
      });
  }
  return out;
}

/**
 * Joints follow their worktops (ADR-205, ADR-061): a joint whose two worktops no longer meet at a corner goes. The same
 * project when nothing changes; every commit applies it.
 */
export function pruneWorktopJoints(project: Project): Project {
  if (!project.worktopJoints) return project;
  const live = new Set(worktopCorners(project).flatMap((c) => (c.joint ? [c.joint.id] : [])));
  const kept = project.worktopJoints.filter((j) => live.has(j.id));
  if (kept.length === project.worktopJoints.length) return project;
  return { ...project, worktopJoints: kept.length ? kept : undefined };
}

/**
 * Propose run parts for the floor runs in a project (ADR-036). A run is a row of base units side by side (gaps up to
 * 150 mm). Each run gets one worktop on top (depth of the deepest unit + 20 mm overhang), a filler in every gap, a
 * cover panel on each exposed end and (ADR-054) one plinth along the run when every piece's sides stand on its bottom
 * and the plinths match; that plinth replaces the pieces' own. Parts that would overlap another piece are left out;
 * parts the user removed (`runPartsRemoved`) are not proposed again. `notes` say why a run got no plinth.
 */
export function planRuns(
  project: Project,
  /**
   * `sides`: plan the runs along the side walls too (ADR-205: the user asked, Suggest). Without it a side-wall run gets
   * parts only when it already has some or the user asked for one of its worktops, so existing run parts never change.
   */
  opts: { sides?: boolean } = {},
): {
  parts: RunPart[];
  notes: string[];
  /** Why a run part the user asked for was not made, by request key (ADR-075). */
  unmade: Record<string, string>;
} {
  const resolved = resolvePlacements(project);
  const placed = resolved.items.map((i) => placeItem(i));
  const removed = new Set(project.runPartsRemoved ?? []);
  const scribe = project.runSettings?.scribe ?? 0;
  const notes: string[] = [];
  const requests = project.runRequests ?? [];
  const had = new Set([
    ...(project.runParts ?? []).flatMap((rp) => rp.from ?? []),
    ...requests.filter((r) => r.kind !== 'filler').flatMap((r) => r.from),
  ]);
  const runs = groupRuns(placed).filter(
    (run) => run[0].item.rotationY === 0 || !!opts.sides || run.some((pc) => had.has(pc.item.id)),
  );
  const unmade: Record<string, string> = {};
  const fail = (r: RunRequest, why: string) => {
    const note = t('{part}: {why}.', { part: requestName(r, project), why });
    unmade[requestKey(r)] = note;
    notes.push(note);
  };
  const out: RunPart[] = [];
  /**
   * Free of every piece (a run plinth ignores the plinths it replaces) and of the parts proposed so far. A worktop may
   * meet a worktop at right angles to it (`grain`): that corner is a joint the user chooses (ADR-205).
   */
  const freeRoom = (b: Box, skipPlinthOf: Set<string> = new Set(), grain?: Axis) =>
    !placed.some(
      (pc) =>
        overlaps(pc.bounds, b) &&
        pc.panels.some(
          (q) => !(q.role === 'plinth' && skipPlinthOf.has(pc.item.id)) && overlapsBox(q, b),
        ),
    ) && !out.some((o) => overlaps(o.box, b) && !crosses(o, grain));
  const crosses = (o: RunPart, grain?: Axis) =>
    !!grain && o.kind === 'worktop' && o.grainAxis !== grain;
  const pushRoom = (rp: RunPart) => {
    if (!removed.has(rp.key!)) out.push(rp);
  };
  const frontOf = (pc: PlacedPiece) => {
    const p = pc.item.design.product;
    const id = p.kind === 'cabinet' || p.kind === 'corner' ? p.params.frontMaterialId : '';
    return pc.item.design.materials.find((m) => m.id === id) ?? pc.item.design.materials[0];
  };
  runs.forEach((roomRun) => {
    // A side-wall run is planned in its own frame and its parts turned back into the room (ADR-205).
    const fr = runFrame(roomRun[0].item.rotationY);
    const run = roomRun.map((pc) => ({ ...pc, bounds: fr.toLocal(pc.bounds) }));
    const toRoom = (rp: RunPart): RunPart => ({
      ...rp,
      box: fr.toRoom(rp.box),
      thicknessAxis: fr.axis(rp.thicknessAxis),
      grainAxis: fr.axis(rp.grainAxis),
      banded: rp.banded.map(fr.face),
    });
    const free = (b: Box, skipPlinthOf?: Set<string>, grain?: Axis) =>
      freeRoom(fr.toRoom(b), skipPlinthOf, grain && fr.axis(grain));
    const push = (rp: RunPart) => pushRoom(toRoom(rp));
    const ids = run.map((pc) => pc.item.id);
    const first = run[0].bounds,
      last = run[run.length - 1].bounds;
    const x0 = first.x,
      x1 = last.x + last.w;
    const n = run.length;
    for (let i = 1; i < n; i++) {
      const a = run[i - 1],
        b = run[i];
      const gap = b.bounds.x - (a.bounds.x + a.bounds.w);
      if (gap <= 0) continue;
      const m = frontOf(a);
      const h = Math.min(a.bounds.h, b.bounds.h);
      const fz = Math.min(a.bounds.z + a.bounds.d, b.bounds.z + b.bounds.d) - m.thickness;
      const bx: Box = { x: a.bounds.x + a.bounds.w, y: 0, z: fz, w: gap, h, d: m.thickness };
      const key = `filler|${a.item.id},${b.item.id}`;
      if (free(bx))
        push({
          id: key,
          key,
          from: [a.item.id, b.item.id],
          kind: 'filler',
          label: 'Filler',
          reason: `gap ${gap} mm${scribe ? ` + ${scribe} mm scribe` : ''} between ${a.item.design.name} and ${b.item.design.name}`,
          box: bx,
          ...(scribe ? { scribe } : {}),
          material: { ...m },
          thicknessAxis: 'z',
          grainAxis: 'y',
          banded: ['-x', '+x', '-y', '+y'],
        });
    }
    for (const [end, pc] of [
      ['left', run[0]],
      ['right', run[n - 1]],
    ] as const) {
      const m = frontOf(pc);
      const b = pc.bounds;
      const bx: Box = {
        x: end === 'left' ? b.x - m.thickness : b.x + b.w,
        y: 0,
        z: b.z,
        w: m.thickness,
        h: b.h,
        d: b.d,
      };
      const key = `cover-${end}|${pc.item.id}`;
      if (bx.x >= 0 && free(bx))
        push({
          id: key,
          key,
          from: [pc.item.id],
          kind: 'cover',
          label: `Cover panel ${end}`,
          reason: `exposed ${end} end of ${pc.item.design.name}`,
          box: bx,
          material: { ...m },
          thicknessAxis: 'x',
          grainAxis: 'y',
          banded: ['+z', '+y'],
        });
    }
    // Run plinth (ADR-054): only where the pieces' plinths can be one board — sides standing on the bottom, same
    // plinth height and setback, same front line. Otherwise each piece keeps its own and a note says why.
    const cabs = run.map((pc) =>
      pc.item.design.product.kind === 'cabinet' ? { pc, p: pc.item.design.product.params } : null,
    );
    const names = (f: (c: { pc: PlacedPiece; p: CabinetParams }) => boolean) =>
      cabs
        .filter((c): c is { pc: PlacedPiece; p: CabinetParams } => !!c && f(c))
        .map((c) => c.pc.item.design.name)
        .join(', ');
    if (n > 1) {
      const ok = cabs.filter((c): c is { pc: PlacedPiece; p: CabinetParams } => !!c);
      const plinthLine = (c: { pc: PlacedPiece; p: CabinetParams }) =>
        c.pc.bounds.z + c.p.depth - c.p.plinthSetback;
      const bodyOf = (c: { pc: PlacedPiece; p: CabinetParams }) =>
        c.pc.item.design.materials.find((m) => m.id === c.p.bodyMaterialId);
      const bodyT = (c: { pc: PlacedPiece; p: CabinetParams }) => bodyOf(c)?.thickness ?? 0;
      const bodyKey = (c: { pc: PlacedPiece; p: CabinetParams }) => {
        const m = bodyOf(c);
        return m ? materialKey(m) : '';
      };
      const each = (f: (c: { pc: PlacedPiece; p: CabinetParams }) => string) =>
        ok.map((c) => `${c.pc.item.design.name} ${f(c)}`).join(', ');
      let why = '';
      if (ok.length < n) why = t('a corner unit in the run keeps its own plinth');
      else if (ok.some((c) => c.p.plinthHeight <= 0))
        why = t('no plinth on {names}', { names: names((c) => c.p.plinthHeight <= 0) });
      else if (ok.some((c) => c.p.bottom !== 'under'))
        why = t('the sides of {names} reach the floor; set Bottom → under the sides', {
          names: names((c) => c.p.bottom !== 'under'),
        });
      else if (new Set(ok.map((c) => c.p.plinthHeight)).size > 1)
        why = t('plinth heights differ ({list})', {
          list: ok
            .map((c) => t('{name} {mm} mm', { name: c.pc.item.design.name, mm: c.p.plinthHeight }))
            .join(', '),
        });
      else if (new Set(ok.map((c) => c.p.plinthSetback)).size > 1)
        why = t('plinth setbacks differ ({list})', {
          list: each((c) => t('{mm} mm', { mm: c.p.plinthSetback })),
        });
      else if (new Set(ok.map(plinthLine)).size > 1)
        why = t('plinth fronts are not in line ({list})', {
          list: each((c) => t('{mm} mm from the back', { mm: plinthLine(c) })),
        });
      else if (new Set(ok.map(bodyKey)).size > 1)
        why = t('body boards differ ({list})', {
          list: each((c) => {
            const m = bodyOf(c);
            return m
              ? t('{name} {mm} mm', { name: m.name, mm: m.thickness }) +
                  (m.grain ? t(' grained') : '') +
                  (m.image ? t(' with a picture') : '')
              : t('no board');
          }),
        });
      if (why)
        notes.push(
          t('No run plinth for {names}: {why}.', {
            names: run.map((pc) => pc.item.design.name).join(' + '),
            why,
          }),
        );
      else {
        const c0 = ok[0],
          bt = bodyT(c0);
        const m = c0.pc.item.design.materials.find((x) => x.id === c0.p.bodyMaterialId)!;
        const bx: Box = {
          x: x0,
          y: 0,
          z: plinthLine(c0) - bt,
          w: x1 - x0,
          h: c0.p.plinthHeight,
          d: bt,
        };
        const key = `plinth|${ids.join(',')}`;
        if (free(bx, new Set(ids)))
          push({
            id: key,
            key,
            from: ids,
            kind: 'plinth',
            label: 'Plinth',
            reason: `run of ${n} ${n === 1 ? 'piece' : 'pieces'}, ${bx.w} mm long; replaces their own plinths`,
            box: bx,
            material: { ...m },
            thicknessAxis: 'z',
            grainAxis: 'x',
            banded: ['-y'],
          });
        else
          notes.push(
            t('No run plinth for {names}: it would overlap a filler or another piece.', {
              names: run.map((pc) => pc.item.design.name).join(' + '),
            }),
          );
      }
    }
    // Worktops the user asked for over part of this run, or with their own overhangs (ADR-075), replace the
    // suggested worktop over the whole run.
    const asked = requests.filter(
      (r) => r.kind === 'worktop' && r.from.some((id) => ids.includes(id)),
    );
    const worktop = (pcs: PlacedPiece[], key: string, front = WORKTOP_OVERHANG, side = 0) => {
      const own = pcs.map((pc) => pc.item.id);
      const covers = out
        .filter((o) => o.kind === 'cover' && o.from!.some((id) => own.includes(id)))
        .map((o) => ({ ...o, box: fr.toLocal(o.box) }));
      const l = pcs[0].bounds,
        r = pcs[pcs.length - 1].bounds;
      const wx0 = Math.min(l.x, ...covers.map((c) => c.box.x)) - side,
        wx1 = Math.max(r.x + r.w, ...covers.map((c) => c.box.x + c.box.w)) + side;
      const wz0 = Math.min(...pcs.map((pc) => pc.bounds.z));
      const wt = worktopMaterial();
      const wb: Box = {
        x: wx0,
        y: Math.max(...pcs.map((pc) => pc.bounds.y + pc.bounds.h)),
        z: wz0,
        w: wx1 - wx0,
        h: wt.thickness,
        d: Math.max(...pcs.map((pc) => pc.bounds.z + pc.bounds.d)) - wz0 + front,
      };
      const m = pcs.length;
      const part: RunPart = {
        id: key,
        key,
        from: own,
        kind: 'worktop',
        label: 'Worktop',
        reason: `${m === n ? 'run of' : 'over'} ${m} ${m === 1 ? 'piece' : 'pieces'}, ${wb.w} mm long${
          front !== WORKTOP_OVERHANG || side ? `, overhang ${front} mm front, ${side} mm sides` : ''
        }`,
        box: wb,
        material: wt,
        thicknessAxis: 'y',
        grainAxis: 'x',
        banded: ['+z'],
      };
      return part;
    };
    if (asked.length) {
      for (const r of asked) {
        const idx = r.from.map((id) => ids.indexOf(id)).sort((a, b) => a - b);
        if (idx[0] < 0 || idx.some((v, i) => v !== idx[0] + i)) continue;
        const wb = worktop(
          idx.map((i) => run[i]),
          requestKey(r),
          r.front,
          r.side,
        );
        const room = toRoom(wb);
        if (out.some((o) => overlaps(o.box, room.box) && !crosses(o, room.grainAxis)))
          fail(r, t('it would overlap another worktop or run part'));
        else out.push(room);
      }
      const bare = run.filter((pc) => !asked.some((r) => r.from.includes(pc.item.id)));
      if (bare.length)
        notes.push(
          t(
            'No worktop over {names}: worktops were chosen for other pieces of this run (Add worktop over… adds one).',
            { names: bare.map((pc) => pc.item.design.name).join(' + ') },
          ),
        );
      return;
    }
    const key = `worktop|${ids.join(',')}`;
    const wb = worktop(run, key);
    if (free(wb.box, undefined, wb.grainAxis)) push(wb);
  });
  // Trims the user asked for along wall or tall units (ADR-075).
  const byId = new Map(placed.map((pc) => [pc.item.id, pc]));
  // Crowns first, so a ceiling filler on the same units goes above them whatever order they were asked in.
  const order: Record<RunRequest['kind'], number> = {
    worktop: 0,
    crown: 1,
    pelmet: 2,
    'ceiling-filler': 3,
    filler: 4,
  };
  for (const r of [...requests].sort((a, b) => order[a.kind] - order[b.kind])) {
    const key = requestKey(r);
    // A repair filler (ADR-209): it takes the place of a suggested filler with the same key.
    if (r.kind === 'filler') {
      const part = planRepairFiller(r, byId);
      const rest = out.filter((o) => o.key !== key);
      if (typeof part === 'string') fail(r, part);
      else if (
        placed.some(
          (pc) => overlaps(pc.bounds, part.box) && pc.panels.some((q) => overlapsBox(q, part.box)),
        ) ||
        rest.some((o) => overlaps(o.box, part.box))
      )
        fail(r, t('it would overlap another piece or run part'));
      else {
        out.length = 0;
        out.push(...rest, part);
      }
      continue;
    }
    if (r.kind === 'worktop') {
      if (out.some((o) => o.key === key) || unmade[key]) continue;
      const why =
        !r.from.length || r.from.some((id) => !byId.has(id))
          ? t('a piece it was made for is no longer in the project')
          : !runs.some((run) => r.from.every((id) => run.some((pc) => pc.item.id === id)))
            ? t('the pieces are not side by side in one run of base units')
            : t('the pieces are not next to each other');
      fail(r, why);
      continue;
    }
    const part = planTrim(r, byId, project.room, out);
    if (typeof part === 'string') fail(r, part);
    else if (out.some((o) => overlaps(o.box, part.box)))
      fail(r, t('it would overlap another run part'));
    else out.push(part);
  }
  return { parts: out, notes, unmade };
}

export const suggestRunParts = (project: Project): RunPart[] => planRuns(project).parts;

const TRIM_LABEL: Record<RunRequest['kind'], string> = {
  worktop: 'Worktop',
  crown: 'Crown',
  pelmet: 'Pelmet',
  'ceiling-filler': 'Ceiling filler',
  filler: 'Filler',
};

const REQUEST_NAME = {
  worktop: 'Worktop over {names}',
  crown: 'Crown over {names}',
  pelmet: 'Pelmet over {names}',
  'ceiling-filler': 'Ceiling filler over {names}',
  filler: 'Filler beside {names}',
} as const satisfies Record<RunRequest['kind'], Key>;

/** "Crown over Wall unit + Wall unit 2", for notes and diagnostics. */
export function requestName(r: RunRequest, project: Project): string {
  const names = r.from.map(
    (id) => project.items.find((i) => i.id === id)?.design.name ?? t('a removed piece'),
  );
  return t(REQUEST_NAME[r.kind], { names: names.join(' + ') });
}

/** Wall units, and tall units standing on the floor, facing the room: the pieces a trim runs along (ADR-075). */
const takesTrim = (pc: PlacedPiece) =>
  pc.item.rotationY === 0 &&
  !pc.item.angle &&
  (pc.item.design.product.kind === 'cabinet' || pc.item.design.product.kind === 'corner') &&
  (isWallHung(pc.item.design) || (pc.bounds.y === 0 && pc.bounds.h > RUN_MAX_HEIGHT));

/** Pieces to choose from (ADR-075): runs of base units for a worktop, wall and tall units for trims; left → right. */
export function requestCandidates(project: Project): { runs: string[][]; trims: string[][] } {
  const placed = resolvePlacements(project).items.map((i) => placeItem(i));
  // Trim rows: wall or tall units side by side, the same rule `planTrim` checks.
  const trims: PlacedPiece[][] = [];
  for (const pc of placed.filter(takesTrim).sort((a, b) => a.bounds.x - b.bounds.x)) {
    const row = trims.find((r) => sideBySide(r[r.length - 1].bounds, pc.bounds));
    if (row) row.push(pc);
    else trims.push([pc]);
  }
  return {
    runs: groupRuns(placed).map((r) => r.map((pc) => pc.item.id)),
    trims: trims.map((r) => r.map((pc) => pc.item.id)),
  };
}

/** `b` starts 0–150 mm right of `a` and they share some depth. */
const sideBySide = (a: Box, b: Box) => {
  const gap = b.x - (a.x + a.w);
  return gap >= 0 && gap <= FILLER_MAX_GAP && spans(a.z, a.z + a.d, b.z, b.z + b.d);
};

/**
 * A crown (on top, along the front), a pelmet (under the bottom, along the front) or a ceiling filler (from the
 * top, or a crown on it, up to the room height) over adjacent wall or tall units (ADR-075); flush with their
 * fronts. Returns why it cannot be made instead; nothing is clamped (ADR-008).
 */
function planTrim(
  r: RunRequest,
  byId: Map<string, PlacedPiece>,
  room: Room | undefined,
  out: RunPart[],
): RunPart | string {
  const found = r.from.map((id) => byId.get(id));
  if (!found.length || found.some((pc) => !pc))
    return t('a piece it was made for is no longer in the project');
  const pcs = (found as PlacedPiece[]).slice().sort((a, b) => a.bounds.x - b.bounds.x);
  const odd = pcs.find((pc) => !takesTrim(pc));
  if (odd)
    return t('{name} is not a wall or tall unit facing the room', { name: odd.item.design.name });
  for (let i = 1; i < pcs.length; i++)
    if (!sideBySide(pcs[i - 1].bounds, pcs[i].bounds)) return t('the pieces are not side by side');
  const m = r.material;
  if (!m) return t('choose its board');
  const x0 = pcs[0].bounds.x,
    x1 = Math.max(...pcs.map((pc) => pc.bounds.x + pc.bounds.w));
  const top = Math.max(...pcs.map((pc) => pc.bounds.y + pc.bounds.h));
  const bottom = Math.min(...pcs.map((pc) => pc.bounds.y));
  const zf = Math.max(...pcs.map((pc) => pc.bounds.z + pc.bounds.d));
  let y: Mm, h: Mm, reason: string;
  if (r.kind === 'ceiling-filler') {
    if (!room) return t('set the room and its height first (Room)');
    const crown = out.filter((o) => o.kind === 'crown' && o.box.x < x1 && o.box.x + o.box.w > x0);
    y = Math.max(top, ...crown.map((c) => c.box.y + c.box.h));
    h = room.height - y;
    if (h <= 0) return t('the run already reaches the {h} mm ceiling', { h: room.height });
    reason = `from ${y} mm up to the ${room.height} mm ceiling`;
  } else {
    // A moulding with a profile (ADR-209) takes its bounding height; one too broken to have a size needs a height.
    const pb = r.profile ? profileBounds(r.profile) : null;
    const ph = pb && pb.w > 0 && pb.h > 0 ? pb.h : undefined;
    if (!ph && !r.height) return t('enter its height');
    h = ph ?? r.height!;
    y = r.kind === 'crown' ? top : bottom - h;
    if (y < 0) return t('it would go {mm} mm below the floor', { mm: -y });
    reason = r.kind === 'crown' ? `on top, ${h} mm high` : `under the units, ${h} mm high`;
  }
  // The strip's depth: the profile's bounding width (ADR-209), else the board.
  const pb = r.kind !== 'ceiling-filler' && r.profile ? profileBounds(r.profile) : null;
  const depth = pb && pb.w > 0 && pb.h > 0 ? pb.w : m.thickness;
  const key = requestKey(r);
  return {
    id: key,
    key,
    from: pcs.map((pc) => pc.item.id),
    kind: r.kind,
    label: TRIM_LABEL[r.kind],
    reason: `${reason}, ${x1 - x0} mm along ${pcs.length} ${pcs.length === 1 ? 'piece' : 'pieces'}`,
    box: { x: x0, y, z: zf - depth, w: x1 - x0, h, d: depth },
    material: { ...m },
    thicknessAxis: 'z',
    grainAxis: 'x',
    banded: r.kind === 'crown' ? ['+y'] : r.kind === 'pelmet' ? ['-y'] : [],
  };
}

/**
 * With automatic refresh off (ADR-061), the parts of requests whose numbers a binding just changed (ADR-209) are made
 * again, as asking for them does; the other run parts stay. `before` is the project before the bindings were applied;
 * the same `after` when nothing changed or refresh is on (it remakes them anyway).
 */
export function remakeAskedParts(before: Project, after: Project): Project {
  if (after.runSettings?.auto || after.runRequests === before.runRequests) return after;
  const was = new Map((before.runRequests ?? []).map((r) => [requestKey(r), JSON.stringify(r)]));
  const keys = new Set(
    (after.runRequests ?? [])
      .filter((r) => was.get(requestKey(r)) !== JSON.stringify(r))
      .map((r) => requestKey(r)),
  );
  if (!keys.size) return after;
  const made = planRuns(after).parts.filter((rp) => keys.has(rp.key ?? ''));
  const kept = (after.runParts ?? []).filter((rp) => !keys.has(rp.key ?? ''));
  return { ...after, runParts: [...kept, ...made] };
}
