/**
 * Run parts the user asks for (ADR-075): a worktop over chosen adjacent base units, a worktop's overhangs, and
 * crown, pelmet and ceiling-filler trims over wall or tall units. Every size comes from the core plan
 * (`planRuns`); this only collects the choice. Trim heights have no default: the user enters them.
 * Also handles for a run and sinks over base units (ADR-125); hobs, worktop corner joints and the cut-outs and joint
 * lines drawn on the plan (ADR-205).
 */
import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { newId } from '../core/design';
import { projectBoards, roleBoard } from '../core/finish';
import { t } from '../core/i18n';
import {
  BAR_SPACINGS,
  cutoutOutlines,
  materialKey,
  parseProfile,
  profileBounds,
  profileText,
  profileValid,
  requestCandidates,
  requestKey,
  runHandleMembers,
  runPartKey,
  runPartNames,
  worktopCorners,
  worktopJointLines,
  WORKTOP_OVERHANG,
  type PlacedPiece,
  type Project,
  type RunHandle,
  type RunPart,
  type RunRequest,
  type RunSink,
  type TrimKind,
  type WorktopEdgeKind,
} from '../core/project';
import type { Handle, Mm } from '../core/types';
import { useDesign } from '../store/designStore';
import { MmField, Segmented, Select, Toggle } from './controls';
import { Icon } from './icons';
import { RequestBindButton, requestBindingHint } from './Variables';

const TRIMS: { value: TrimKind; label: string }[] = [
  { value: 'crown', label: t('Crown') },
  { value: 'pelmet', label: t('Pelmet') },
  { value: 'ceiling-filler', label: t('Ceiling filler') },
];

/** Ticked ids in left → right order, and whether they sit next to each other in one of `rows`. */
function picked(rows: string[][], ticked: Set<string>): { ids: string[]; adjacent: boolean } {
  for (const row of rows) {
    const idx = row.flatMap((id, i) => (ticked.has(id) ? [i] : []));
    if (!idx.length) continue;
    const ids = idx.map((i) => row[i]);
    return {
      ids,
      adjacent: ids.length === ticked.size && idx.every((v, i) => v === idx[0] + i),
    };
  }
  return { ids: [], adjacent: false };
}

/** Front and side overhang of one worktop; editing them asks for that worktop with these values. */
export function WorktopOverhang({ part }: { part: RunPart }) {
  const project = useDesign((s) => s.project);
  const requests = project?.runRequests;
  const setRunRequest = useDesign((s) => s.setRunRequest);
  const [open, setOpen] = useState(false);
  const req = requests?.find((r) => requestKey(r) === part.key);
  const front = req?.front ?? WORKTOP_OVERHANG;
  const side = req?.side ?? 0;
  const set = (patch: Pick<RunRequest, 'front' | 'side'>) =>
    setRunRequest({
      ...(req ?? { kind: 'worktop', from: part.from ?? [] }),
      front,
      side,
      ...patch,
    });
  // The overhangs can follow a variable (ADR-209); binding one asks for this worktop first if it was only suggested.
  const asked: RunRequest = req ?? { kind: 'worktop', from: part.from ?? [], front, side };
  const hint = (target: 'front' | 'side') =>
    project ? requestBindingHint(project, asked, target) : undefined;
  return (
    <div className="run-edit">
      <button
        type="button"
        className="btn ghost sm"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {t('Overhang: {front} mm front, {side} mm sides', { front, side })}
      </button>
      {open && (
        <div className="run-ask">
          <MmField
            label={t('Front overhang')}
            value={front}
            min={0}
            max={1000}
            step={5}
            onChange={(v) => set({ front: v })}
            disabled={!!hint('front')}
            hint={hint('front')}
            trailing={<RequestBindButton request={asked} target="front" />}
          />
          <MmField
            label={t('Side overhang')}
            value={side}
            min={0}
            max={1000}
            step={5}
            onChange={(v) => set({ side: v })}
            disabled={!!hint('side')}
            hint={hint('side') ?? t('Past each end of the worktop')}
            trailing={<RequestBindButton request={asked} target="side" />}
          />
        </div>
      )}
    </div>
  );
}

const EDGE_KINDS: { value: WorktopEdgeKind; label: string }[] = [
  { value: 'square', label: t('Square') },
  { value: 'rounded', label: t('Rounded') },
  { value: 'bevel', label: t('Bevelled') },
];

