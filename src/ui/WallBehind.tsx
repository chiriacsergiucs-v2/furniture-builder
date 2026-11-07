import { useId, useMemo } from 'react';
import { t } from '../core/i18n';
import { placeItem } from '../core/project';
import type { WallFinish } from '../core/room';
import { wallBehind } from '../core/roomSurfaces';
import { pictureRect } from '../core/wallPicture';
import type { Box } from '../core/types';
import { useDesign } from '../store/designStore';
import { pictureKey, useWallPictureUrls } from '../store/wallPictures';

const NONE: WallFinish[] = [];

/**
 * The wall behind a single piece opened from a project with a room (ADR-208, G-275): in the piece's own front view,
 * the background of the wall its back stands against (ADR-145 item 5's rule), floor to room height, the picture placed
 * by the piece's position along that wall. `b` is the piece's own bounds in the drawing. Nothing otherwise.
 */
export function WallBehind({ b }: { b: Box }) {
  const project = useDesign((s) => s.project);
  const editing = useDesign((s) => s.editingItemId);
  const design = useDesign((s) => s.design);
  const room = project?.room;
  const urls = useWallPictureUrls(room?.walls ?? NONE);
  const clip = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-behind`;
  const wb = useMemo(() => {
    const item = editing ? project?.items.find((i) => i.id === editing) : undefined;
    // Placed as it is being edited: its size may have changed since the project was built.
    return project && item ? wallBehind(project, placeItem({ ...item, design })) : null;
  }, [project, editing, design]);
  if (!room || !wb) return null;
  const x0 = b.x - wb.u0;
  const img = wb.finish.image;
  const url = img ? urls.get(pictureKey(img)) : undefined;
  const r = img ? pictureRect(room, wb.wall, img) : null;
  return (
    <g
      className="wall-behind"
      role="img"
      aria-label={t('Wall {n} behind the piece', { n: wb.wall + 1 })}
    >
      <defs>
        <clipPath id={clip}>
          <rect x={x0} y={-(wb.floorY + wb.height)} width={wb.len} height={wb.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect
          x={x0}
          y={-(wb.floorY + wb.height)}
          width={wb.len}
          height={wb.height}
          style={{ fill: wb.finish.colour }}
        />
        {r && url && url !== 'missing' && (
          <image
            className="wall-picture"
            href={url}
            x={x0 + r.x}
            y={-(wb.floorY + r.y + r.h)}
            width={r.w}
            height={r.h}
            preserveAspectRatio="none"
          />
        )}
      </g>
    </g>
  );
}
