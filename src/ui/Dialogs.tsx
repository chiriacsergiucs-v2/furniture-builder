import { useEffect, useRef, useState, type ReactNode } from 'react';
import { kerfOf, newId, sheetOf } from '../core/design';
import type { Material, MaterialKind, MaterialMaker } from '../core/types';
import {
  DECOR_COLUMNS,
  decorPatch,
  KINDS,
  MAKERS,
  parseDecorList,
  type Decor,
} from '../core/materials';
import { newProject } from '../core/project';
import { clearDecors, listDecors, replaceDecors, saveProject } from '../persist/db';
import { useDesign } from '../store/designStore';
import { Group, InfoTip, MmField, Segmented, Select, Toggle } from './controls';
import { Icon } from './icons';
import { BoardBand } from './BoardBand';
import { StartFrom } from './Catalog';
import { askConfirm } from './Confirm';
import { importImage, useImageUrls } from '../persist/images';
import { FINISHES, MAX_TILE } from '../core/surface';

/** Modal shell: header (title + close), scrolling body, optional footer for actions. Esc and backdrop close it. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  info,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** An `InfoTip` beside the title (ADR-112); Esc while it is open closes only the tip. */
  info?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'wide' : ''}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <header>
        {info ? (
          <div className="info-row">
            <h2>{title}</h2>
            {info}
          </div>
        ) : (
          <h2>{title}</h2>
        )}
        <button
          type="button"
          className="btn icon ghost sm close"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}

export function NewDialog({
  open,
  onClose,
  onBrowse,
  onWizard,
  onFillWall,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onBrowse?: () => void;
  onWizard?: () => void;
  onFillWall?: () => void;
  onOpened?: () => void;
}) {
  const load = useDesign((s) => s.load);
  const openProject = useDesign((s) => s.openProject);
  const opened = () => {
    onClose();
    onOpened?.();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start something new"
      info={
        <InfoTip label="About starting something new" align="start">
          What you have open now is already saved on this device.
        </InfoTip>
      }
    >
      {onWizard && (
        <button type="button" className="row-btn" onClick={onWizard}>
          <span className="glyph">
            <Icon name="plus" />
          </span>
          <span>
            <strong>New piece, step by step</strong>
            <span className="sub">
              Size, type, then only the questions that apply (dividers, shelves, drawers, doors,
              base), with suggested combinations. Saved to the Catalog.
            </span>
          </span>
          <Icon name="chevron-right" className="chev sm" />
        </button>
      )}
      <button
        type="button"
        className="row-btn"
        onClick={() => {
          const p = newProject();
          void saveProject(p);
          openProject(p);
          opened();
        }}
      >
        <span className="glyph">
          <Icon name="project" />
        </span>
        <span>
          <strong>Project with several pieces</strong>
          <span className="sub">
            A kitchen, a bedroom or a room: place pieces, then get one parts list and one set of
            sheets.
          </span>
        </span>
        <Icon name="chevron-right" className="chev sm" />
      </button>
      {onFillWall && (
        <button type="button" className="row-btn" onClick={onFillWall}>
          <span className="glyph">
            <Icon name="project" />
          </span>
          <span>
            <strong>Fill a wall</strong>
            <span className="sub">
              Enter a wall's width, depth and height; get suggested mixes of tall and base cabinets
              that fill it exactly, then refine them.
            </span>
          </span>
          <Icon name="chevron-right" className="chev sm" />
        </button>
      )}
      {open && (
        <StartFrom
          onPick={(d) => {
            load(d);
            opened();
          }}
          onBrowse={onBrowse}
        />
      )}
    </Dialog>
  );
}

/**
 * Every board in this piece, the saw cut and the user's decor list (ADR-049), shown inline under Configure
 * (ADR-079; it was the Materials dialog).
 */
