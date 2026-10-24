import type { PartialModel } from './cabinet';
import { box } from './geometry';
import type { Material, PanelParams } from './types';

const PURPOSE_LABEL: Record<PanelParams['purpose'], string> = {
  dishwasher: 'Dishwasher front',
  fridge: 'Fridge door front',
  cover: 'Cover panel',
  filler: 'Filler',
};

/**
 * A front with no carcass behind it (ADR-036): an integrated dishwasher or fridge door, an end cover panel or a
 * filler. One panel, standing on the floor with its face towards the viewer. Fixing hardware comes with the
 * appliance or is the user's choice; nothing is specified here.
 */
export function buildPanel(
  p: PanelParams,
  id: string,
  materials: Map<string, Material>,
): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] };
  const m = materials.get(p.materialId);
  if (!m) {
    out.diagnostics.push({
      severity: 'error',
      code: 'material-missing',
      message: 'The board for this panel does not exist in the design.',
      nodeId: id,
    });
    return out;
  }
  const { width: w, height: h } = p;
  if (w < 20 || h < 50) {
    out.diagnostics.push({
      severity: 'error',
      code: 'panel-too-small',
      message: `Panel ${w}×${h} mm is too small.`,
      nodeId: id,
    });
    return out;
  }
  const label = PURPOSE_LABEL[p.purpose];
  const role = p.purpose === 'cover' ? 'cover-panel' : p.purpose === 'filler' ? 'filler' : 'door';
  out.panels.push({
    id: `${id}/${role}`,
    nodeId: id,
    role,
    label,
    materialId: m.id,
    box: box(0, 0, 0, w, h, m.thickness),
    thicknessAxis: 'z',
    grainAxis: 'y',
    banded: ['-x', '+x', '-y', '+y'],
  });
  const handle = p.purpose === 'dishwasher' || p.purpose === 'fridge' ? p.handle : null;
  if (handle && handle.kind !== 'push') {
    const panel = out.panels[0];
    const vc =
      handle.position === 'bottom'
        ? Math.min(40, Math.floor(h / 2))
        : handle.position === 'centre'
          ? Math.floor(h / 2)
          : h - Math.min(40, Math.floor(h / 2));
    const uc = Math.floor(w / 2);
    if (handle.kind === 'knob') panel.handleHoles = { at: [[uc, vc]], diameter: 5 };
    else {
      const S = handle.holeSpacing ?? 128;
      if (S + 40 > w)
        out.diagnostics.push({
          severity: 'warning',
          code: 'handle-fit',
          message: `${S} mm handle does not fit on the ${w} mm front.`,
          nodeId: id,
        });
      else
        panel.handleHoles = {
          at: [
            [uc - Math.floor(S / 2), vc],
            [uc - Math.floor(S / 2) + S, vc],
          ],
          diameter: 5,
        };
    }
    out.hardware.push({
      nodeId: id,
      kind: 'handle',
      label: handle.kind === 'bar' ? `Bar handle, ${handle.holeSpacing ?? 128} mm centres` : 'Knob',
      quantity: 1,
    });
  }
  if (p.purpose === 'dishwasher' || p.purpose === 'fridge') {
    out.hardware.push({
      nodeId: id,
      kind: 'front-fixing',
      label: `${label} fixing kit`,
      quantity: 1,
      note: 'usually supplied with the appliance — check the front size and the fixing points against its installation drawing',
    });
  }
  return out;
}
