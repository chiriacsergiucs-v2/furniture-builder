import { create } from 'zustand';

/**
 * The app's own confirmation and text prompts (ADR-030, user decision 2026-10-23), replacing the browser's
 * confirm() and prompt(): same look as the app, Escape cancels, Enter confirms, focus returns afterwards.
 */
export interface Ask {
  message: string;
  confirmLabel: string;
  /** The other answer's label when it is a choice, not a cancel ("Keep" / "Remove", ADR-167). */
  cancelLabel?: string;
  danger: boolean;
  /** The safe answer is the default: it takes the focus, so Enter keeps (ADR-203, G-469). */
  cancelFirst?: boolean;
  input?: string;
  resolve: (v: string | boolean | null) => void;
}
/** The question on screen, if any (ADR-030). */
export const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));
