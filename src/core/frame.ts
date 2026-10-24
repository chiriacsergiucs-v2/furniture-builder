import type { PartialModel } from './cabinet';
import { box, equalParts } from './geometry';
import type { Axis, Box, Face, FrameParams, Material, Mm, Panel, PanelRole } from './types';

/**
 * Frame furniture (ADR-038): tables, benches, stools, chairs and beds built from legs, rails, stretchers, slats and
 * a top or deck. Fixed topology per kind, no space tree. Every member is an axis-aligned box; solid members are cut
 * from lengths (their section is the two short sides), panels from sheets.
 */

export const LEDGER_HEIGHT = 40;
export const MATTRESS_LIP = 50;
export const CENTRE_RAIL_HEIGHT = 80;
export const CENTRE_RAIL_FROM = 1400;
export const BACK_START = 100;
const GUARD_RAIL = 100;
const RUNG_PITCH = 250;
const RUNG_HEIGHT = 30;
const LADDER_WIDTH = 400;

const axes: Axis[] = ['x', 'y', 'z'];
const dim = (b: Box, a: Axis) => (a === 'x' ? b.w : a === 'y' ? b.h : b.d);

export function buildFrame(
  p: FrameParams,
  id: string,
  materials: Map<string, Material>,
): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] };
  const err = (code: string, message: string) => {
    out.diagnostics.push({ severity: 'error', code, message, nodeId: id });
    return out;
  };
  const panelM = materials.get(p.panelMaterialId),
    solidM = materials.get(p.solidMaterialId);
  if (!panelM || !solidM)
    return err('material-missing', 'A material used by this frame does not exist in the design.');
  const counters = new Map<string, number>();
  /** A solid member: grain along its longest side, thickness its shortest. */
  const member = (role: PanelRole, label: string, b: Box) => {
    const sorted = [...axes].sort((a, c) => dim(b, c) - dim(b, a));
    push(role, label, solidM.id, b, sorted[2], sorted[0], []);
  };
  const sheet = (
    role: PanelRole,
    label: string,
    b: Box,
    thicknessAxis: Axis,
    grainAxis: Axis,
    banded: Face[],
  ) => push(role, label, panelM.id, b, thicknessAxis, grainAxis, banded);
  function push(
    role: PanelRole,
    label: string,
    materialId: string,
    b: Box,
    thicknessAxis: Axis,
    grainAxis: Axis,
    banded: Face[],
  ) {
    const i = counters.get(role) ?? 0;
    counters.set(role, i + 1);
    out.panels.push({
      id: `${id}/${role}/${i}`,
      nodeId: id,
      role,
      label,
      materialId,
      box: b,
      thicknessAxis,
      grainAxis,
      banded,
    } satisfies Panel);
  }
  /** `n` members of width `w` spread over [from, from + span) with equal gaps, first and last at the ends. */
  const spread = (from: Mm, span: Mm, w: Mm, n: number): Mm[] => {
    if (n <= 1) return [from + Math.floor((span - w) / 2)];
    const gaps = equalParts(span - n * w, n - 1);
    const at: Mm[] = [];
    let x = from;
    for (let i = 0; i < n; i++) {
      at.push(x);
      x += w + (gaps[i] ?? 0);
    }
    return at;
  };
  const slatCount = (span: Mm) =>
    Math.max(1, Math.floor((span + p.slats.gap) / (p.slats.width + p.slats.gap)));
  /** Tilt every part pushed since index `from` as one piece about the axis through the world point `pivot` (ADR-040). */
  const tiltFrom = (from: number, axis: Axis, angleDeg: number, pivot: [Mm, Mm, Mm]) => {
    if (!angleDeg) return;
    for (const q of out.panels.slice(from))
      q.shape = {
        kind: 'tilt',
        axis,
        angleDeg,
        pivot: [pivot[0] - q.box.x, pivot[1] - q.box.y, pivot[2] - q.box.z],
      };
  };

  if (p.kind === 'bed') return buildBed(p, out, err, member, sheet, spread, slatCount, panelM);

  // ---- tables, benches, stools, chairs ---------------------------------------
  const { width: W, depth: D, height: H, leg, legInset: li, apron, slats } = p;
  const lw = leg.w,
    ld = leg.d,
    at = apron.thickness,
    ah = apron.height;
  const back = p.kind === 'chair' || p.kind === 'bench' ? (p.back ?? null) : null;
  const seatH = back ? back.seatHeight : H;
  const topT = p.top === 'panel' ? panelM.thickness : slats.thickness;
  const topY = seatH - topT;
  // Rake of the back from vertical: from the reclining position shown, else the back's own angle (ADR-040).
  const recline = back ? (p.recline ?? null) : null;
  const rake = recline ? (recline.positions[recline.at] ?? 90) - 90 : (back?.angleDeg ?? 0);
  if (p.kind === 'chair' && p.base === 'bought')
    return boughtBase(p, id, out, err, sheet, tiltFrom, back, rake, panelM);
  if (W < 2 * (li + lw) + 50 || D < 2 * (li + ld) + 50 || topY < 100)
    return err('frame-too-small', `${W}×${H}×${D} mm is too small for ${lw}×${ld} mm legs.`);
  if (li < 0) return err('leg-inset', 'Legs cannot be set outside the top.');
  if (ah > 0 && (at > Math.min(lw, ld) || at <= 0))
    return err(
      'apron-thickness',
      `Rails ${at} mm thick must be no thicker than the ${Math.min(lw, ld)} mm legs.`,
    );
  if (ah > 0 && ah >= topY - 50)
    return err('apron-height', `Rails ${ah} mm high leave no room under the top.`);
  if (p.top === 'slats' && ah <= 0)
    return err(
      'slats-need-rails',
      'A slatted top rests on rails: give the rails under the top a height.',
    );
  if (back && (seatH <= 200 || seatH >= H - 2 * back.railHeight - BACK_START))
    return err(
      'back-height',
      `A back needs the seat (${seatH} mm) well below the top of the back (${H} mm).`,
    );

  const xs = [li, W - li - lw],
    zs = [li, D - li - ld];
  // Back posts carry on up to the full height; the seat stops in front of them.
  zs.forEach((z, zi) =>
    xs.forEach((x, xi) => {
      // A raked back leans above the seat: the back legs stop at the seat and the posts above lean with the back.
      const post = back && zi === 0 && !rake;
      const name = back && zi === 0 ? (rake ? 'Back leg' : 'Back post') : 'Front leg';
      member('leg', `${name} ${xi ? 'right' : 'left'}`, box(x, 0, z, lw, post ? H : topY, ld));
    }),
  );
  const tz0 = back ? li + ld : 0;
  const topLabel = p.kind === 'table' ? 'Table top' : 'Seat';
  const topRole: PanelRole = p.kind === 'table' ? 'top' : 'seat';
  if (p.top === 'panel')
    sheet(topRole, topLabel, box(0, topY, tz0, W, topT, D - tz0), 'y', 'x', [
      '-x',
      '+x',
      '-z',
      '+z',
    ]);
  else {
    // Slats run side to side over the rails; front and back slats sit over the legs, so nothing hangs unsupported.
    const z0 = Math.max(tz0, li),
      span = D - li - z0;
    const n = slatCount(span);
    const br = p.kind === 'bench' && !back ? (p.backrest ?? null) : null;
    if (br && br.length > W - 2 * (li + lw) - 100)
      return err(
        'backrest-length',
        `A ${br.length} mm backrest leaves too little seat on a ${W} mm frame.`,
      );
    const L = br ? br.length : 0;
    for (const z of spread(z0, span, slats.width, n))
      member('slat', `${topLabel} slat`, box(L, topY, z, W - L, topT, slats.width));
    if (br) {
      // Lounger backrest (ADR-040): the first L mm of the slats on two battens, hinged at the top edge at x = L.
      const i0 = out.panels.length;
      for (const z of spread(z0, span, slats.width, n))
        member('slat', 'Backrest slat', box(0, topY, z, L, topT, slats.width));
      const bw = 45,
        bz = li + ld,
        bd = D - 2 * li - 2 * ld;
      for (const bx of [li + lw + 10, L - bw - 10])
        member('rail', 'Backrest batten', box(bx, topY - at, bz, bw, at, bd));
      tiltFrom(i0, 'z', -(180 - (br.positions[br.at] ?? 180)), [L, seatH, 0]);
      out.hardware.push({
        nodeId: id,
        kind: 'purchased',
        label: `Backrest hinges and prop (positions ${br.positions.map((a) => `${a}°`).join(', ')})`,
        quantity: 1,
        note: 'bought; the prop sets the real positions',
      });
    }
  }
  const ring = (role: PanelRole, name: string, y: Mm, h: Mm, which: 'box' | 'h') => {
    const innerX = W - 2 * li - 2 * lw,
      innerZ = D - 2 * li - 2 * ld;
    if (which === 'box') {
      member(role, `${name} back`, box(li + lw, y, li, innerX, h, at));
      member(role, `${name} front`, box(li + lw, y, D - li - at, innerX, h, at));
    }
    member(role, `${name} left`, box(li, y, li + ld, at, h, innerZ));
    member(role, `${name} right`, box(W - li - at, y, li + ld, at, h, innerZ));
    if (which === 'h')
      member(
        role,
        `${name} middle`,
        box(li + at, y, Math.floor((D - at) / 2), W - 2 * li - 2 * at, h, at),
      );
  };
  if (ah > 0) ring('apron', 'Rail', topY - ah, ah, 'box');
  if (p.stretchers !== 'none') {
    const sh = Math.max(30, at);
    if (p.stretcherHeight < 50 || p.stretcherHeight + sh > topY - ah - 20)
      err(
        'stretcher-height',
        `Stretchers at ${p.stretcherHeight} mm clash with the rails under the top.`,
      );
    else ring('stretcher', 'Stretcher', p.stretcherHeight, sh, p.stretchers);
  }
  if (p.shelf) {
    const y = p.shelf.height - panelM.thickness;
    if (y < 30 || p.shelf.height > topY - ah - 50)
      err('shelf-height', `A lower shelf at ${p.shelf.height} mm does not fit under the top.`);
    else {
      sheet(
        'shelf',
        'Lower shelf',
        box(li + lw, y, li + ld, W - 2 * li - 2 * lw, panelM.thickness, D - 2 * li - 2 * ld),
        'y',
        'x',
        ['-z', '+z'],
      );
      out.diagnostics.push({
        severity: 'warning',
        code: 'shelf-support',
        message:
          'The lower shelf sits between the legs: fix it with cleats or dowels (not listed).',
        nodeId: id,
      });
    }
  }
  const fr = recline?.footrest;
  if (fr && recline) {
    // Footrest hinged under the front edge of the seat, swung forward from hanging (0°) to level (90°).
    const a = fr.angles[recline.at] ?? 0,
      t = panelM.thickness;
    if (a >= 90)
      sheet('seat', 'Footrest', box(li, topY - t, D, W - 2 * li, t, fr.length), 'y', 'x', [
        '-x',
        '+x',
        '+z',
      ]);
    else {
      if (a === 0 && fr.length > topY)
        return err(
          'footrest-floor',
          `A ${fr.length} mm footrest hanging from ${topY} mm reaches the floor.`,
        );
      const i0 = out.panels.length;
      sheet('seat', 'Footrest', box(li, topY - fr.length, D, W - 2 * li, fr.length, t), 'z', 'x', [
        '-x',
        '+x',
        '-y',
      ]);
      tiltFrom(i0, 'x', -a, [li, topY, D]);
    }
  }
  if (recline)
    out.hardware.push({
      nodeId: id,
      kind: 'purchased',
      label: `Reclining mechanism (positions ${recline.positions.map((a) => `${a}°`).join(', ')})`,
      quantity: 1,
      note: "bought; it sets the frame's inside sizes and the real positions",
    });
  if (back) {
    const bx = li + lw,
      bw = W - 2 * li - 2 * lw;
    const y0 = seatH + BACK_START;
    const b0 = out.panels.length;
    if (rake)
      xs.forEach((x, xi) =>
        member('leg', `Back post ${xi ? 'right' : 'left'}`, box(x, topY, li, lw, H - topY, ld)),
      );
    if (back.style === 'panel') {
      const bt = panelM.thickness;
      sheet(
        'seat',
        'Back panel',
        box(bx, y0, li + Math.floor((ld - bt) / 2), bw, H - y0, bt),
        'z',
        'x',
        ['+y'],
      );
    } else {
      const rz = li + Math.floor((ld - at) / 2);
      member('rail', 'Back rail top', box(bx, H - back.railHeight, rz, bw, back.railHeight, at));
      member('rail', 'Back rail bottom', box(bx, y0, rz, bw, back.railHeight, at));
      const sy = y0 + back.railHeight,
        sh = H - back.railHeight - sy;
      const n = Math.max(1, Math.min(back.count, Math.floor(bw / (slats.width + 20))));
      const sz = li + Math.floor((ld - slats.thickness) / 2);
      for (const x of spread(bx + 20, bw - 40, slats.width, n))
        member('slat', 'Back slat', box(x, sy, sz, slats.width, sh, slats.thickness));
    }
    // The back leans back (top towards the wall) about the back edge of the posts at seat-frame level.
    tiltFrom(b0, 'x', -rake, [0, topY, li]);
  }
  if (p.arms) {
    const top = p.arms.height;
    if (!back)
      err('arms-need-back', 'Arm rests run back to the back posts: give the frame a back.');
    else if (top - at < seatH + 100)
      err('arm-height', `Arm rests at ${top} mm are too close to the ${seatH} mm seat.`);
    else
      xs.forEach((x, xi) => {
        const side = xi ? 'right' : 'left';
        member('leg', `Arm post ${side}`, box(x, seatH, D - li - ld, lw, top - at - seatH, ld));
        member('rail', `Arm rest ${side}`, box(x, top - at, li + ld, lw, at, D - 2 * li - ld));
      });
  }
  return out;
}