/**
 * A worktop's front edge (ADR-209): Square, Rounded or Bevelled, and its size typed by the user (no default, ADR-010).
 * Rounded or Bevelled without a size is a warning and is drawn square.
 */
export function WorktopEdgeEdit({ part }: { part: RunPart }) {
  const edges = useDesign((s) => s.project?.worktopEdges);
  const setEdge = useDesign((s) => s.setWorktopEdge);
  const key = runPartKey(part);
  const edge = edges?.find((e) => e.key === key);
  const kind = edge?.kind ?? 'square';
  const [size, setSize] = useState(edge?.size !== undefined ? String(edge.size) : '');
  const [seen, setSeen] = useState(edge?.size);
  if (seen !== edge?.size) {
    setSeen(edge?.size);
    setSize(edge?.size !== undefined ? String(edge.size) : '');
  }
  const save = (k: WorktopEdgeKind, s: string) => {
    const n = typed(s);
    setEdge({ key, kind: k, ...(n !== null ? { size: n } : {}) });
  };
  return (
    <div className="run-edit worktop-edge">
      <Segmented<WorktopEdgeKind>
        label={t('Edge profile')}
        value={kind}
        options={EDGE_KINDS}
        onChange={(k) => save(k, size)}
      />
      {kind !== 'square' && (
        <TypedMm
          label={t('Edge size (mm)')}
          value={size}
          onChange={(v) => {
            setSize(v);
            if (v.trim() === '' || typed(v) !== null) save(kind, v);
          }}
          hint={
            kind === 'rounded'
              ? t('The radius of the front edge; there is no default.')
              : t('How far the bevel cuts back; there is no default.')
          }
        />
      )}
    </div>
  );
}

/**
 * A moulding's cross-section (ADR-209): typed as points ("0,0; 20,0; 20,45; 0,60") or tapped on a whole-mm grid, with
 * a live drawing. Across first, then up, from the back-bottom corner. Malformed text is not saved; a profile that
 * crosses itself is saved and shown as the error `trim-profile-invalid`.
 */
export function ProfileEditor({
  value,
  onChange,
}: {
  value: [Mm, Mm][] | undefined;
  onChange: (p: [Mm, Mm][] | undefined) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value ? profileText(value) : '');
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value ? profileText(value) : '');
  }
  const parsed = parseProfile(text);
  const pts = parsed ?? value ?? [];
  const bad = parsed === null;
  const crossing = !bad && pts.length > 0 && !profileValid(pts);
  const commit = (next: [Mm, Mm][] | null) => {
    if (next === null) return;
    onChange(next.length ? next : undefined);
  };
  const b = profileBounds(pts);
  const W = Math.max(100, b.u + b.w + 20),
    H = Math.max(100, b.v + b.h + 20);
  const tap = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    // A whole-mm grid: the tap lands on the nearest millimetre.
    const u = Math.round(p.x),
      v = Math.round(H - p.y);
    if (u < 0 || v < 0 || u > W || v > H) return;
    const next: [Mm, Mm][] = [...pts, [u, v]];
    setText(profileText(next));
    commit(next);
  };
  const grid: number[] = [];
  for (let g = 0; g <= Math.max(W, H); g += 10) grid.push(g);
  return (
    <div className="field profile-editor">
      <label htmlFor={id}>{t('Moulding profile')}</label>
      <input
        id={id}
        value={text}
        placeholder={t('e.g. 0,0; 20,0; 20,45; 0,60')}
        aria-invalid={bad || crossing}
        aria-describedby={`${id}-hint`}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(parsed)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <svg
        className="profile-grid"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t('Moulding profile drawing; tap to add a point')}
        onPointerDown={tap}
      >
        {grid
          .filter((g) => g <= W)
          .map((g) => (
            <line key={`u${g}`} x1={g} y1={0} x2={g} y2={H} className="grid" />
          ))}
        {grid
          .filter((g) => g <= H)
          .map((g) => (
            <line key={`v${g}`} x1={0} y1={H - g} x2={W} y2={H - g} className="grid" />
          ))}
        {pts.length > 1 && (
          <polygon
            className={crossing ? 'shape bad' : 'shape'}
            points={pts.map(([u, v]) => `${u},${H - v}`).join(' ')}
          />
        )}
        {pts.map(([u, v], i) => (
          <circle key={i} cx={u} cy={H - v} r={1.6} className="pt" />
        ))}
      </svg>
      <div className="run-ask-actions">
        <button
          type="button"
          className="btn ghost sm"
          disabled={!pts.length}
          onClick={() => {
            const next = pts.slice(0, -1);
            setText(profileText(next));
            commit(next);
          }}
        >
          {t('Remove last point')}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          disabled={!pts.length}
          onClick={() => {
            setText('');
            commit([]);
          }}
        >
          {t('Clear profile')}
        </button>
      </div>
      <p className={bad || crossing ? 'field-error' : 'hint'} id={`${id}-hint`}>
        {bad
          ? t('Type whole-mm points as across,up separated by ";". Not saved until it is.')
          : crossing
            ? t('The profile crosses itself or has fewer than three points.')
            : pts.length
              ? t('Profile {w} × {h} mm: the strip takes this size.', { w: b.w, h: b.h })
              : t('Optional: without a profile the trim is a plain strip.')}
      </p>
    </div>
  );
}

