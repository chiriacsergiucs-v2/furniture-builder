import { useState } from 'react';
import { FUNCTION_LABEL, FUNCTIONS, ROOM_LABEL, ROOMS } from '../core/catalog';
import type { FunctionGroup, Room } from '../core/catalog/types';
import type { ProjectItem } from '../core/project';
import { saveItemToCatalog } from '../store/saveToCatalog';
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
        <SaveForm
          item={item}
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

function SaveForm({
  item,
  onCancel,
  onSaved,
}: {
  item: ProjectItem;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const families = useCatalog();
  const from = families.find((f) => f.id === item.design.catalog?.origin?.catalogId);
  const [name, setName] = useState(item.design.name);
  const [room, setRoom] = useState<Room>(from?.rooms[0] ?? 'other');
  const [fn, setFn] = useState<FunctionGroup>(from?.function ?? 'storage');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const res = await saveItemToCatalog(item.id, { name, room, function: fn });
    setBusy(false);
    if ('error' in res) setError(res.error);
    else onSaved();
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
        {t(
          'A new template on this device, in Catalog › Templates and in Add a piece. This piece stays linked to it.',
        )}
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