type Err = (code: string, message: string) => PartialModel;
type Tilt = (from: number, axis: Axis, angleDeg: number, pivot: [Mm, Mm, Mm]) => void;

/**
 * Chair on a bought base (ADR-040): only the seat and back boards are cut; the gas lift, mechanism, five-star base and
 * back support are bought, scheduled and not drawn. The back leans by its rake about its bottom back edge.
 */
function boughtBase(
  p: FrameParams,
  id: string,
  out: PartialModel,
  err: Err,
  sheet: Sheet,
  tilt: Tilt,
  back: FrameParams['back'],
  rake: number,
  panelM: Material,
): PartialModel {
  const t = panelM.thickness,
    seatH = back ? back.seatHeight : p.height;
  if (p.width < 250 || p.depth < 250 || seatH < 300)
    return err(
      'frame-too-small',
      `A ${p.width} × ${p.depth} mm seat at ${seatH} mm is too small for a bought base.`,
    );
  sheet('seat', 'Seat', box(0, seatH - t, 0, p.width, t, p.depth), 'y', 'x', [
    '-x',
    '+x',
    '-z',
    '+z',
  ]);
  if (back) {
    const y0 = seatH + BACK_START;
    if (p.height - y0 < 150)
      return err(
        'back-height',
        `A back needs room above the seat (${seatH} mm) below the top (${p.height} mm).`,
      );
    const i0 = out.panels.length;
    sheet('seat', 'Back panel', box(0, y0, 0, p.width, p.height - y0, t), 'z', 'x', [
      '-x',
      '+x',
      '-y',
      '+y',
    ]);
    tilt(i0, 'x', -rake, [0, y0, 0]);
    out.hardware.push({
      nodeId: id,
      kind: 'purchased',
      label: 'Back support bar (joins seat and back)',
      quantity: 1,
      note: 'bought with the mechanism',
    });
  }
  out.hardware.push({
    nodeId: id,
    kind: 'purchased',
    label: 'Gas lift, synchro mechanism and five-star base',
    quantity: 1,
    note: 'bought; check its mounting plate against the seat board',
  });
  out.diagnostics.push({
    severity: 'warning',
    code: 'bought-base',
    message:
      'Seat and back boards on a bought base: the base, gas lift, mechanism and back support are bought and not drawn.',
    nodeId: id,
  });
  return out;
}
type Member = (role: PanelRole, label: string, b: Box) => void;
type Sheet = (role: PanelRole, label: string, b: Box, ta: Axis, ga: Axis, banded: Face[]) => void;
type Spread = (from: Mm, span: Mm, w: Mm, n: number) => Mm[];