/** A crown's or pelmet's height and profile (ADR-209); the height can follow a variable. */
export function TrimEdit({ part }: { part: RunPart }) {
  const project = useDesign((s) => s.project);
  const setRunRequest = useDesign((s) => s.setRunRequest);
  const [open, setOpen] = useState(false);
  const req = project?.runRequests?.find((r) => requestKey(r) === part.key);
  if (!project || !req || (req.kind !== 'crown' && req.kind !== 'pelmet')) return null;
  const shaped = !!req.profile && profileValid(req.profile);
  const hint = requestBindingHint(project, req, 'height');
  return (
    <div className="run-edit">
      <button
        type="button"
        className="btn ghost sm"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {shaped
          ? t('Profile {w} × {h} mm', { w: part.box.d, h: part.box.h })
          : t('Height {h} mm, no profile', { h: part.box.h })}
      </button>
      {open && (
        <div className="run-ask">
          <MmField
            label={t('Trim height')}
            value={req.height ?? part.box.h}
            min={1}
            max={3000}
            onChange={(v) => setRunRequest({ ...req, height: v })}
            disabled={!!hint || shaped}
            hint={hint ?? (shaped ? t('The profile sets the height.') : undefined)}
            trailing={<RequestBindButton request={req} target="height" />}
          />
          <ProfileEditor
            value={req.profile}
            onChange={(profile) => {
              const { profile: _p, ...rest } = req;
              void _p;
              setRunRequest(profile ? { ...rest, profile } : rest);
            }}
          />
        </div>
      )}
    </div>
  );
}

