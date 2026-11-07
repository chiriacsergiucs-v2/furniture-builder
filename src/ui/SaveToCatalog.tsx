import { useState } from 'react';
import { FUNCTION_LABEL, FUNCTIONS, ROOM_LABEL, ROOMS } from '../core/catalog';
import type { FunctionGroup, Room } from '../core/catalog/types';
import type { LocalTemplate } from '../core/catalog/local';
import type { ProjectItem } from '../core/project';
import type { Design } from '../core/types';
import { saveItemToCatalog, type CatalogMetaInput, type SaveResult } from '../store/saveToCatalog';
import { useCatalog } from './Catalog';
import { Select } from './controls';
import { Dialog } from './Dialogs';
import { t, tr } from '../core/i18n';

/**
 * "Save to catalog" on the selected project piece (ADR-107): name, room and type, then a new template on this device
 * that the piece stays linked to. The confirmation links to the Catalog. Opened from More actions (ADR-160).
 */
export function SaveToCatalogDialog({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: ProjectItem;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t('Save to catalog')}>
      {open && (
        <CatalogSaveForm
          design={item.design}
          save={(meta) => saveItemToCatalog(item.id, meta)}
          linked
          onCancel={onClose}
          onSaved={() => {
            onClose();
            onSaved();
          }}
        />
      )}
    </Dialog>
  );
}

/** The confirmation under the selected piece's actions. */
export function SavedToCatalog() {
  return (
    <p className="hint saved-line" role="status">
      {t('Saved to the catalog.')} <a href="#catalog">{t('Open in Catalog')}</a>
    </p>
  );
}

/**
 * The Save to catalog form (ADR-107): name, room and type, defaulting to the catalog item the design came from. Shared
 * by a project piece's "Save to catalog" and the Catalog's "Save this piece as a template" (ADR-195).
 */
export function CatalogSaveForm({
  design,
  save: store,
  linked = false,
  onCancel,
  onSaved,
}: {
  design: Design;
  /** The piece stays linked to the new template (a project piece, ADR-107). */
  linked?: boolean;
  save: (meta: CatalogMetaInput) => Promise<SaveResult>;
  onCancel: () => void;
  onSaved: (t: LocalTemplate) => void;
}) {
  const families = useCatalog();
  const from = families.find((f) => f.id === design.catalog?.origin?.catalogId);
  const [name, setName] = useState(design.name);
  const [room, setRoom] = useState<Room>(from?.rooms[0] ?? 'other');
  const [fn, setFn] = useState<FunctionGroup>(from?.function ?? 'storage');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await store({ name, room, function: fn });
    setBusy(false);
    if ('error' in res) setError(res.error);
    else onSaved(res.template);
  };
  return (
    <form
      className="save-to-catalog"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && !busy) void save();
      }}
    >
      <p className="hint">
        {linked
          ? t(
              'A new template on this device, in Catalog › Templates and in Add a piece. This piece stays linked to it.',
            )
          : t('A new template on this device, in Catalog › Templates and in Add a piece.')}
      </p>
      <div className="field">
        <label htmlFor="stc-name">{t('Name')}</label>
        <input
          id="stc-name"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Select<Room>
        label={t('Room')}
        value={room}
        options={ROOMS.map((r) => ({ value: r, label: tr(ROOM_LABEL[r]) }))}
        onChange={setRoom}
      />
      <Select<FunctionGroup>
        label={t('Type')}
        value={fn}
        options={FUNCTIONS.map((f) => ({ value: f, label: tr(FUNCTION_LABEL[f]) }))}
        onChange={setFn}
      />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="split-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          {t('Cancel')}
        </button>
        <button type="submit" className="btn primary" disabled={!name.trim() || busy}>
          {t('Save')}
        </button>
      </div>
    </form>
  );
}
