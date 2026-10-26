/**
 * Chair, installation and service clearances (ADR-073): the sizes the user sets on a piece, and the plan's
 * Clearances overlay that draws every zone the core derived, hatched and coloured by its worst problem.
 * Nothing here computes geometry: zones come from `buildProjectModel` (ADR-004).
 */
import { useId, useState } from 'react';
import {
  MAX_ZONE_DEPTH,
  kneeSpan,
  type ClearanceZone,
  type ItemZones,
  type ServiceSide,
} from '../core/envelopes';
import { isWallHung, type ProjectItem } from '../core/project';
import { useDesign } from '../store/designStore';
import { Segmented, Toggle } from './controls';

/** A millimetre field that may be left empty (= not set). Bad input is shown, never clamped or saved (ADR-008). */
function OptionalMm({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint: string;
}) {
  const id = useId();
  const shown = value === undefined ? '' : String(value);
  const [text, setText] = useState(shown);
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setText(shown);
  }
  const t = text.trim();
  const n = Number(t);
  const valid = t === '' || (Number.isInteger(n) && n >= 1 && n <= MAX_ZONE_DEPTH);
  const commit = () => {
    if (!valid) return;
    const next = t === '' ? undefined : n;
    if (next !== value) onChange(next);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`mm ${valid ? '' : 'invalid'}`}>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          placeholder="not set"
          aria-invalid={!valid}
          aria-describedby={`${id}-help`}
          onChange={(e) => setText(e.target.value.replace(/[^\d-]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            // Enter leaves the field; the blur commits, once (committing here too made two undo steps).
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setText(shown);
          }}
        />
        <span className="unit">mm</span>
      </div>
      {valid ? (
        <p className="hint" id={`${id}-help`}>
          {hint}
        </p>
      ) : (
        <p className="field-error" id={`${id}-help`}>
          Whole number from 1 to {MAX_ZONE_DEPTH}, or leave it empty for none. Not saved yet.
        </p>
      )}
    </div>
  );
}

/** Drop unset keys so an item with nothing set has no `zones` at all. */
function tidy(z: ItemZones): ItemZones | undefined {
  const out: ItemZones = {};
  if (z.chairDepth !== undefined) out.chairDepth = z.chairDepth;
  if (z.service) out.service = z.service.depth === undefined ? { side: z.service.side } : z.service;
  if (z.lyingDown) out.lyingDown = true;
  return Object.keys(out).length ? out : undefined;
}

/** The selected piece's clearance settings: chair space (desks), a service zone, how it is assembled. */
export function ClearanceFields({ item }: { item: ProjectItem }) {
  const update = useDesign((s) => s.updateItem);
  const z = item.zones ?? {};
  const set = (patch: Partial<ItemZones>) => update(item.id, { zones: tidy({ ...z, ...patch }) });
  const side: ServiceSide | 'none' = z.service?.side ?? 'none';
  const standsUp = !isWallHung(item.design) && item.placement?.kind !== 'above';
  return (
    <div className="zone-fields" role="group" aria-label="Clearance zones">
      <div className="card-title">
        <span>Clearance zones</span>
      </div>
      {kneeSpan(item.design) && (
        <OptionalMm
          label="Chair space depth"
          value={z.chairDepth}
          onChange={(v) => set({ chairDepth: v })}
          hint="Free space in front of the knee space for the chair and the person. No default: enter the depth you plan for."
        />
      )}
      <Segmented<ServiceSide | 'none'>
        label="Service zone"
        value={side}
        options={[
          { value: 'none', label: 'None' },
          { value: 'front', label: 'Front' },
          { value: 'back', label: 'Back' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(v) =>
          set({ service: v === 'none' ? undefined : { side: v, depth: z.service?.depth } })
        }
      />
      {z.service && (
        <OptionalMm
          label="Service zone depth"
          value={z.service.depth}
          onChange={(v) => set({ service: { side: z.service!.side, depth: v } })}
          hint="Space kept free on that side, for example behind an appliance. No default: enter the size the appliance needs."
        />
      )}
      {standsUp && (
        <Toggle
          label="Assembled lying down"
          checked={!!z.lyingDown}
          onChange={(v) => set({ lyingDown: v })}
        />
      )}
      {standsUp && (
        <p className="hint">
          Guidance: a piece tipped up from lying on its back sweeps its side diagonal. When it is
          assembled lying down, no room to stand it up is an error; otherwise a warning.
        </p>
      )}
    </div>
  );
}

const KIND_NAME: Record<ClearanceZone['kind'], string> = {
  body: 'Body',
  door: 'Door swing',
  drawer: 'Drawer travel',
  flap: 'Flap',
  chair: 'Chair space',
  service: 'Service zone',
};
const SEVERITY_NAME: Record<ClearanceZone['severity'], string> = {
  none: 'no problem',
  warning: 'warning',
  error: 'error',
};

/** The Clearances toggle and legend above the plan. */
export function ZoneToolbar({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="plan-tools">
      <Toggle label="Clearances" checked={on} onChange={onChange} />
      {on && (
        <p className="zone-legend" aria-label="Clearance legend">
          <span className="key none">No problem</span>
          <span className="key warning">Warning</span>
          <span className="key error">Error</span>
        </p>
      )}
    </div>
  );
}

/** Every zone as a hatched box on the plan (x across, z down), drawn under the pieces' labels. */
export function ZoneOverlay({ zones, fs }: { zones: ClearanceZone[]; fs: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const step = fs * 0.7;
  return (
    <g className="zones" aria-label="Clearance zones">
      <defs>
        {(['none', 'warning', 'error'] as const).map((s) => (
          <pattern
            key={s}
            id={`${uid}-${s}`}
            patternUnits="userSpaceOnUse"
            width={step}
            height={step}
            patternTransform="rotate(45)"
          >
            <line
              className={`hatch ${s}`}
              x1={step / 2}
              y1={0}
              x2={step / 2}
              y2={step}
              strokeWidth={step * 0.3}
            />
          </pattern>
        ))}
      </defs>
      {zones.map((z, i) => (
        <g key={i} className={`zone ${z.severity} ${z.kind}`}>
          <rect
            x={z.box.x}
            y={z.box.z}
            width={z.box.w}
            height={z.box.d}
            fill={`url(#${uid}-${z.severity})`}
          >
            <title>
              {z.label.startsWith(KIND_NAME[z.kind]) ? z.label : `${KIND_NAME[z.kind]}: ${z.label}`}
              , {SEVERITY_NAME[z.severity]}
            </title>
          </rect>
          {(z.kind === 'chair' || z.kind === 'service') && (
            <text
              x={z.box.x + z.box.w / 2}
              y={z.box.z + z.box.d / 2}
              fontSize={Math.min(fs * 0.8, z.box.w / 6, z.box.d / 1.5)}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {KIND_NAME[z.kind]}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}