/** _Add worktop over…_ and _Add trim…_, plus requests that could not be made (with why and a way out). */
export function AskRunParts() {
  const project = useDesign((s) => s.project)!;
  const diagnostics = useDesign((s) => s.projectModel?.diagnostics);
  const setRunRequest = useDesign((s) => s.setRunRequest);
  const removeRunRequest = useDesign((s) => s.removeRunRequest);
  const cand = useMemo(() => requestCandidates(project), [project]);
  const boards = useMemo(() => projectBoards(project), [project]);
  const [open, setOpen] = useState<'worktop' | 'trim' | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [front, setFront] = useState(WORKTOP_OVERHANG);
  const [side, setSide] = useState(0);
  const [kind, setKind] = useState<TrimKind>('crown');
  const [height, setHeight] = useState('');
  const [profile, setProfile] = useState<[Mm, Mm][] | undefined>(undefined);
  const [boardKey, setBoardKey] = useState('');
  const name = (id: string) => project.items.find((i) => i.id === id)?.design.name ?? id;
  const failed = (project.runRequests ?? []).flatMap((r) => {
    const d = diagnostics?.find((x) => x.nodeId === `request:${requestKey(r)}`);
    return d ? [{ key: requestKey(r), message: d.message }] : [];
  });

  const show = (which: 'worktop' | 'trim') => {
    setOpen(open === which ? null : which);
    setTicked(new Set());
  };
  const tick = (id: string, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(id);
    else next.delete(id);
    setTicked(next);
  };
  const rows = open === 'worktop' ? cand.runs : cand.trims;
  const choice = picked(rows, ticked);
  const h = Number(height);
  const heightOk = height.trim() !== '' && Number.isInteger(h) && h >= 1 && h <= 3000;
  // Until the user picks one: the front board of the first wall or tall unit, so the trim matches the doors.
  const firstUnit = project.items.find((i) => i.id === cand.trims[0]?.[0])?.design;
  const frontId = firstUnit && roleBoard(firstUnit, 'front');
  const front0 = firstUnit?.materials.find((m) => m.id === frontId);
  const board =
    boards.find((b) => materialKey(b) === (boardKey || (front0 && materialKey(front0)))) ??
    boards[0];
  const needsHeight = kind !== 'ceiling-filler';
  // A crown or pelmet with a profile takes its height from it (ADR-209).
  const pb = profile ? profileBounds(profile) : null;
  const shaped = needsHeight && !!pb && pb.w > 0 && pb.h > 0;
  const ready =
    choice.adjacent && (open === 'worktop' || (!!board && (!needsHeight || heightOk || shaped)));
  const add = () => {
    if (!ready) return;
    if (open === 'worktop') setRunRequest({ kind: 'worktop', from: choice.ids, front, side });
    else
      setRunRequest({
        kind,
        from: choice.ids,
        ...(needsHeight && heightOk ? { height: h } : {}),
        ...(needsHeight && profile ? { profile } : {}),
        material: { ...board },
      });
    setOpen(null);
    setTicked(new Set());
    setHeight('');
    setProfile(undefined);
  };
  const pieceList = (groups: string[][]) => (
    <fieldset className="run-pick">
      <legend>{t('Pieces (side by side)')}</legend>
      {groups.flat().map((id) => (
        <Toggle
          key={id}
          label={name(id)}
          checked={ticked.has(id)}
          onChange={(on) => tick(id, on)}
        />
      ))}
    </fieldset>
  );

  return (
    <>
      {failed.map((f) => (
        <div key={f.key} className="run-failed" role="alert">
          <span>{f.message}</span>
          <button type="button" className="btn ghost sm" onClick={() => removeRunRequest(f.key)}>
            {t('Remove request')}
          </button>
        </div>
      ))}
      <div className="run-ask-actions">
        <button
          type="button"
          className="btn outline sm"
          aria-expanded={open === 'worktop'}
          onClick={() => show('worktop')}
        >
          <Icon name="plus" className="sm" />
          {t('Add worktop over…')}
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-expanded={open === 'trim'}
          onClick={() => show('trim')}
        >
          <Icon name="plus" className="sm" />
          {t('Add trim…')}
        </button>
      </div>
      {open === 'worktop' && (
        <div className="run-ask" aria-label={t('Add worktop over chosen pieces')} role="group">
          {cand.runs.length ? (
            <>
              {pieceList(cand.runs)}
              <MmField
                label={t('Front overhang')}
                value={front}
                min={0}
                max={1000}
                step={5}
                onChange={setFront}
              />
              <MmField
                label={t('Side overhang')}
                value={side}
                min={0}
                max={1000}
                step={5}
                onChange={setSide}
                hint={t('Past each end of the worktop')}
              />
              {ticked.size > 0 && !choice.adjacent && (
                <p className="field-error">{t('Tick base units next to each other in one run.')}</p>
              )}
              <button type="button" className="btn primary" disabled={!ready} onClick={add}>
                {t('Add worktop')}
              </button>
            </>
          ) : (
            <p className="hint">{t('No base units on the floor facing the room yet.')}</p>
          )}
        </div>
      )}
      {open === 'trim' && (
        <div className="run-ask" aria-label={t('Add a trim')} role="group">
          {cand.trims.length ? (
            <>
              <Segmented label={t('Trim')} value={kind} options={TRIMS} onChange={setKind} />
              {pieceList(cand.trims)}
              <Select
                label={t('Board')}
                value={board ? materialKey(board) : ''}
                options={boards.map((b) => ({
                  value: materialKey(b),
                  label: t('{name}, {thickness} mm', { name: b.name, thickness: b.thickness }),
                }))}
                onChange={setBoardKey}
              />
              {needsHeight ? (
                <>
                  {!shaped && <HeightField value={height} onChange={setHeight} valid={heightOk} />}
                  <ProfileEditor value={profile} onChange={setProfile} />
                </>
              ) : (
                <p className="hint">
                  {project.room
                    ? t('From the top of the units up to the room height ({height} mm).', {
                        height: project.room.height,
                      })
                    : t('Needs the room height: set the room first (Room).')}
                </p>
              )}
              {ticked.size > 0 && !choice.adjacent && (
                <p className="field-error">{t('Tick units next to each other.')}</p>
              )}
              <button type="button" className="btn primary" disabled={!ready} onClick={add}>
                {t('Add trim')}
              </button>
            </>
          ) : (
            <p className="hint">{t('No wall or tall units facing the room yet.')}</p>
          )}
        </div>
      )}
    </>
  );
}

