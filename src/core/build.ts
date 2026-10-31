import { rolesOf } from './roles';
import { t as tx, tr } from './i18n';
import { buildCabinet, slidingTrackDepth } from './cabinet';
import { buildCorner } from './corner';
import { buildDesk } from './desk';
import { buildPanelSet } from './panelset';
import { buildFrame } from './frame';
import { buildPanel } from './panel';
import { bandFor, bandText } from './materials';
import { runRules } from './rules';
import { box, contains, cutDimensions, isMm, union } from './geometry';
import { aabbOf, panelsOverlap, shapeProblems } from './shape';
import type { Design, Diagnostic, EdgeBand, FurnitureModel, Material, Panel } from './types';

const FRONT_ROLES = new Set<Panel['role']>(['door', 'drawer-front', 'blind-panel']);

/**
 * Build the single normalised model for a design. Every consumer (3D, cutlist, hardware, checks)
 * reads this; nothing re-derives geometry elsewhere.
 */
export function buildModel(design: Design): FurnitureModel {
  const materials = new Map<string, Material>(design.materials.map((m) => [m.id, m]));
  const prod = design.product;
  const partial =
    prod.kind === 'cabinet'
      ? buildCabinet(prod.params, materials, { productNodeId: prod.id })
      : prod.kind === 'corner'
        ? buildCorner(prod.params, prod.id, materials)
        : prod.kind === 'panel'
          ? buildPanel(prod.params, prod.id, materials)
          : prod.kind === 'frame'
            ? buildFrame(prod.params, prod.id, materials)
            : prod.kind === 'panels'
              ? buildPanelSet(prod.params, prod.id, materials)
              : buildDesk(prod.params, prod.id, materials);
  const diagnostics: Diagnostic[] = [...partial.diagnostics];
  // A board chosen for a part role (ADR-163) or for one part (ADR-151) replaces its group's board, the part's own
  // winning; the checks below judge the result (thickness, band).
  const own = design.partMaterials ?? {};
  const byRole = design.roleMaterials ?? {};
  const panels = partial.panels.map((p) => {
    const roleId = byRole[p.role as keyof typeof byRole];
    const id =
      own[p.id] && materials.has(own[p.id])
        ? own[p.id]
        : roleId && materials.has(roleId)
          ? roleId
          : null;
    return id ? { ...p, materialId: id } : p;
  });
  // An edge band chosen for one part or its role (ADR-168): the part's own, then its role's, then its board's.
  const ownBand = design.partBands ?? {};
  const roleBand = design.roleBands ?? {};
  if (Object.keys(ownBand).length || Object.keys(roleBand).length)
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      const band =
        ownBand[p.id] ??
        rolesOf(p.role)
          .map((r) => roleBand[r])
          .find(Boolean);
      if (band) panels[i] = { ...p, band };
    }
  const built = new Set(panels.map((p) => p.id));
  const lostBands = Object.keys(ownBand).filter((id) => !built.has(id));
  if (lostBands.length)
    diagnostics.push({
      severity: 'warning',
      code: 'part-band-lost',
      message: tx(
        '{n|A part|# parts} with its own edge band no longer {n|exists|exist} (the piece changed); the band is not used. Clear it under Material → Part.',
        { n: lostBands.length },
      ),
    });
  const lost = Object.keys(own).filter((id) => !built.has(id));
  if (lost.length)
    diagnostics.push({
      severity: 'warning',
      code: 'part-board-lost',
      message:
        lost.length === 1
          ? tx(
              'A part with its own board no longer exists (the piece changed); the board choice is not used. Clear it under Material → Part.',
            )
          : tx(
              '{n} parts with their own board no longer exist (the piece changed); the board choice is not used. Clear it under Material → Part.',
              { n: lost.length },
            ),
    });

  // Integer millimetres and positive size, always.
  for (const p of panels) {
    const b = p.box;
    if (![b.x, b.y, b.z, b.w, b.h, b.d].every(isMm)) {
      diagnostics.push({
        severity: 'error',
        code: 'non-integer',
        message: tx('{part} has a non-integer dimension.', { part: tr(p.label) }),
        nodeId: p.nodeId,
        panelIds: [p.id],
      });
    }
    const m = materials.get(p.materialId);
    const c = cutDimensions(p, m?.grain ?? false);
    if (c.length <= 0 || c.width <= 0) {
      diagnostics.push({
        severity: 'error',
        code: 'zero-size',
        message: tx('{part} has no size ({l}×{w} mm).', {
          part: tr(p.label),
          l: c.length,
          w: c.width,
        }),
        nodeId: p.nodeId,
        panelIds: [p.id],
      });
    } else if (c.width < 30) {
      diagnostics.push({
        severity: 'warning',
        code: 'narrow-part',
        message: tx('{part} is only {w} mm wide.', { part: tr(p.label), w: c.width }),
        nodeId: p.nodeId,
        panelIds: [p.id],
      });
    }
    // Shaped parts (ADR-040): whole degrees, profiles inside their blank.
    for (const message of shapeProblems(p))
      diagnostics.push({
        severity: 'error',
        code: 'shape',
        message,
        nodeId: p.nodeId,
        panelIds: [p.id],
      });
    // Solid timber is cut from lengths of several sections; sheet parts must match their board (ADR-038).
    if (m && m.stock !== 'solid' && c.thickness !== m.thickness) {
      diagnostics.push({
        severity: 'error',
        code: 'thickness',
        message: tx('{part} thickness {t} mm does not match {board}.', {
          part: tr(p.label),
          t: c.thickness,
          board: m.name,
        }),
        nodeId: p.nodeId,
        panelIds: [p.id],
      });
    }
  }

  // No two parts may occupy the same space.
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (panelsOverlap(panels[i], panels[j])) {
        diagnostics.push({
          severity: 'error',
          code: 'overlap',
          message: tx('{a} and {b} occupy the same space.', {
            a: tr(panels[i].label),
            b: tr(panels[j].label),
          }),
          nodeId: panels[j].nodeId,
          panelIds: [panels[i].id, panels[j].id],
        });
      }
    }
  }

  // Carcass parts stay inside the declared envelope; fronts may sit in front of it.
  if (prod.kind === 'cabinet') {
    const { width: W, height: H, depth: D } = prod.params;
    const env = box(0, 0, 0, W, H, D);
    const front = materials.get(prod.params.frontMaterialId);
    // Sliding doors run on a track in front of the carcass (ADR-037). Fronts over a shared side reach over half of
    // the neighbour's side (ADR-170).
    const body = materials.get(prod.params.bodyMaterialId);
    const over = prod.params.shared?.right ? Math.floor((body?.thickness ?? 0) / 2) : 0;
    const frontEnv = box(
      0,
      0,
      0,
      W + over,
      H,
      D + Math.max(front?.thickness ?? 0, slidingTrackDepth(prod.params.interior)),
    );
    for (const p of panels) {
      if (!contains(FRONT_ROLES.has(p.role) ? frontEnv : env, aabbOf(p))) {
        diagnostics.push({
          severity: 'error',
          code: 'outside',
          message: tx('{part} sticks out of the {w}×{h}×{d} mm cabinet.', {
            part: tr(p.label),
            w: W,
            h: H,
            d: D,
          }),
          nodeId: p.nodeId,
          panelIds: [p.id],
        });
      }
    }
  }

  // A band narrower than the board it covers cannot close the edge (ADR-077). Nothing else about the band is
  // judged: sources disagree on the overhang.
  const narrow = new Map<string, { m: Material; band: EdgeBand; t: number; panels: Panel[] }>();
  for (const p of panels) {
    if (!p.banded.length) continue;
    const m = materials.get(p.materialId);
    const band = m && (p.band ?? bandFor(m, p.role));
    if (!m || !band) continue;
    const t = cutDimensions(p, m.grain).thickness;
    if (band.width >= t) continue;
    const k = `${m.id}|${bandText(band)}|${t}`;
    const g = narrow.get(k);
    if (g) g.panels.push(p);
    else narrow.set(k, { m, band, t, panels: [p] });
  }
  for (const { m, band, t, panels: list } of narrow.values())
    diagnostics.push({
      severity: 'error',
      code: 'band-narrow',
      nodeId: list[0].nodeId,
      panelIds: list.map((x) => x.id),
      message: tx('Edge band {band} on {board} is narrower than the {t} mm board.', {
        band: bandText(band),
        board: m.name,
        t,
      }),
    });

  // A board labelled kitchen worktop on other parts: guidance only, the user may mean it (ADR-049).
  for (const m of design.materials) {
    if (m.kind !== 'worktop') continue;
    const others = panels.filter((p) => p.materialId === m.id && p.role !== 'worktop');
    if (others.length) {
      diagnostics.push({
        severity: 'warning',
        code: 'worktop-board',
        nodeId: others[0].nodeId,
        panelIds: others.map((p) => p.id),
        message:
          others.length === 1
            ? tx('{board} is labelled kitchen worktop but is used for {part} (guidance).', {
                board: m.name,
                part: tr(others[0].label),
              })
            : tx(
                '{board} is labelled kitchen worktop but is used for {n} parts that are not worktops (guidance).',
                { board: m.name, n: others.length },
              ),
      });
    }
  }

  const model: FurnitureModel = {
    panels,
    spaces: partial.spaces,
    hardware: partial.hardware,
    diagnostics,
    bounds: union(panels.map(aabbOf)),
    ...(partial.sharedPins ? { sharedPins: partial.sharedPins } : {}),
  };
  // Construction guidance (ADR-035): labelled warnings and reminders, after the independent checks above.
  const ruled = runRules(design, model, materials);
  model.diagnostics.push(...ruled.diagnostics);
  model.hardware.push(...ruled.hardware);
  return model;
}

export const hasErrors = (m: FurnitureModel) => m.diagnostics.some((d) => d.severity === 'error');
