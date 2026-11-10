/**
 * The assistant as the UI sees it (ADR-239, ADR-240): the switch and the consent kept on this device, the chat, the
 * preview and Apply / Discard. No network here: the request goes through the online chunk, loaded with `import()`
 * only when a message is sent (ADR-126).
 */
import { create } from 'zustand';
import { parseReply, type AssistantRequest, type ChatTurn } from '../core/assistant';
import { t } from '../core/i18n';
import { backendConfigured, online, useAccount } from './accountStore';
import { actionSpecs } from './assistantActions';
import { applyPlan, previewPlan, type Preview } from './assistantRun';
import { useDesign } from './designStore';

const ON_KEY = 'fb:assistant';
const CONSENT_KEY = 'fb:assistant-consent';
const readFlag = (k: string) => {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (k: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(k, '1');
    else localStorage.removeItem(k);
  } catch {
    // A browser that keeps nothing: the switch lasts for this visit only.
  }
};

interface ChatLine {
  role: 'user' | 'assistant' | 'error';
  text: string;
}

interface AssistantState {
  /** The switch (More › Assistant); off by default. */
  enabled: boolean;
  /** The consent text was accepted on this device. */
  consented: boolean;
  open: boolean;
  lines: ChatLine[];
  busy: boolean;
  preview: Preview | null;
  /** The summary of the plan being previewed. */
  summary: string;
  setEnabled: (on: boolean) => void;
  accept: () => void;
  setOpen: (open: boolean) => void;
  send: (text: string) => Promise<void>;
  apply: () => void;
  discard: () => void;
}

/** What is sent for the open document (ADR-239): its JSON and the selection, never geometry or pictures. */
function assistantRequest(message: string, history: ChatTurn[]): AssistantRequest {
  const s = useDesign.getState();
  return {
    message,
    history,
    document: s.project
      ? { kind: 'project', value: s.project }
      : { kind: 'design', value: s.design },
    selection: { itemIds: s.selectedItemIds, spaceId: s.selectedId },
    actions: actionSpecs(),
  };
}

export const useAssistant = create<AssistantState>((set, get) => ({
  enabled: readFlag(ON_KEY),
  consented: readFlag(CONSENT_KEY),
  open: false,
  lines: [],
  busy: false,
  preview: null,
  summary: '',
  setEnabled: (on) => {
    writeFlag(ON_KEY, on);
    set({ enabled: on, open: on ? get().open : false });
  },
  accept: () => {
    writeFlag(CONSENT_KEY, true);
    set({ consented: true });
  },
  setOpen: (open) => set({ open }),
  send: async (raw) => {
    const text = raw.trim();
    const st = get();
    if (!text || st.busy) return;
    // Nothing is sent before the consent, while switched off, without a backend or signed out (ADR-239).
    if (!st.enabled || !st.consented || !backendConfigured()) return;
    const say = (line: ChatLine) => set((s) => ({ lines: [...s.lines, line] }));
    if (!useAccount.getState().user) {
      say({ role: 'error', text: t('Sign in to use the assistant.') });
      return;
    }
    const history: ChatTurn[] = st.lines
      .filter((l) => l.role !== 'error')
      .map((l) => ({ role: l.role as ChatTurn['role'], text: l.text }));
    say({ role: 'user', text });
    set({ busy: true, preview: null, summary: '' });
    try {
      const { askAssistant } = await online();
      const res = await askAssistant(assistantRequest(text, history));
      if (!res.ok) {
        say({ role: 'error', text: res.error });
        return;
      }
      const reply = parseReply(res.reply);
      if (!reply) {
        say({
          role: 'error',
          text: t('The assistant gave an answer the app cannot read. Nothing changed.'),
        });
        return;
      }
      if (reply.kind === 'question') {
        say({ role: 'assistant', text: reply.text });
        return;
      }
      const run = previewPlan(reply.calls);
      if (!run.ok) {
        say({
          role: 'error',
          text: t('The assistant’s plan was rejected, nothing changed: {why}', {
            why: run.problems.slice(0, 3).join('; '),
          }),
        });
        return;
      }
      say({ role: 'assistant', text: reply.summary });
      set({ preview: run.preview, summary: reply.summary });
    } catch {
      say({ role: 'error', text: t('Check your connection and try again.') });
    } finally {
      set({ busy: false });
    }
  },
  apply: () => {
    const p = get().preview;
    if (!p) return;
    const why = applyPlan(p);
    set((s) => ({
      preview: null,
      summary: '',
      lines: [
        ...s.lines,
        why === 'changed'
          ? {
              role: 'error' as const,
              text: t('The design changed since this preview, so it was not applied. Ask again.'),
            }
          : why
            ? { role: 'error' as const, text: t('The change could not be applied: {why}', { why }) }
            : { role: 'assistant' as const, text: t('Applied. Undo takes it back in one step.') },
      ],
    }));
  },
  discard: () =>
    set((s) => ({
      preview: null,
      summary: '',
      lines: [...s.lines, { role: 'assistant', text: t('Discarded. Nothing changed.') }],
    })),
}));
