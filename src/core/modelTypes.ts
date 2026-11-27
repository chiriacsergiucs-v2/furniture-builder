/** The built model (G-548, ADR-306): panels, hardware, diagnostics and openings, generated from a design, never saved. */
import type { Diagnostic } from './diagnosticCodes';
import type { Axis, Box, Face, Mm } from './kernelTypes';
import type { EdgeBand } from './materialTypes';
import type { SpaceKind } from './productTypes';

export type PanelRole =
  | 'side'
  | 'top'
  | 'bottom'
  | 'back'
  | 'plinth'
  | 'divider'
  | 'shelf'
  | 'door'
  | 'drawer-front'
  | 'drawer-side'
  | 'drawer-back'
  | 'drawer-inner-front'
  | 'drawer-bottom'
  | 'worktop'
  | 'gable'
  | 'modesty'
  | 'blind-panel'
  /** Panel set parts (ADR-041). */
  | 'loose'
  /** Top rails instead of a full top (ADR-036); frame parts (ADR-038). */
  | 'rail'
  | 'leg'
  | 'apron'
  | 'stretcher'
  | 'slat'
  | 'ledger'
  | 'seat'
  | 'headboard'
  | 'footboard'
  | 'stile'
  | 'rung'
  /** Run parts in a project (ADR-036). */
  | 'filler'
  | 'cover-panel'
  /** Crown, pelmet and ceiling filler along a run (ADR-075). */
  | 'trim';

/**
 * One physical sheet part. `box` is the finished size and position.
 * The 3D view and the cutlist are both projections of this record.
 */
export interface Panel {
  /** Stable across resizes: `${nodeId}/${role}[/${index}]`. */
  id: string;
  /** Design node that generated this panel; used for selection. */
  nodeId: string;
  role: PanelRole;
  label: string;
  materialId: string;
  box: Box;
  thicknessAxis: Axis;
  /** In-plane axis the decor grain runs along (ignored when the material has no grain). */
  grainAxis: Axis;
  /** Edges that receive edge banding, named by the outward face they sit on. */
  banded: Face[];
  /** 32 mm-system shelf-pin hole rows (annotation for the panel shop, ADR-023). */
  pinRows?: PinRows[];
  /** Handle holes on a front, measured from the front's left and bottom edges (ADR-024). */
  handleHoles?: { at: [Mm, Mm][]; diameter: Mm };
  /** Shaped part (ADR-040): `box` stays the whole-mm cut blank; absent = a plain box. */
  shape?: PanelShape;
  /** The edge band chosen for this part or its role (ADR-188); absent = its board's band. */
  band?: EdgeBand;
  /**
   * A moulding's cross-section (ADR-209): whole-mm points [across, up] from the box's back-bottom corner, drawn in 3D
   * extruded along the box's length (x). Display only: the cut size is `box`.
   */
  section?: [Mm, Mm][];
  /** A worktop's front edge shape (ADR-209): drawn in 3D on the edge `face`, `size` mm; display only. */
  edgeProfile?: { kind: 'rounded' | 'bevel'; size: Mm; face: Face };
  /**
   * What kind of front a door or drawer front is, where its role does not say (ADR-304), set by the generators: a hinged
   * door, a sliding door, a lift-up or drop-down flap, or a fixed drawer front (no travel). Absent on other parts and on
   * fronts no cabinet made (an appliance front). Generated, never saved (ADR-011).
   */
  front?: 'hinged' | 'sliding' | 'flap-up' | 'flap-down' | 'fixed';
  /** A door of a pair: the side it hinges on, as seen from the front (ADR-304). Absent: a single door's plates say. */
  hinge?: 'left' | 'right';
  /** The drawer a drawer box part or drawer front belongs to, 1 = the top one (ADR-304). */
  drawer?: number;
}

/**
 * ADR-040. `tilt`: the blank turned by whole degrees (right-hand rule) about an axis through `pivot`, measured from
 * the blank's minimum corner; placement only, the cut size is the blank. `profile`: a board cut to a polygon on its
 * face, whole-mm points [u, v] from the blank's minimum corner along its two in-plane axes (x, y, z order).
 */
export type PanelShape =
  | { kind: 'tilt'; axis: Axis; angleDeg: number; pivot: [Mm, Mm, Mm] }
  | {
      kind: 'profile';
      points: [Mm, Mm][];
      /** Holes cut through the board (ADR-205), whole-mm polygons in the same [u, v] terms as `points`. */
      holes?: [Mm, Mm][][];
      /**
       * The rectangular cut-outs (notches or holes) made in it, for the cut-list note (ADR-205): `u`/`v` from the blank's
       * left and bottom (its minimum corner on the in-plane axes), `w` × `h` mm.
       */
      cutouts?: { u: Mm; v: Mm; w: Mm; h: Mm }[];
    };

/** Hole rows on one face of a panel. Positions are measured on the panel itself, in mm. */
export interface PinRows {
  face: Face;
  /** Row positions across the panel depth, measured from the panel's rear edge. */
  rows: Mm[];
  /** Hole centres along the panel height, measured from the panel's bottom edge. */
  holes: Mm[];
  diameter: Mm;
}

export type HardwareKind =
  | 'drawer-runner-pair'
  | 'hinge'
  | 'clothes-rail'
  | 'rail-support'
  | 'shelf-pin'
  | 'handle'
  | 'push-latch'
  | 'wall-bracket'
  | 'wall-rail'
  /** ADR-177: a hung corner unit's hanging brackets, chosen by the user (no count or size scheduled). */
  | 'wall-hanging'
  | 'corner-hinge'
  /** ADR-035 anti-tip fixing, ADR-036 appliance and front fixing, ADR-037 sliding track and flap stay, ADR-038/039 purchased items. */
  | 'wall-fixing'
  /** ADR-292: a tall piece open on both sides is fixed to the floor or ceiling; the fixing is the user's choice. */
  | 'floor-fixing'
  | 'appliance'
  | 'front-fixing'
  | 'sliding-track'
  | 'flap-stay'
  | 'purchased'
  /** ADR-041 amendment: a screwed joint between two placed panels; screw type, length and count are the user's choice. */
  | 'screws';

export interface HardwareItem {
  nodeId: string;
  kind: HardwareKind;
  label: string;
  quantity: number;
  /** Nominal size in mm where meaningful (runner length, rail length). */
  sizeMm?: Mm;
  note?: string;
  /**
   * The panels this item fixes to (ADR-207), model only, never saved: a hinge's side or divider its mounting plates
   * go on, a runner pair's two panels either side of its opening. Absent = not known (the panel is in another piece).
   */
  panelIds?: string[];
}

/** The clear interior of an editable space, for selection and labelling. */
export interface SpaceOpening {
  nodeId: string;
  kind: SpaceKind;
  box: Box;
  /** Depth in the space tree (root = 0). */
  depth: number;
  /** Spaces of an L-corner's side wing are not drawn in the front view (selected from the inspector instead). */
  view?: 'front' | 'side';
  leaf: boolean;
  hasDoors: boolean;
}

/** Output of building a design: the single normalised model. */
export interface FurnitureModel {
  panels: Panel[];
  spaces: SpaceOpening[];
  hardware: HardwareItem[];
  diagnostics: Diagnostic[];
  /** Overall bounding box including fronts. */
  bounds: Box;
  /**
   * Shelf-pin rows this cabinet needs on the neighbour's side it shares (ADR-190), measured as on that side: face
   * `-x`, rows from its rear edge, holes from its bottom edge. Absent = none.
   */
  sharedPins?: PinRows[];
}