/** Beds: head and foot boards carry side rails; slats on ledgers; a centre rail on legs for wide beds; bunk tiers. */
function buildBed(
  p: FrameParams,
  out: PartialModel,
  err: Err,
  member: Member,
  sheet: Sheet,
  spread: Spread,
  slatCount: (span: Mm) => number,
  panelM: Material,
): PartialModel {
  const b = p.bed;
  if (!b) return err('bed-missing', 'Bed settings are missing.');
  const pt = panelM.thickness,
    rt = p.apron.thickness,
    st = p.slats.thickness,
    sw = p.slats.width;
  const { w: mw, l: ml } = b.mattress;
  const c = b.clearance;
  if (mw < 300 || ml < 600 || c < 0)
    return err('mattress-size', `A ${mw}×${ml} mm mattress is not a size this bed can take.`);
  const leftT = b.sidePanelHeight > 0 ? pt : rt;
  const W = mw + 2 * c + leftT + rt,
    IL = ml + 2 * c,
    L = IL + 2 * pt;
  const deck = b.deckHeight;
  const railTop = deck + MATTRESS_LIP;
  if (b.railHeight < MATTRESS_LIP + st + LEDGER_HEIGHT)
    return err(
      'rail-height',
      `Side rails need at least ${MATTRESS_LIP + st + LEDGER_HEIGHT} mm of height to carry ledgers and slats.`,
    );
  if (railTop - b.railHeight < 50)
    return err('deck-low', `Deck at ${deck} mm leaves no room under the side rails.`);
  const decks = b.tierGap > 0 ? [deck, deck + b.tierGap] : [deck];
  const top = decks[decks.length - 1];
  const tall = b.tierGap > 0 ? top + b.guardHeight : 0;
  const headH = Math.max(b.headboardHeight, railTop, tall);
  const footH = Math.max(b.footboardHeight, railTop, tall);
  sheet('headboard', 'Headboard', box(0, 0, 0, W, headH, pt), 'z', 'x', ['-x', '+x', '+y']);
  sheet('footboard', 'Footboard', box(0, 0, L - pt, W, footH, pt), 'z', 'x', ['-x', '+x', '+y']);
  if (b.sidePanelHeight > 0) {
    if (b.sidePanelHeight < railTop)
      return err(
        'side-panel',
        `The side panel must reach at least the top of the rails (${railTop} mm).`,
      );
    sheet('gable', 'Side panel', box(0, 0, pt, pt, b.sidePanelHeight, IL), 'x', 'z', ['+y']);
  }
  decks.forEach((d, tier) => {
    const tag = decks.length > 1 ? (tier ? ' (top bunk)' : ' (bottom bunk)') : '';
    const rTop = d + MATTRESS_LIP;
    if (!(b.sidePanelHeight > 0 && tier === 0))
      member(
        'rail',
        `Side rail left${tag}`,
        box(0, rTop - b.railHeight, pt, leftT, b.railHeight, IL),
      );
    member(
      'rail',
      `Side rail right${tag}`,
      box(W - rt, rTop - b.railHeight, pt, rt, b.railHeight, IL),
    );
    const ly = d - st - LEDGER_HEIGHT;
    member('ledger', `Slat ledger left${tag}`, box(leftT, ly, pt, rt, LEDGER_HEIGHT, IL));
    member('ledger', `Slat ledger right${tag}`, box(W - 2 * rt, ly, pt, rt, LEDGER_HEIGHT, IL));
    for (const z of spread(pt, IL, sw, slatCount(IL)))
      member('slat', `Slat${tag}`, box(leftT, d - st, z, W - leftT - rt, st, sw));
    if (mw >= CENTRE_RAIL_FROM) {
      const cx = Math.floor((W - rt) / 2);
      member(
        'rail',
        `Centre rail${tag}`,
        box(cx, d - st - CENTRE_RAIL_HEIGHT, pt, rt, CENTRE_RAIL_HEIGHT, IL),
      );
      if (tier === 0) {
        const lh = d - st - CENTRE_RAIL_HEIGHT;
        for (const z of spread(pt, IL, p.leg.d, 4).slice(1, 3))
          member(
            'leg',
            'Centre leg',
            box(cx + Math.floor((rt - p.leg.w) / 2), 0, z, p.leg.w, lh, p.leg.d),
          );
      }
    }
    if (tier > 0) {
      const gy = d + b.guardHeight - GUARD_RAIL;
      if (gy < rTop + 20) {
        out.diagnostics.push({
          severity: 'warning',
          code: 'guard-low',
          message: `Guard rails ${b.guardHeight} mm above the top deck are too low to add over the side rails.`,
          nodeId: out.panels[0]?.nodeId,
        });
        return;
      }
      member('rail', 'Guard rail left', box(0, gy, pt, leftT, GUARD_RAIL, IL));
      member('rail', 'Guard rail right', box(W - rt, gy, pt, rt, GUARD_RAIL, IL));
    }
  });
  if (b.tierGap > 0) {
    // Ladder on the outside of the footboard, at its right end.
    const lw = p.leg.w,
      ld = p.leg.d;
    const x0 = W - LADDER_WIDTH;
    member('stile', 'Ladder stile left', box(x0, 0, L, lw, tall, ld));
    member('stile', 'Ladder stile right', box(W - lw, 0, L, lw, tall, ld));
    for (let y = RUNG_PITCH; y + RUNG_HEIGHT <= top; y += RUNG_PITCH)
      member('rung', 'Ladder rung', box(x0 + lw, y, L, LADDER_WIDTH - 2 * lw, RUNG_HEIGHT, ld));
  }
  return out;
}
