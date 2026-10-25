/**
 * Run parts the user asks for (ADR-075): a worktop over chosen adjacent base units, a worktop's overhangs, and
 * crown, pelmet and ceiling-filler trims over wall or tall units. Every size comes from the core plan
 * (`planRuns`); this only collects the choice. Trim heights have no default: the user enters them.
 */
import { useMemo, useState } from 'react';
import { projectBoards, roleBoard } from '../core/finish';
import {
  materialKey,
  requestCandidates,
  requestKey,
  WORKTOP_OVERHANG,
  type RunPart,
  type RunRequest,
  type TrimKind,
} from '../core/project';
import { useDesign } from '../store/designStore';
import { MmField, Segmented, Select, Toggle } from './controls';
import { Icon } from './icons';

const TRIMS: { value: TrimKind; label: string }[] = [
  { value: 'crown', label: 'Crown' },
  { value: 'pelmet', label: 'Pelmet' },
  { value: 'ceiling-filler', label: 'Ceiling filler' },
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
  const requests = useDesign((s) => s.project?.runRequests);
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
  return (
    <div className="run-edit">
      <button
        type="button"
        className="btn ghost sm"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Overhang: {front} mm front, {side} mm sides
      </button>
      {open && (
        <div className="run-ask">
          <MmField
            label="Front overhang"
            value={front}
            min={0}
            max={1000}
            step={5}
            onChange={(v) => set({ front: v })}
          />
          <MmField
            label="Side overhang"
            value={side}
            min={0}
            max={1000}
            step={5}
            onChange={(v) => set({ side: v })}
            hint="Past each end of the worktop"
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
  const ready = choice.adjacent && (open === 'worktop' || (!!board && (!needsHeight || heightOk)));
  const add = () => {
    if (!ready) return;
    if (open === 'worktop') setRunRequest({ kind: 'worktop', from: choice.ids, front, side });
    else
      setRunRequest({
        kind,
        from: choice.ids,
        ...(needsHeight ? { height: h } : {}),
        material: { ...board },
      });
    setOpen(null);
    setTicked(new Set());
    setHeight('');
  };
  const pieceList = (groups: string[][]) => (
    <fieldset className="run-pick">
      <legend>Pieces (side by side)</legend>
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
            Remove request
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
          Add worktop over…
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-expanded={open === 'trim'}
          onClick={() => show('trim')}
        >
          <Icon name="plus" className="sm" />
          Add trim…
        </button>
      </div>
      {open === 'worktop' && (
        <div className="run-ask" aria-label="Add worktop over chosen pieces" role="group">
          {cand.runs.length ? (
            <>
              {pieceList(cand.runs)}
              <MmField
                label="Front overhang"
                value={front}
                min={0}
                max={1000}
                step={5}
                onChange={setFront}
              />
              <MmField
                label="Side overhang"
                value={side}
                min={0}
                max={1000}
                step={5}
                onChange={setSide}
                hint="Past each end of the worktop"
              />
              {ticked.size > 0 && !choice.adjacent && (
                <p className="field-error">Tick base units next to each other in one run.</p>
              )}
              <button type="button" className="btn primary" disabled={!ready} onClick={add}>
                Add worktop
              </button>
            </>
          ) : (
            <p className="hint">No base units on the floor facing the room yet.</p>
          )}
        </div>
      )}
      {open === 'trim' && (
        <div className="run-ask" aria-label="Add a trim" role="group">
          {cand.trims.length ? (
            <>
              <Segmented label="Trim" value={kind} options={TRIMS} onChange={setKind} />
              {pieceList(cand.trims)}
              <Select
                label="Board"
                value={board ? materialKey(board) : ''}
                options={boards.map((b) => ({
                  value: materialKey(b),
                  label: `${b.name}, ${b.thickness} mm`,
                }))}
                onChange={setBoardKey}
              />
              {needsHeight ? (
                <HeightField value={height} onChange={setHeight} valid={heightOk} />
              ) : (
                <p className="hint">
                  {project.room
                    ? `From the top of the units up to the room height (${project.room.height} mm).`
                    : 'Needs the room height: set the room first (Room).'}
                </p>
              )}
              {ticked.size > 0 && !choice.adjacent && (
                <p className="field-error">Tick units next to each other.</p>
              )}
              <button type="button" className="btn primary" disabled={!ready} onClick={add}>
                Add trim
              </button>
            </>
          ) : (
            <p className="hint">No wall or tall units facing the room yet.</p>
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
      <label htmlFor="trim-height">Trim height</label>
      <div className={`mm ${showErr ? 'invalid' : ''}`}>
        <input
          id="trim-height"
          inputMode="numeric"
          value={value}
          placeholder="mm"
          aria-invalid={showErr}
          aria-describedby="trim-height-hint"
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        />
        <span className="unit">mm</span>
      </div>
      <p className={showErr ? 'field-error' : 'hint'} id="trim-height-hint">
        {showErr ? 'Whole number from 1 to 3000.' : 'Enter the height; there is no default.'}
      </p>
    </div>
  );
}
