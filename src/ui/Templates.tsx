import type { ReactNode } from 'react';
import type { Template } from '../core/design';
import { Icon, type IconName } from './icons';

const GLYPH: Record<string, IconName> = {
  chest: 'chest',
  bookcase: 'bookcase',
  'base-door': 'base-door',
  sideboard: 'sideboard',
  wardrobe: 'wardrobe',
  'wall-cabinet': 'wall-cabinet',
  'corner-blind': 'corner-blind',
  'corner-l': 'corner-l',
  'desk-pedestal': 'desk-pedestal',
  'desk-gables': 'desk-gables',
};

/** Glyph for a template id (or a product kind), falling back to a plain box. */
export function templateGlyph(id: string): IconName {
  return (
    GLYPH[id] ??
    (id === 'desk'
      ? 'desk-gables'
      : id === 'corner'
        ? 'corner-l'
        : id === 'panel'
          ? 'panel'
          : id === 'frame'
            ? 'table'
            : 'box')
  );
}

/** Glyph for a catalog family: its legacy template glyph, else one by function and root. */
const FAMILY_GLYPH: Record<string, IconName> = {
  'base-doors': 'base-door',
  'base-drawers': 'chest',
  'sink-base': 'base-door',
  'appliance-base': 'base-door',
  'pullout-base': 'base-door',
  'integrated-front': 'panel',
  'wall-cabinet': 'wall-cabinet',
  'tall-cabinet': 'wardrobe',
  'blind-corner': 'corner-blind',
  'l-corner': 'corner-l',
  bookcase: 'bookcase',
  wardrobe: 'wardrobe',
  armoire: 'wardrobe',
  dresser: 'chest',
  chest: 'chest',
  sideboard: 'sideboard',
  credenza: 'sideboard',
  'media-console': 'sideboard',
  'filing-cabinet': 'chest',
  desk: 'desk-pedestal',
  nightstand: 'chest',
};
export function familyGlyph(f: { id: string; function: string; root: string }): IconName {
  return (
    FAMILY_GLYPH[f.id] ??
    (f.function === 'sleeping'
      ? 'bed'
      : f.function === 'seating'
        ? 'chair'
        : f.root === 'frame'
          ? 'table'
          : templateGlyph(f.root))
  );
}

/** A starting piece as a selectable row: glyph, name, one-line description. */
export function TemplateButton({
  t,
  onPick,
  sub,
}: {
  t: Template;
  onPick: () => void;
  sub?: ReactNode;
}) {
  return (
    <button type="button" className="row-btn" onClick={onPick}>
      <span className="glyph">
        <Icon name={templateGlyph(t.id)} />
      </span>
      <span>
        <strong>{t.name}</strong>
        <span className="sub">{sub ?? t.description}</span>
      </span>
      <Icon name="chevron-right" className="chev sm" />
    </button>
  );
}
