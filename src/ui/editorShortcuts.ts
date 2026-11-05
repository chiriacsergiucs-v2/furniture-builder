/** Editor shortcuts must never edit a hidden design, a dialog's background, or editable text (ADR-198). */
export function editorShortcutAllowed(e: KeyboardEvent, page: string): boolean {
  if (e.defaultPrevented) return false;
  const target = e.target;
  if (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
  )
    return false;
  const key = e.key.toLowerCase();
  if (page !== 'editor' || document.querySelector('dialog[open], details.more[open]')) {
    // Chromium can undo a previously blurred input even while a dialog button has focus.
    // Editable targets above keep native text undo; background fields must stay unchanged.
    if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) e.preventDefault();
    return false;
  }
  return !(
    e.repeat &&
    (key === 'delete' || key === 'backspace' || ((e.ctrlKey || e.metaKey) && key === 'd'))
  );
}
