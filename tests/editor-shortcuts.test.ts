// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { editorShortcutAllowed } from '../src/ui/editorShortcuts';

function key(target: Element, options: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true, ...options });
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

describe('editor shortcut guard (ADR-198)', () => {
  it('guards every non-editor page and handled events', () => {
    const e = key(document.body);
    for (const page of ['projects', 'catalog', 'info', 'research', 'gaps']) {
      const outside = key(document.body);
      expect(editorShortcutAllowed(outside, page)).toBe(false);
      expect(outside.defaultPrevented).toBe(true);
    }
    expect(editorShortcutAllowed(e, 'editor')).toBe(true);
    e.preventDefault();
    expect(editorShortcutAllowed(e, 'editor')).toBe(false);
  });
  it('protects form fields, editable descendants, and every open modal', () => {
    for (const tag of ['input', 'textarea', 'select'])
      expect(editorShortcutAllowed(key(document.createElement(tag)), 'editor')).toBe(false);
    const text = document.createElement('div');
    text.contentEditable = 'true';
    text.setAttribute('contenteditable', 'true');
    text.innerHTML = '<span>Editing</span>';
    expect(editorShortcutAllowed(key(text.firstElementChild!), 'editor')).toBe(false);
    const d = document.createElement('dialog');
    d.open = true;
    document.body.append(d);
    expect(editorShortcutAllowed(key(document.body), 'editor')).toBe(false);
    d.remove();
  });
  it('ignores repeats of destructive shortcuts but permits deliberate undo repeats', () => {
    for (const k of ['Delete', 'Backspace', 'd'])
      expect(editorShortcutAllowed(key(document.body, { key: k, repeat: true }), 'editor')).toBe(
        false,
      );
    expect(editorShortcutAllowed(key(document.body, { repeat: true }), 'editor')).toBe(true);
  });
});
