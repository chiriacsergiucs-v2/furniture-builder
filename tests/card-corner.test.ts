// cardCorner (ADR-112): the quick-count card covers the selected part least first, then the other boxes.
import { describe, expect, it } from 'vitest';
import { cardCorner } from '../src/ui/CountStepper';

describe('cardCorner (ADR-112)', () => {
  it('never covers the selected part to save covering the view’s other boxes', () => {
    // A 390 × 306 front view: the selected bay sits under the top left corner; the toolbar fills the top right and
    // size labels fill both bottom corners. Summed overlaps pick the top left corner, on the bay; the selection must
    // rank first.
    const sel = { left: 52, top: 40, width: 120, height: 60 };
    const toolbar = { left: 234, top: 0, width: 156, height: 110 };
    const labels = { left: 0, top: 196, width: 390, height: 110 };
    const pos = cardCorner(390, 306, 150, 102, [sel, toolbar, labels]);
    const card = { ...pos, width: 150, height: 102 };
    const hits =
      card.left < sel.left + sel.width &&
      sel.left < card.left + card.width &&
      card.top < sel.top + sel.height &&
      sel.top < card.top + card.height;
    expect(hits).toBe(false);
  });

  it('with the selection clear of every corner, still covers least of the rest', () => {
    const sel = { left: 170, top: 120, width: 50, height: 50 };
    const toolbar = { left: 0, top: 0, width: 390, height: 44 };
    expect(cardCorner(390, 306, 150, 102, [sel, toolbar]).top).toBe(306 - 102 - 6);
  });
});