/** The trim height: empty until the user types it (no default, ADR-075). */
function HeightField({
  value,
  onChange,
  valid,
}: {
  value: string;
  onChange: (v: string) => void;
  valid: boolean;
}) {
  const showErr = value.trim() !== '' && !valid;
  return (
    <div className="field">
      <label htmlFor="trim-height">{t('Trim height')}</label>
      <div className={`mm ${showErr ? 'invalid' : ''}`}>
        <input
          id="trim-height"
          inputMode="numeric"
          value={value}
          placeholder={t('mm')}
          aria-invalid={showErr}
          aria-describedby="trim-height-hint"
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        />
        <span className="unit">{t('mm')}</span>
      </div>
      <p className={showErr ? 'field-error' : 'hint'} id="trim-height-hint">
        {showErr ? t('Whole number from 1 to 3000.') : t('Enter the height; there is no default.')}
      </p>
    </div>
  );
}

/** A whole-mm size the user types, empty until then (no default, ADR-010). */
function TypedMm({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  const id = useId();
  const showErr = value.trim() !== '' && typed(value) === null;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`mm ${showErr ? 'invalid' : ''}`}>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          placeholder={t('mm')}
          aria-invalid={showErr}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        />
        <span className="unit">{t('mm')}</span>
      </div>
      <p className={showErr ? 'field-error' : 'hint'} id={`${id}-hint`}>
        {showErr ? t('Whole number from 1 to 3000.') : hint}
      </p>
    </div>
  );
}

/**
 * Where a sink or hob cut-out is (ADR-209): **From left** (the base's left edge to the cut-out) and **From front** (the
 * worktop's front edge to it), whole mm; empty = centred on that axis.
 */
function CutoutPlace({ cut, onChange }: { cut: RunSink; onChange: (c: RunSink) => void }) {
  const set = (axis: 'x' | 'z', v: Mm | undefined) => {
    const { [axis]: _gone, ...rest } = cut;
    void _gone;
    onChange(v === undefined ? rest : { ...rest, [axis]: v });
  };
  return (
    <div className="dims2 cutout-place">
      <OffsetMm label={t('From left')} value={cut.x} onChange={(v) => set('x', v)} />
      <OffsetMm label={t('From front')} value={cut.z} onChange={(v) => set('z', v)} />
    </div>
  );
}

/** A whole-mm offset from 0 to 3000, empty = centred (ADR-209); typed text that is not one is not saved. */
function OffsetMm({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Mm | undefined;
  onChange: (v: Mm | undefined) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value === undefined ? '' : String(value));
  }
  const n = Number(text);
  const ok = text.trim() === '' || (Number.isInteger(n) && n >= 0 && n <= 3000);
  const commit = () => {
    if (!ok) return;
    const next = text.trim() === '' ? undefined : n;
    if (next !== value) onChange(next);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`mm ${ok ? '' : 'invalid'}`}>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          placeholder={t('centred')}
          aria-invalid={!ok}
          aria-describedby={`${id}-hint`}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="unit">{t('mm')}</span>
      </div>
      <p className={ok ? 'hint' : 'field-error'} id={`${id}-hint`}>
        {ok ? t('Empty = centred.') : t('Whole number from 0 to 3000.')}
      </p>
    </div>
  );
}

/** The typed whole mm from 1 to 3000, or null. */
const typed = (v: string): number | null => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 3000 ? n : null;
};

const HANDLE_KINDS: { value: Handle['kind']; label: string }[] = [
  { value: 'bar', label: t('Bar') },
  { value: 'knob', label: t('Knob') },
  { value: 'push', label: t('Push to open') },
];

const handleText = (h: RunHandle['handle']) =>
  h.kind === 'bar'
    ? t('Bar, {n} mm centres', { n: h.holeSpacing ?? 128 })
    : h.kind === 'knob'
      ? t('Knob')
      : t('Push to open');

/**
 * Handles for a run and sinks over base units (ADR-125): one handle on every front of a run, on a line at a height
 * the user enters or at the top of the fronts; a sink's worktop cut-out, sized by the user. The core applies them.
 */
