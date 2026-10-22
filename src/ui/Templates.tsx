import type { ReactNode } from 'react'
import type { Template } from '../core/design'
import { Icon, type IconName } from './icons'

const GLYPH: Record<string, IconName> = {
  chest: 'chest', bookcase: 'bookcase', 'base-door': 'base-door', sideboard: 'sideboard', wardrobe: 'wardrobe',
  'wall-cabinet': 'wall-cabinet', 'corner-blind': 'corner-blind', 'corner-l': 'corner-l', 'desk-pedestal': 'desk-pedestal', 'desk-gables': 'desk-gables',
}

/** Glyph for a template id (or a product kind), falling back to a plain box. */
export function templateGlyph(id: string): IconName { return GLYPH[id] ?? (id === 'desk' ? 'desk-gables' : id === 'corner' ? 'corner-l' : 'box') }

/** A starting piece as a selectable row: glyph, name, one-line description. */
export function TemplateButton({ t, onPick, sub }: { t: Template; onPick: () => void; sub?: ReactNode }) {
  return (
    <button type="button" className="row-btn" onClick={onPick}>
      <span className="glyph"><Icon name={templateGlyph(t.id)} /></span>
      <span><strong>{t.name}</strong><span className="sub">{sub ?? t.description}</span></span>
      <Icon name="chevron-right" className="chev sm" />
    </button>
  )
}
