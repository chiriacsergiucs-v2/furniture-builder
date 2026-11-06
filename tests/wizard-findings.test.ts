// ADR-194: a card keeps only the answers its axes write (1); a reopened decor-board piece neither warns nor blocks (2).
import { afterEach, describe, expect, it } from 'vitest';
import { boardChoices } from '../src/core/boards';
import type { Decor } from '../src/core/materials';
import {
  check,
  createPiece,
  editedSinceWizard,
  fieldOptions,
  fieldProblems,
  reopenAnswers,
  resolve,
  withType,
} from '../src/core/wizard/engine';
import { CONSTRUCTION_TYPES } from '../src/core/wizard/registry';
import { setWizardBoards, STEPS } from '../src/core/wizard/steps';
import { generatorAt, suggestions } from '../src/core/wizard/suggest';

const decor: Decor = {
  id: 'd1',
  list: 'mine.csv',
  maker: 'egger',
  makerText: 'Egger',
  kind: 'pal',
  code: 'H1145',
  name: 'Bardolino oak',
  thickness: 18,
  color: '#a07850',
} as Decor;

const boardField = STEPS.flatMap((s) => s.fields).find((f) => f.id === 'board')!;

afterEach(() => setWizardBoards(null));

describe('ADR-194 (1): a card freezes only what its axes write', () => {
  it('Cabinet → card → Type → Wardrobe: name "Wardrobe", 1200 × 2100 × 600', () => {
    const cards = suggestions({ type: 'cabinet' }, 'type');
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards.slice(0, 6)) {
      const r = resolve(withType(card.answers, 'wardrobe'));
      expect([r.name, r.width, r.height, r.depth]).toEqual(['Wardrobe', 1200, 2100, 600]);
    }
  });

  it("a card's answers are the user's answers plus only its axes' keys, and it still builds without errors", () => {
    for (const t of CONSTRUCTION_TYPES)
      for (const g of t.generators) {
        const a = { type: t.id, name: 'Mine' };
        const writes = new Set([
          'type',
          'name',
          ...generatorAt(a, g.at)!.axes.flatMap((x) => x.writes),
        ]);
        for (const s of suggestions(a, g.at)) {
          expect(
            Object.keys(s.answers).filter((k) => !writes.has(k)),
            `${t.id}/${g.at}`,
          ).toEqual([]);
          expect(s.answers.name).toBe('Mine');
          expect(check(s.answers).errors).toBe(0);
          expect(s.notes).toHaveLength(s.warnings);
        }
      }
  });

  it('the user answers given before the card stay; a card on a later step keeps the earlier answers', () => {
    const a = { type: 'cabinet', width: 1000 };
    const [card] = suggestions(a, 'divisions');
    expect(card.answers.width).toBe(1000);
    expect(card.answers.height).toBeUndefined();
  });
});

describe('ADR-194 (2): reopening a decor-board piece', () => {
  const made = () => {
    setWizardBoards(boardChoices(null, null, [decor]));
    const res = createPiece({ type: 'cabinet', board: 'decor:d1' });
    if (!res.ok) throw new Error(res.problems.map((p) => p.message).join('; '));
    expect(res.design.wizard?.answers.board).toBe('decor:d1');
    return res.design;
  };

  it('before the decor list loads: no edited warning, no Board error', () => {
    const piece = made();
    // The wizard opens with the piece's own boards; the decor list is still loading.
    setWizardBoards(null, undefined, piece);
    const a = reopenAnswers(piece)!;
    expect(String(a.board)).not.toMatch(/^decor:/);
    // One entry more than the built-in boards: the piece's own board (no thin back board offered for every part).
    const labels = fieldOptions(boardField, a).map((o) => o.label);
    expect(labels).toContain('Egger H1145 Bardolino oak, 18 mm');
    expect(labels.some((l) => l.startsWith('HDF'))).toBe(false);
    expect(editedSinceWizard(piece, a)).toBe(false);
    expect(fieldProblems(a).filter((p) => p.field === 'board')).toEqual([]);
    expect(check(a).errors).toBe(0);
  });

  it('after the decor list loads, and after the decor is removed from the list', () => {
    const piece = made();
    // Opened before the decor list loads, then the list arrives: the answer stays valid, the board is listed once.
    setWizardBoards(null, undefined, piece);
    const early = reopenAnswers(piece)!;
    setWizardBoards(boardChoices(null, null, [decor]), undefined, piece);
    expect(check(early).errors).toBe(0);
    expect(editedSinceWizard(piece, early)).toBe(false);
    const labels = fieldOptions(boardField, early).map((o) => o.label);
    expect(labels.filter((l) => l.includes('Bardolino oak'))).toHaveLength(1);
    const a = reopenAnswers(piece)!;
    expect(editedSinceWizard(piece, a)).toBe(false);
    expect(check(a).errors).toBe(0);
    setWizardBoards(null, undefined, piece);
    const b = reopenAnswers(piece)!;
    expect(editedSinceWizard(piece, b)).toBe(false);
    expect(check(b).errors).toBe(0);
    // Updating the piece stores a plain string answer: the answer shape is unchanged (ADR-046).
    const again = createPiece(b, undefined, piece);
    if (!again.ok) throw new Error('not updated');
    expect(typeof again.design.wizard?.answers.board).toBe('string');
    expect(again.design.materials.map((m) => m.name)).toContain('Egger H1145 Bardolino oak');
  });

  it('an edit in the editor is still reported', () => {
    const piece = made();
    const edited = {
      ...piece,
      product: { ...piece.product, params: { ...piece.product.params, width: 950 } },
    } as typeof piece;
    setWizardBoards(null, undefined, edited);
    expect(editedSinceWizard(edited, reopenAnswers(edited))).toBe(true);
  });
});