export function RunHandlesAndSinks() {
  const project = useDesign((s) => s.project)!;
  const setRunHandle = useDesign((s) => s.setRunHandle);
  const removeRunHandle = useDesign((s) => s.removeRunHandle);
  const setSink = useDesign((s) => s.setSink);
  const removeSink = useDesign((s) => s.removeSink);
  const setHob = useDesign((s) => s.setHob);
  const removeHob = useDesign((s) => s.removeHob);
  const runs = useMemo(() => requestCandidates(project).runs, [project]);
  const [open, setOpen] = useState<'handles' | 'sink' | 'hob' | null>(null);
  const [runIdx, setRunIdx] = useState('0');
  const [kind, setKind] = useState<Handle['kind']>('bar');
  const [spacing, setSpacing] = useState('128');
  const [line, setLine] = useState<'height' | 'top'>('height');
  const [height, setHeight] = useState('');
  const [baseId, setBaseId] = useState('');
  const [w, setW] = useState('');
  const [d, setD] = useState('');
  const name = (id: string) => project.items.find((i) => i.id === id)?.design.name ?? id;
  const run = runs[Number(runIdx)] ?? runs[0];
  // Push to open has no handle to line up.
  const byHeight = kind !== 'push' && line === 'height';
  const lineH = typed(height);
  const handlesReady = !!run && (!byHeight || lineH !== null);
  const bases = runs.flat();
  const base = bases.includes(baseId) ? baseId : bases[0];
  const sinkW = typed(w),
    sinkD = typed(d);
  const addHandles = () => {
    if (!handlesReady) return;
    setRunHandle({
      id: newId(),
      from: run,
      handle: kind === 'bar' ? { kind, holeSpacing: Number(spacing) } : { kind },
      ...(byHeight ? { height: lineH! } : {}),
    });
    setOpen(null);
    setHeight('');
  };
  const addSink = () => {
    if (!base || sinkW === null || sinkD === null) return;
    setSink({ id: newId(), baseId: base, w: sinkW, d: sinkD });
    setOpen(null);
    setW('');
    setD('');
  };
  // A hob works like a sink (ADR-205): over a chosen base, its cut-out size typed by the user.
  const addHob = () => {
    if (!base || sinkW === null || sinkD === null) return;
    setHob({ id: newId(), baseId: base, w: sinkW, d: sinkD });
    setOpen(null);
    setW('');
    setD('');
  };
  const toggleOwn = (rh: RunHandle, id: string, own: boolean) => {
    const rest = (rh.own ?? []).filter((x) => x !== id);
    const next = own ? [...rest, id] : rest;
    setRunHandle({ ...rh, own: next.length ? next : undefined });
  };
  const handles = project.runHandles ?? [];
  const sinks = project.sinks ?? [];
  const hobs = project.hobs ?? [];
  return (
    <>
      {(handles.length > 0 || sinks.length > 0 || hobs.length > 0) && (
        <ul className="run-list">
          {handles.map((rh) => {
            const members = runHandleMembers(project, rh);
            const names = members.map(name).join(' + ');
            return (
              <li key={rh.id}>
                <span>
                  <strong>{t('Handles for this run')}</strong>{' '}
                  <span className="sub">
                    {handleText(rh.handle)} ·{' '}
                    {rh.height === undefined
                      ? t('top of fronts')
                      : t('line {n} mm above the floor', { n: rh.height })}{' '}
                    · {names || t('no run now')}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn icon ghost sm"
                  aria-label={t('Remove handles for the run of {names}', { names })}
                  onClick={() => removeRunHandle(rh.id)}
                >
                  <Icon name="trash" />
                </button>
                {members.length > 0 && (
                  <fieldset className="run-pick">
                    <legend>{t('Keeps its own handles')}</legend>
                    {members.map((id) => (
                      <Toggle
                        key={id}
                        label={name(id)}
                        checked={!!rh.own?.includes(id)}
                        onChange={(on) => toggleOwn(rh, id, on)}
                      />
                    ))}
                  </fieldset>
                )}
              </li>
            );
          })}
          {sinks.map((sk) => (
            <li key={sk.id}>
              <span>
                <strong>{t('Sink over {name}', { name: name(sk.baseId) })}</strong>{' '}
                <span className="num">{t('cut-out {w} × {d}', { w: sk.w, d: sk.d })}</span>
              </span>
              <button
                type="button"
                className="btn icon ghost sm"
                aria-label={t('Remove the sink over {name}', { name: name(sk.baseId) })}
                onClick={() => removeSink(sk.id)}
              >
                <Icon name="trash" />
              </button>
              <CutoutPlace cut={sk} onChange={setSink} />
            </li>
          ))}
          {hobs.map((hb) => (
            <li key={hb.id}>
              <span>
                <strong>{t('Hob over {name}', { name: name(hb.baseId) })}</strong>{' '}
                <span className="num">{t('cut-out {w} × {d}', { w: hb.w, d: hb.d })}</span>
              </span>
              <button
                type="button"
                className="btn icon ghost sm"
                aria-label={t('Remove the hob over {name}', { name: name(hb.baseId) })}
                onClick={() => removeHob(hb.id)}
              >
                <Icon name="trash" />
              </button>
              <CutoutPlace cut={hb} onChange={setHob} />
            </li>
          ))}
        </ul>
      )}
      <div className="run-ask-actions">
        <button
          type="button"
          className="btn outline sm"
          aria-expanded={open === 'handles'}
          onClick={() => setOpen(open === 'handles' ? null : 'handles')}
        >
          <Icon name="plus" className="sm" />
          {t('Handles for this run…')}
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-expanded={open === 'sink'}
          onClick={() => setOpen(open === 'sink' ? null : 'sink')}
        >
          <Icon name="plus" className="sm" />
          {t('Add sink…')}
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-expanded={open === 'hob'}
          onClick={() => setOpen(open === 'hob' ? null : 'hob')}
        >
          <Icon name="plus" className="sm" />
          {t('Add hob…')}
        </button>
      </div>
      {open === 'handles' && (
        <div className="run-ask" aria-label={t('Handles for this run')} role="group">
          {run ? (
            <>
              {runs.length > 1 ? (
                <Select
                  label={t('Run')}
                  value={String(runs.indexOf(run))}
                  options={runs.map((r, i) => ({
                    value: String(i),
                    label: r.map(name).join(' + '),
                  }))}
                  onChange={setRunIdx}
                />
              ) : (
                <p className="hint">{t('Run: {names}', { names: run.map(name).join(' + ') })}</p>
              )}
              <Segmented
                label={t('Handle')}
                value={kind}
                options={HANDLE_KINDS}
                onChange={setKind}
              />
              {kind === 'bar' && (
                <Select
                  label={t('Hole centres')}
                  value={spacing}
                  options={BAR_SPACINGS.map((v) => ({
                    value: String(v),
                    label: t('{n} mm', { n: v }),
                  }))}
                  onChange={setSpacing}
                />
              )}
              {kind !== 'push' && (
                <Segmented<'height' | 'top'>
                  label={t('Handle line')}
                  value={line}
                  options={[
                    { value: 'height', label: t('Height') },
                    { value: 'top', label: t('Top of fronts') },
                  ]}
                  onChange={setLine}
                />
              )}
              {byHeight && (
                <TypedMm
                  label={t('Line height above the floor')}
                  value={height}
                  onChange={setHeight}
                  hint={t(
                    'Enter the height; there is no default. A front the line does not cross gets the handle near its top.',
                  )}
                />
              )}
              <button
                type="button"
                className="btn primary"
                disabled={!handlesReady}
                onClick={addHandles}
              >
                {t('Add handles')}
              </button>
            </>
          ) : (
            <p className="hint">{t('No base units on the floor facing the room yet.')}</p>
          )}
        </div>
      )}
      {open === 'sink' && (
        <div className="run-ask" aria-label={t('Sink over a base unit')} role="group">
          {base ? (
            <>
              <Select
                label={t('Sink over')}
                value={base}
                options={bases.map((id) => ({ value: id, label: name(id) }))}
                onChange={setBaseId}
              />
              <TypedMm
                label={t('Cut-out width')}
                value={w}
                onChange={setW}
                hint={t("From the sink's installation drawing; there is no default.")}
              />
              <TypedMm
                label={t('Cut-out depth')}
                value={d}
                onChange={setD}
                hint={t("From the sink's installation drawing; there is no default.")}
              />
              <button
                type="button"
                className="btn primary"
                disabled={sinkW === null || sinkD === null}
                onClick={addSink}
              >
                {t('Add sink')}
              </button>
            </>
          ) : (
            <p className="hint">{t('No base units on the floor facing the room yet.')}</p>
          )}
        </div>
      )}
      {open === 'hob' && (
        <div className="run-ask" aria-label={t('Hob over a base unit')} role="group">
          {base ? (
            <>
              <Select
                label={t('Hob over')}
                value={base}
                options={bases.map((id) => ({ value: id, label: name(id) }))}
                onChange={setBaseId}
              />
              <TypedMm
                label={t('Cut-out width')}
                value={w}
                onChange={setW}
                hint={t("From the hob's installation drawing; there is no default.")}
              />
              <TypedMm
                label={t('Cut-out depth')}
                value={d}
                onChange={setD}
                hint={t("From the hob's installation drawing; there is no default.")}
              />
              <button
                type="button"
                className="btn primary"
                disabled={sinkW === null || sinkD === null}
                onClick={addHob}
              >
                {t('Add hob')}
              </button>
            </>
          ) : (
            <p className="hint">{t('No base units on the floor facing the room yet.')}</p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Worktop corners (ADR-205): where two worktops meet at right angles the user chooses a mitred or a butt joint, and for
 * a butt joint the worktop that runs through. There is no default: until one is chosen the corner is an error and
 * export is blocked. The cut shapes come from the core (`worktopJointCuts`).
 */
export function WorktopCorners() {
  const project = useDesign((s) => s.project)!;
  const setJoint = useDesign((s) => s.setWorktopJoint);
  const corners = useMemo(() => worktopCorners(project), [project]);
  if (!corners.length) return null;
  return (
    <ul className="run-list worktop-corners">
      {corners.map((c) => {
        const ka = runPartKey(c.a),
          kb = runPartKey(c.b);
        const j = c.joint;
        const names = { a: runPartNames(project, c.a), b: runPartNames(project, c.b) };
        // The worktop that runs through, as this corner's a or b.
        const through = j?.through ? ((j.through === 'a' ? j.a : j.b) === ka ? 'a' : 'b') : '';
        const save = (kind: 'mitre' | 'butt', thr?: 'a' | 'b') =>
          setJoint({
            id: j?.id ?? newId(),
            a: ka,
            b: kb,
            kind,
            ...(kind === 'butt' && thr ? { through: thr } : {}),
          });
        return (
          <li key={`${ka}|${kb}`} className="worktop-corner">
            <span>
              <strong>{t('Worktop corner')}</strong>{' '}
              <span className="sub">
                {names.a} · {names.b}
              </span>
            </span>
            <div className="run-pick" role="group" aria-label={t('Worktop corner')}>
              <button
                type="button"
                className="btn sm outline"
                aria-pressed={j?.kind === 'mitre'}
                onClick={() => save('mitre')}
              >
                {t('Mitred joint')}
              </button>
              <button
                type="button"
                className="btn sm outline"
                aria-pressed={j?.kind === 'butt'}
                onClick={() => save('butt', through || undefined)}
              >
                {t('Butt joint')}
              </button>
            </div>
            {j?.kind === 'butt' && (
              <fieldset className="run-pick">
                <legend>{t('Runs through')}</legend>
                {(['a', 'b'] as const).map((k) => (
                  <label key={k} className="radio">
                    <input
                      type="radio"
                      name={`through-${ka}|${kb}`}
                      checked={through === k}
                      onChange={() => save('butt', k)}
                    />
                    <span>{names[k]}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {(!j || (j.kind === 'butt' && !through)) && (
              <p className="hint warn">
                {t('Joint not chosen yet: export is blocked until you choose one.')}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * On the plan (ADR-205): each sink and hob cut-out dashed on its worktop with its size, and the joint line of each
 * worktop corner. Positions come from the core (`cutoutOutlines`, `worktopJointLines`).
 */
export function PlanKitchenMarks({
  project,
  pieces,
  fs,
}: {
  project: Project;
  pieces: PlacedPiece[];
  fs: number;
}) {
  const cuts = useMemo(() => cutoutOutlines(project, pieces), [project, pieces]);
  const joints = useMemo(() => worktopJointLines(project), [project]);
  if (!cuts.length && !joints.length) return null;
  return (
    <g className="kitchen-marks" aria-hidden="true">
      {cuts.map((c) => (
        <g key={c.id} className={`cutout ${c.kind}`}>
          <rect x={c.box.x} y={c.box.z} width={c.box.w} height={c.box.d} />
          <text
            x={c.box.x + c.box.w / 2}
            y={c.box.z + c.box.d / 2}
            fontSize={Math.min(fs * 0.8, c.box.w / 5)}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {t('{w} × {d} mm', { w: c.w, d: c.d })}
          </text>
        </g>
      ))}
      {joints.map((j) => (
        <line
          key={j.id}
          className={`worktop-joint ${j.kind}`}
          x1={j.line[0]}
          y1={j.line[1]}
          x2={j.line[2]}
          y2={j.line[3]}
        />
      ))}
    </g>
  );
}
