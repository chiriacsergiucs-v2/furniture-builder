import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  makeModelItem,
  modelYaw,
  MODEL_SIDE_MAX,
  resizeModel,
  type ModelFront,
  type ModelItem,
  type ModelTurn,
} from '../core/model3d';
import { newId } from '../core/design';
import { PROJECT_SCHEMA, type ProjectModel } from '../core/project';
import type { Box } from '../core/types';
import { deleteModelIfUnused, listModels, loadModel, type StoredModel } from '../persist/db';
import { forgetModelScene, importModelFile } from '../persist/models';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { InfoTip, MmField, Segmented, Toggle } from './controls';
import { useKeepProportions } from './keepProportions';
import { Icon } from './icons';
import { arrowMove } from './planDrag';

/**
 * Display-only 3D models in a project (ADR-076): the library under Catalog → My 3D models, the selected model's
 * fields, and its labelled box on the plan and in the front view. Boxes come from `buildProjectModel` (ADR-004).
 */

const FRONTS: { value: ModelFront; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'right', label: 'Right' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left' },
];

/** Change one model item of the open project (one undo step). */
function usePatchModel() {
  const updateProject = useDesign((s) => s.updateProject);
  return (id: string, patch: Partial<ModelItem>) =>
    updateProject((p) => ({
      ...p,
      models: (p.models ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
}

/** The selected model's fields in Compose. */
export function ModelFields({ item }: { item: ModelItem }) {
  const patch = usePatchModel();
  const updateProject = useDesign((s) => s.updateProject);
  const select = useDesign((s) => s.selectItem);
  const [missing, setMissing] = useState(false);
  // The stored model's own size, for Reset size (ADR-102).
  const [natural, setNatural] = useState<StoredModel['size'] | null>(null);
  const [keep, setKeep] = useKeepProportions(item.id);
  useEffect(() => {
    let live = true;
    loadModel(item.modelId)
      .then((r) => {
        if (!live) return;
        setMissing(!r);
        setNatural(r?.size ?? null);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [item.modelId]);
  const pos = item.position;
  return (
    <section className="piece-edit section" aria-label={`Selected 3D model: ${item.name}`}>
      <div className="card-title">
        <span className="info-row">
          <span>Selected 3D model</span>
          <InfoTip label="About 3D models" align="start">
            Display only: never in the parts list, sheets, costs or shopping list. Its box is
            checked against the pieces and the room.
          </InfoTip>
        </span>
      </div>
      <h3>{item.name}</h3>
      {missing && (
        <p className="hint" role="status">
          This 3D model is not on this device; it is drawn as a box.
        </p>
      )}
      <div className="dims3">
        {(
          [
            ['w', 'Width'],
            ['h', 'Height'],
            ['d', 'Depth'],
          ] as const
        ).map(([side, label]) => (
          <MmField
            key={side}
            label={label}
            value={item.size[side]}
            min={1}
            max={MODEL_SIDE_MAX}
            onChange={(v) => patch(item.id, { size: resizeModel(item.size, side, v, keep) })}
          />
        ))}
      </div>
      <Toggle
        label="Keep proportions"
        checked={keep}
        onChange={setKeep}
        info={
          <InfoTip label="About keep proportions" align="start">
            {keep
              ? 'Changing one side scales the other two with it.'
              : 'Each side changes on its own; the model stretches to fill its box.'}
          </InfoTip>
        }
      />
      {natural &&
        (natural.w !== item.size.w || natural.h !== item.size.h || natural.d !== item.size.d) && (
          <button
            type="button"
            className="btn sm outline"
            onClick={() => patch(item.id, { size: { ...natural } })}
          >
            Reset size
          </button>
        )}
      <Segmented<ModelTurn>
        label="Turn"
        value={item.rotationY}
        options={[
          { value: 0, label: '0°' },
          { value: 90, label: '90°' },
          { value: 180, label: '180°' },
          { value: 270, label: '270°' },
        ]}
        onChange={(v) => patch(item.id, { rotationY: v })}
      />
      <Segmented<ModelFront>
        label="Front faces"
        value={item.front ?? 'front'}
        options={FRONTS}
        onChange={(v) => patch(item.id, v === 'front' ? { front: undefined } : { front: v })}
        info={
          <InfoTip label="About front faces" align="start">
            The side of the model that is its front, if it came in facing the wrong way.
          </InfoTip>
        }
      />
      <div className="dims3">
        <MmField
          label="From left"
          value={pos.x}
          min={-20000}
          max={20000}
          onChange={(v) => patch(item.id, { position: { ...pos, x: v } })}
        />
        <MmField
          label="From back"
          value={pos.z}
          min={-20000}
          max={20000}
          onChange={(v) => patch(item.id, { position: { ...pos, z: v } })}
        />
        <MmField
          label="Height above floor"
          value={pos.y}
          min={0}
          max={5000}
          onChange={(v) => patch(item.id, { position: { ...pos, y: v } })}
        />
      </div>
      <button
        type="button"
        className="danger-link"
        onClick={async () => {
          if (
            await askConfirm(`Remove “${item.name}” from this project?`, {
              confirmLabel: 'Remove',
              danger: true,
            })
          ) {
            select(null);
            updateProject((p) => ({
              ...p,
              models: (p.models ?? []).filter((m) => m.id !== item.id),
            }));
          }
        }}
      >
        Remove from project
      </button>
    </section>
  );
}

/** The project's 3D models, listed under its pieces. */
export function ModelList({ pm }: { pm: ProjectModel | null }) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  if (!pm?.models.length) return null;
  return (
    <>
      <h3 className="list-head">3D models (display only)</h3>
      <ul className="pieces">
        {pm.models.map(({ item, box }) => (
          <li key={item.id}>
            <button
              type="button"
              className={`row-btn ${item.id === selectedId ? 'on' : ''}`}
              aria-pressed={item.id === selectedId}
              onClick={() => select(item.id)}
            >
              <span>
                <strong>{item.name}</strong>
                <span className="sub num">
                  {box.w} × {box.h} × {box.d} mm
                </span>
              </span>
              <Icon name="chevron-right" className="chev sm" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Object URLs for the thumbnails of the listed models, freed when the list changes. */
function useThumbs(rows: StoredModel[]): Map<string, string> {
  const urls = useMemo(
    () =>
      new Map(
        rows.flatMap((r) =>
          r.thumb
            ? [[r.id, URL.createObjectURL(new Blob([r.thumb], { type: 'image/png' }))] as const]
            : [],
        ),
      ),
    [rows],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

/** Catalog → My 3D models: import files from the device, add one to the open project, delete unused ones. */
export function MyModels({ onDone, canAdd = true }: { onDone: () => void; canAdd?: boolean }) {
  const [rows, setRows] = useState<StoredModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<{ ok: boolean; text: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const updateProject = useDesign((s) => s.updateProject);
  const select = useDesign((s) => s.selectItem);
  const thumbs = useThumbs(rows);
  const refresh = () =>
    listModels()
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    void refresh();
  }, []);

  const importFiles = async (files: File[]) => {
    setBusy(true);
    const out: { ok: boolean; text: string }[] = [];
    for (const f of files) {
      const r = await importModelFile(f);
      out.push(
        r.ok ? { ok: true, text: `Imported ${r.model.name}.` } : { ok: false, text: r.problem },
      );
    }
    setNotes(out);
    setBusy(false);
    await refresh();
  };

  const add = (row: StoredModel) => {
    const pm = useDesign.getState().projectModel;
    const b: Box | undefined = pm?.extent;
    const id = newId();
    const item = makeModelItem(id, row, b && (b.w || b.d) ? b.x + b.w : 0);
    updateProject((p) => ({
      ...p,
      schemaVersion: PROJECT_SCHEMA,
      models: [...(p.models ?? []), item],
    }));
    select(id);
    onDone();
  };

  const remove = async (row: StoredModel) => {
    if (
      !(await askConfirm(`Delete “${row.name}” from this device's 3D models?`, {
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    // In use: the open project, and its undo and redo steps (an undo must not bring back a deleted file).
    const st = useDesign.getState();
    const open = [st.project, ...st.projectPast, ...st.projectFuture].flatMap((p) =>
      (p?.models ?? []).map((m) => m.modelId),
    );
    try {
      const r = await deleteModelIfUnused(row.id, open);
      if (r.deleted) forgetModelScene(row.id);
      setNotes([
        r.deleted
          ? { ok: true, text: `Deleted ${row.name}.` }
          : {
              ok: false,
              text: `${row.name} is used by ${[...new Set(r.usedBy)].slice(0, 3).join(', ')}; remove it there first.`,
            },
      ]);
    } catch {
      setNotes([{ ok: false, text: `${row.name} could not be deleted.` }]);
    }
    await refresh();
  };

  return (
    <section className="my-models" aria-labelledby="my-models-head">
      <div className="info-row">
        <h3 className="list-head" id="my-models-head">
          My 3D models
        </h3>
        <InfoTip label="About my 3D models" align="start">
          Appliances, sinks or decor from a .glb or .gltf file on this device, up to 30 MB and 500
          000 triangles. Display only: never cut, priced or bought. Nothing is uploaded.
        </InfoTip>
      </div>
      <input
        ref={input}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void importFiles(files);
        }}
      />
      <button
        type="button"
        className="btn outline block"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" />
        {busy ? 'Importing…' : 'Import 3D model'}
      </button>
      {notes.map((n, i) => (
        <p key={i} className={n.ok ? 'hint' : 'alert error'} role={n.ok ? 'status' : 'alert'}>
          {n.text}
        </p>
      ))}
      {rows.length > 0 && !canAdd && <p className="hint">Open a project to add a model to it.</p>}
      {rows.length > 0 && (
        <ul className="template-list">
          {rows.map((r) => (
            <li key={r.id} className="model-row">
              <button type="button" className="row-btn" disabled={!canAdd} onClick={() => add(r)}>
                <span className="glyph">
                  {thumbs.get(r.id) ? (
                    <img src={thumbs.get(r.id)} alt="" width={36} height={36} />
                  ) : (
                    <Icon name="cube" />
                  )}
                </span>
                <span>
                  <strong>{r.name}</strong>
                  <span className="sub num">
                    {r.size.w} × {r.size.h} × {r.size.d} mm · {r.triangles.toLocaleString('en')}{' '}
                    triangles
                  </span>
                </span>
                <Icon name="plus" className="chev sm" />
              </button>
              <button
                type="button"
                className="btn sm ghost"
                aria-label={`Delete ${r.name}`}
                onClick={() => void remove(r)}
              >
                <Icon name="trash" className="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const onEnter = (f: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    f();
  }
};

/** The edge of a box its front faces, on the plan (x right, z away from the back wall). */
function frontEdge(b: Box, yaw: ModelTurn): [number, number, number, number] {
  return yaw === 0
    ? [b.x, b.z + b.d, b.x + b.w, b.z + b.d]
    : yaw === 90
      ? [b.x + b.w, b.z, b.x + b.w, b.z + b.d]
      : yaw === 180
        ? [b.x, b.z, b.x + b.w, b.z]
        : [b.x, b.z, b.x, b.z + b.d];
}

/** The project's models on the plan: labelled dashed boxes; tap to select, arrow keys move by 10 mm (Shift 100). */
export function PlanModels({
  pm,
  fs,
  tapping,
}: {
  pm: ProjectModel;
  fs: number;
  tapping: boolean;
}) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  const patch = usePatchModel();
  return (
    <>
      {pm.models.map(({ item, box: b }) => {
        const [x1, z1, x2, z2] = frontEdge(b, modelYaw(item));
        const on = item.id === selectedId;
        return (
          <g
            key={item.id}
            className={`plan-piece plan-model ${on ? 'on' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${item.name} (3D model), ${b.w} by ${b.d} mm`}
            onClick={tapping ? undefined : () => select(item.id)}
            onKeyDown={(e) => {
              const m = tapping ? null : arrowMove(e.key, e.shiftKey);
              if (!m) return onEnter(() => select(item.id))(e);
              e.preventDefault();
              patch(item.id, {
                position: {
                  ...item.position,
                  x: item.position.x + m.dx,
                  z: item.position.z + m.dz,
                },
              });
            }}
          >
            <rect x={b.x} y={b.z} width={b.w} height={b.d} />
            <line className="front" x1={x1} y1={z1} x2={x2} y2={z2} />
            <text
              x={b.x + b.w / 2}
              y={b.z + b.d / 2}
              fontSize={Math.min(fs, b.w / 7)}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {item.name}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** The project's models in the front view: labelled dashed boxes (y up is drawn as −y). */
export function FrontModels({ pm, fs }: { pm: ProjectModel; fs: number }) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  return (
    <>
      {[...pm.models]
        .sort((a, c) => a.box.z + a.box.d - (c.box.z + c.box.d))
        .map(({ item, box: b }) => (
          <g
            key={item.id}
            className={`front-model ${item.id === selectedId ? 'on' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={item.id === selectedId}
            aria-label={`${item.name} (3D model), ${b.w} wide, ${b.h} high`}
            onClick={() => select(item.id)}
            onKeyDown={onEnter(() => select(item.id))}
          >
            <rect x={b.x} y={-(b.y + b.h)} width={b.w} height={b.h} />
            <text
              x={b.x + b.w / 2}
              y={-(b.y + b.h / 2)}
              fontSize={Math.min(fs, b.w / 7)}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {item.name}
            </text>
          </g>
        ))}
    </>
  );
}
