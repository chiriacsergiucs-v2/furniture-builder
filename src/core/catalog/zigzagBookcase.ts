import { newId, wrap } from '../design';
import type { Design, LoosePanel, PanelLie } from '../types';

/**
 * Five-tier open bookcase with alternating partial panels (room divider), as a panel set whose parts all have a
 * known place. Sizes are the user's script values, in mm: 600 wide, 240 deep, 320 clear height per tier, 16 mm
 * board, 180 mm narrow panels, the inset panel 120 mm from the right side. x width, y height from the floor, z
 * depth from the back, so the front is at z = DEPTH.
 */
const WIDTH = 600;
const DEPTH = 240;
const TIER = 320;
const T = 16;
const NARROW = 180;
const INSET = 120;
const TIERS = 5;

const part = (
  name: string,
  length: number,
  width: number,
  x: number,
  y: number,
  z: number,
  lie: PanelLie,
): LoosePanel => ({
  id: newId(),
  name,
  length,
  width,
  materialId: 'pal16',
  quantity: 1,
  place: { x, y, z, lie },
});

export function zigzagBookcase(): Design {
  const panels: LoosePanel[] = [];
  const pitch = TIER + T;
  for (let i = 0; i <= TIERS; i++) {
    const name = i === 0 ? 'Bottom panel' : i === TIERS ? 'Top panel' : `Shelf ${i}`;
    panels.push(part(name, WIDTH, DEPTH, 0, i * pitch, 0, 'flat-x'));
  }
  for (let tier = 0; tier < TIERS; tier++) {
    const y = tier * pitch + T;
    const n = tier + 1;
    if (tier % 2 === 0) {
      panels.push(part(`T${n} right side`, DEPTH, TIER, WIDTH - T, y, 0, 'edge-z'));
      panels.push(part(`T${n} back left`, NARROW, TIER, 0, y, 0, 'edge-x'));
      panels.push(part(`T${n} front left`, NARROW, TIER, 0, y, DEPTH - T, 'edge-x'));
    } else {
      panels.push(part(`T${n} left side`, DEPTH, TIER, 0, y, 0, 'edge-z'));
      panels.push(
        part(`T${n} inset front`, NARROW, TIER, WIDTH - INSET - NARROW, y, DEPTH - T, 'edge-x'),
      );
    }
  }
  return wrap('Zigzag bookcase', {
    kind: 'panels',
    id: newId(),
    params: {
      panels,
      note: 'Five tiers on six shelves. Odd tiers: right side, two 180 mm panels on the left (back and front). Even tiers: left side and one 180 mm front panel 120 mm from the right. No back panel. Edge banding and screws are not set.',
    },
  });
}