export function MaterialsPanel() {
  const materials = useDesign((s) => s.design.materials);
  const kerf = useDesign((s) => kerfOf(s.design));
  const setKerf = useDesign((s) => s.setKerf);
  const update = useDesign((s) => s.updateMaterial);
  const add = useDesign((s) => s.addMaterial);
  const remove = useDesign((s) => s.removeMaterial);
  const [why, setWhy] = useState<{ id: string; text: string } | null>(null);
  // The user's decor list (ADR-049): the decor choice appears only once a list has been imported.
  const [decors, setDecors] = useState<Decor[]>([]);
  const [decorMsg, setDecorMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    listDecors()
      .then(setDecors)
      .catch(() => setDecors([]));
  }, []);
  const importDecors = async (f: File) => {
    let text: string;
    try {
      text = await f.text();
    } catch {
      setDecorMsg({ ok: false, text: `${f.name} could not be read.` });
      return;
    }
    const r = parseDecorList(text, f.name);
    if (!r.decors.length) {
      setDecorMsg({ ok: false, text: `No decors imported. ${r.problems.slice(0, 4).join(' ')}` });
      return;
    }
    try {
      await replaceDecors(r.decors);
    } catch {
      setDecorMsg({ ok: false, text: 'The decor list could not be saved on this device.' });
      return;
    }
    setDecors(r.decors);
    setDecorMsg({
      ok: r.problems.length === 0,
      text: `${r.decors.length} decor${r.decors.length === 1 ? '' : 's'} imported from ${f.name}.${r.problems.length ? ` ${r.problems.length} row${r.problems.length === 1 ? '' : 's'} skipped: ${r.problems.slice(0, 4).join(' ')}` : ''}`,
    });
  };
  const decorOptions = [
    { value: '', label: 'Not from the list' },
    ...decors.map((d) => ({
      value: d.id,
      label: `${d.makerText} ${d.code} ${d.name}, ${d.thickness} mm`,
    })),
  ];
  const decorOf = (m: Material) =>
    decors.find(
      (d) =>
        m.decor &&
        d.code === m.decor.code &&
        d.list === m.decor.list &&
        d.thickness === m.thickness,
    )?.id ?? '';
  return (
    <Group
      title="Boards, sheets and saw cut"
      id="g-boards"
      defaultOpen={false}
      info={
        <InfoTip label="About boards and sheets">
          Changing a thickness rebuilds every part made from that board. Colours and pictures only
          change how the board looks on screen.
        </InfoTip>
      }
    >
      <MmField
        label="Saw cut (kerf)"
        value={kerf}
        min={0}
        max={20}
        step={1}
        onChange={setKerf}
        info={
          <InfoTip label="About the saw cut" align="start">
            Material lost in every cut. Sheet length runs along the grain.
          </InfoTip>
        }
      />
      <div className="decor-list">
        <p className="hint">
          {decors.length
            ? `Decor list: ${decors[0].list}, ${decors.length} decor${decors.length === 1 ? '' : 's'}.`
            : 'Decor list: none.'}{' '}
          <InfoTip label="About the decor list" align="start">
            {decors.length
              ? 'Choose one on any board below.'
              : `Import your own CSV with the columns ${DECOR_COLUMNS} (whole mm, #rrggbb) to choose decors on the boards.`}
          </InfoTip>
        </p>
        <div className="mat-picture-row">
          <label className="btn sm outline file-btn">
            <Icon name="upload" className="sm" />
            Import decor list (CSV)
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              aria-label="Import decor list (CSV)"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importDecors(f);
                e.target.value = '';
              }}
            />
          </label>
          {decors.length > 0 && (
            <button
              type="button"
              className="btn sm ghost"
              onClick={async () => {
                if (
                  !(await askConfirm(
                    'Remove the decor list from this device? Boards keep their names, colours and labels.',
                    { confirmLabel: 'Remove list', danger: true },
                  ))
                )
                  return;
                await clearDecors();
                setDecors([]);
                setDecorMsg(null);
              }}
            >
              Remove decor list
            </button>
          )}
        </div>
        {decorMsg && (
          <p
            className={`alert ${decorMsg.ok ? 'info' : 'error'}`}
            role={decorMsg.ok ? 'status' : 'alert'}
          >
            <Icon name={decorMsg.ok ? 'info' : 'alert-circle'} className="sm" />
            <span>{decorMsg.text}</span>
          </p>
        )}
      </div>
      <ul className="materials">
        {materials.map((m: Material) => (
          <li key={m.id}>
            <input
              type="color"
              aria-label={`${m.name} colour`}
              value={m.color}
              onChange={(e) => update(m.id, { color: e.target.value })}
            />
            <input
              className="mat-name"
              aria-label="Name"
              defaultValue={m.name}
              key={m.name}
              onBlur={(e) => e.target.value.trim() && update(m.id, { name: e.target.value.trim() })}
            />
            <MmField
              label="Thickness"
              value={m.thickness}
              min={1}
              max={60}
              step={1}
              onChange={(v) => update(m.id, { thickness: v })}
            />
            <Toggle
              label="Has grain"
              checked={m.grain}
              onChange={(v) => update(m.id, { grain: v })}
            />
            <Segmented
              label="Finish"
              value={m.finish ?? 'matte'}
              options={FINISHES}
              onChange={(v) => update(m.id, { finish: v })}
            />
            <div className="sheet-fields">
              <Select
                label="Manufacturer"
                value={m.maker ?? ''}
                options={[{ value: '', label: 'Not set' }, ...MAKERS]}
                onChange={(v) =>
                  update(m.id, { maker: (v || undefined) as MaterialMaker | undefined })
                }
              />
              <Select
                label="Type"
                value={m.kind ?? ''}
                options={[{ value: '', label: 'Not set' }, ...KINDS]}
                onChange={(v) =>
                  update(m.id, { kind: (v || undefined) as MaterialKind | undefined })
                }
              />
              {decors.length > 0 && (
                <Select
                  label="Decor from your list"
                  value={decorOf(m)}
                  options={decorOptions}
                  onChange={(v) => {
                    const d = decors.find((x) => x.id === v);
                    update(m.id, d ? decorPatch(d) : { decor: undefined });
                  }}
                />
              )}
            </div>
            <div className="sheet-fields">
              <MmField
                label="Sheet length"
                value={sheetOf(m).length}
                min={300}
                max={6000}
                onChange={(v) => update(m.id, { sheet: { ...sheetOf(m), length: v } })}
              />
              <MmField
                label="Sheet width"
                value={sheetOf(m).width}
                min={300}
                max={3000}
                onChange={(v) => update(m.id, { sheet: { ...sheetOf(m), width: v } })}
              />
              <MmField
                label="Trim each edge"
                value={sheetOf(m).trim}
                min={0}
                max={50}
                step={1}
                onChange={(v) => update(m.id, { sheet: { ...sheetOf(m), trim: v } })}
              />
              <MmField
                label="Sheets in stock"
                unit=""
                value={sheetOf(m).count ?? 0}
                min={0}
                max={999}
                step={1}
                hint="0 = buy as needed"
                onChange={(v) =>
                  update(m.id, { sheet: { ...sheetOf(m), count: v === 0 ? null : v } })
                }
              />
            </div>
            <BoardBand key={`${m.id}-band`} m={m} />
            <MaterialPicture m={m} />
            <div className="mat-actions">
              <button
                type="button"
                className="btn sm outline"
                onClick={() => {
                  const r = remove(m.id);
                  setWhy(r ? { id: m.id, text: r } : null);
                }}
              >
                <Icon name="trash" className="sm" />
                Remove board
              </button>
              {why?.id === m.id && (
                <p className="alert error" role="alert">
                  <Icon name="alert-circle" className="sm" />
                  <span>{why.text}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn outline"
        onClick={() =>
          add({ id: newId(), name: 'New board', thickness: 18, grain: false, color: '#d8d4cc' })
        }
      >
        <Icon name="plus" />
        Add a material
      </button>
    </Group>
  );
}

/**
 * ADR-048: any picture from this device as the board's look. It is scaled down and kept on this device only; the
 * plain colour becomes the picture's average colour and is shown wherever the picture cannot be.
 */
function MaterialPicture({ m }: { m: Material }) {
  const update = useDesign((s) => s.updateMaterial);
  const urls = useImageUrls(m.image?.id ?? '');
  const url = m.image ? urls.get(m.image.id) : undefined;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const r = await importImage(file);
    setBusy(false);
    if (!r.ok) {
      setProblem(
        `${r.problem} The board keeps its ${m.image ? 'current picture' : 'plain colour'}.`,
      );
      return;
    }
    update(m.id, { color: r.color, image: { ...r.image, turn: m.image?.turn } });
  };
  const img = m.image;
  return (
    <div className="mat-picture">
      <div className="mat-picture-row">
        {img && url && url !== 'missing' && (
          <img className="mat-thumb" src={url} alt={`Picture of ${m.name}`} />
        )}
        <label className={`btn sm outline file-btn${busy ? ' disabled' : ''}`}>
          <Icon name="upload" className="sm" />
          {busy ? 'Preparing picture…' : img ? 'Replace picture' : 'Add a picture'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            aria-label={`${img ? 'Replace' : 'Add a'} picture for ${m.name}`}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {img && (
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => update(m.id, { image: undefined })}
          >
            Remove picture
          </button>
        )}
        {img && <span className="hint">{img.name}</span>}
      </div>
      {img && url === 'missing' && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>
            The picture {img.name} is not on this device. The plain colour is shown; add the picture
            again to see it.
          </span>
        </p>
      )}
      {problem && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{problem}</span>
        </p>
      )}
      {img && (
        <div className="sheet-fields">
          <MmField
            label="One picture covers, along the grain"
            value={img.tileLength}
            min={1}
            max={MAX_TILE}
            onChange={(v) => update(m.id, { image: { ...img, tileLength: v } })}
          />
          <MmField
            label="One picture covers, across"
            value={img.tileWidth}
            min={1}
            max={MAX_TILE}
            onChange={(v) => update(m.id, { image: { ...img, tileWidth: v } })}
          />
          <Toggle
            label="Turn picture 90°"
            checked={!!img.turn}
            onChange={(v) => update(m.id, { image: { ...img, turn: v } })}
          />
        </div>
      )}
    </div>
  );
}
