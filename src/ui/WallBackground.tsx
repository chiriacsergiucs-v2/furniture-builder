import { useState } from 'react';
import { setWallFinish, wallFinish, type Room } from '../core/room';
import { pictureRect, rectLabel } from '../core/wallPicture';
import { importImage, useImageUrls } from '../persist/images';
import { Select } from './controls';
import { Icon } from './icons';
import { StraightenPhoto } from './StraightenPhoto';

/** Starting paint colour for a wall: the grey the 3D view shows walls in. */
const WALL_GREY = '#c9cdc8';

/**
 * A wall's background (ADR-145): none, a colour, or a picture from this device, kept like board pictures (ADR-048).
 * A picture covers one rectangle of the wall once (ADR-146): the whole wall to start, moved and stretched in 3D with
 * Adjust wall picture, and straightened here when the photo was taken at an angle.
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
  const [straightening, setStraightening] = useState(false);
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
    // A new picture covers the whole wall (ADR-146, G-284).
    set({ colour: r.color, image: { id: r.image.id, name: r.image.name } });
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
        <div className="wall-picture-fit">
          <p className="hint" role="status">
            Covers: {rectLabel(pictureRect(room, wall, img))}
            {img.straighten ? ' · straightened' : ''}
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="btn sm outline"
              disabled={!img.fit}
              title="Make the picture cover the whole wall"
              onClick={() => {
                const { fit: _f, ...rest } = img;
                void _f;
                set({ colour: f!.colour, image: rest });
              }}
            >
              Fill wall
            </button>
            <button
              type="button"
              className="btn sm outline"
              disabled={!url || url === 'missing'}
              aria-label={`Straighten photo on ${name}`}
              onClick={() => setStraightening(true)}
            >
              Straighten photo
            </button>
          </div>
          <p className="hint">Move and stretch it on the wall in 3D with Adjust wall picture.</p>
        </div>
      )}
      {straightening && img && url && url !== 'missing' && (
        <StraightenPhoto
          wallName={name}
          url={url}
          corners={img.straighten}
          onClose={() => setStraightening(false)}
          onApply={(c) => {
            setStraightening(false);
            const { straighten: _s, ...rest } = img;
            void _s;
            set({ colour: f!.colour, image: c ? { ...rest, straighten: c } : rest });
          }}
        />
      )}
    </div>
  );
}
