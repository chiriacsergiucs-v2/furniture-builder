import { useState } from 'react';
import { setWallFinish, wallFinish, type Room } from '../core/room';
import { MAX_TILE } from '../core/surface';
import { importImage, useImageUrls } from '../persist/images';
import { MmField, Select } from './controls';
import { Icon } from './icons';

/** Starting paint colour for a wall: the grey the 3D view shows walls in. */
const WALL_GREY = '#c9cdc8';

/**
 * A wall's background (ADR-126): none, a colour, or a picture from this device that repeats, one copy covering a
 * width × height the user sets. The picture is kept on this device like board pictures (ADR-048).
 */
export function WallBackground({
  room,
  wall,
  setRoom,
}: {
  room: Room;
  wall: number;
  setRoom: (r: Room) => void;
}) {
  const f = wallFinish(room, wall);
  const img = f?.image;
  const urls = useImageUrls(img?.id ?? '');
  const url = img ? urls.get(img.id) : undefined;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Picture chosen but none added yet: the wall keeps what it had until a picture arrives.
  const [wantPicture, setWantPicture] = useState(false);
  const name = `Wall ${wall + 1}`;
  const kind = img || wantPicture ? 'picture' : f ? 'colour' : 'none';
  const set = (next: Parameters<typeof setWallFinish>[2]) =>
    setRoom(setWallFinish(room, wall, next));
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const r = await importImage(file);
    setBusy(false);
    if (!r.ok) {
      setProblem(`${r.problem} ${name} keeps its current background.`);
      return;
    }
    // One copy starts 1000 mm wide with the picture's proportions (G-214), as a board picture starts along its length.
    const { id, name: fileName, tileLength, tileWidth } = r.image;
    set({
      colour: r.color,
      image: { id, name: fileName, tileWidth: tileLength, tileHeight: tileWidth },
    });
  };
  return (
    <div className="wall-bg">
      <Select
        label={`${name} background`}
        value={kind}
        options={[
          { value: 'none', label: 'None' },
          { value: 'colour', label: 'Colour' },
          { value: 'picture', label: 'Picture' },
        ]}
        onChange={(v) => {
          setProblem(null);
          setWantPicture(v === 'picture');
          if (v === 'none') set(undefined);
          else if (v === 'colour') set({ colour: f?.colour ?? WALL_GREY });
        }}
      />
      {kind === 'colour' && (
        <label className="wall-colour">
          <span>Colour</span>
          <input
            type="color"
            aria-label={`${name} colour`}
            value={f!.colour}
            onChange={(e) => set({ colour: e.target.value })}
          />
        </label>
      )}
      {kind === 'picture' && (
        <div className="mat-picture-row">
          {img && url && url !== 'missing' && (
            <img className="mat-thumb" src={url} alt={`Picture on ${name}`} />
          )}
          <label className={`btn sm outline file-btn${busy ? ' disabled' : ''}`}>
            <Icon name="upload" className="sm" />
            {busy ? 'Preparing picture…' : img ? 'Replace picture' : 'Add a picture'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              aria-label={`${img ? 'Replace' : 'Add a'} picture for ${name}`}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {img && <span className="hint">{img.name}</span>}
        </div>
      )}
      {img && url === 'missing' && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>
            The picture {img.name} is not on this device. Its average colour is shown; add the
            picture again to see it.
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
            label="One picture covers, width"
            value={img.tileWidth}
            min={1}
            max={MAX_TILE}
            hint="Set the real size"
            onChange={(v) => set({ colour: f!.colour, image: { ...img, tileWidth: v } })}
          />
          <MmField
            label="One picture covers, height"
            value={img.tileHeight}
            min={1}
            max={MAX_TILE}
            onChange={(v) => set({ colour: f!.colour, image: { ...img, tileHeight: v } })}
          />
        </div>
      )}
    </div>
  );
}
