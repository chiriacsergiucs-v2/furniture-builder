import { create } from 'zustand';
import type { AccountUser, KnownAccount, RemoteRecord } from '../core/account';
import type { ItemSyncState, LocalTable } from '../core/sync';

/**
 * The account as the UI sees it (ADR-134, ADR-136, ADR-139, ADR-142). No network here: the online chunk
 * (`src/online/client.ts`) is loaded only when an account is used (ADR-126, G-215). The signed-in account is
 * remembered on this device, so a reload or an offline start shows it at once with no request (ADR-134, reading B).
 */

export type AccountDialog =
  | null
  | 'sign-in'
  | 'create'
  | 'forgot'
  | 'forgot-sent'
  | 'reset'
  | 'account'
  | 'sign-out'
  | 'privacy'
  | 'delete';

export interface SyncView {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  waiting: number;
  conflicts: string[];
  lastSyncAt?: string;
  error?: string;
  items: Record<string, ItemSyncState>;
  elsewhere: RemoteRecord[];
}

interface AccountState {
  /** This build has a backend (`VITE_SUPABASE_URL` and the public key); without it nothing online is shown. */
  configured: boolean;
  user: AccountUser | null;
  /** Accounts used on this device, most recent first (ADR-142). */
  known: KnownAccount[];
  dialog: AccountDialog;
  /** The email typed in the dialog, kept between its steps. */
  email: string;
  busy: boolean;
  error: string | null;
  sync: SyncView | null;
  /** `table:id` of saved items that belong to another account on this device: hidden, never removed (ADR-142). */
  hidden: Set<string>;
  /** The item whose Share link dialog is open (ADR-138). */
  shareFor: { table: LocalTable; id: string; name: string } | null;
  /** A share link being opened (`#share=<id>`, ADR-138, ADR-143). */
  opening: string | null;
  setDialog: (d: AccountDialog) => void;
  setEmail: (e: string) => void;
  set: (p: Partial<AccountState>) => void;
}

const CURRENT_KEY = 'fb:account';
const KNOWN_KEY = 'fb:accounts';

const read = <T>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked: remembered for this visit only */
  }
};

export const backendConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !!url && /^https:\/\//.test(url) && !!key;
};

export const useAccount = create<AccountState>((set) => ({
  configured: backendConfigured(),
  user: read<AccountUser | null>(CURRENT_KEY, null),
  known: read<KnownAccount[]>(KNOWN_KEY, []),
  dialog: null,
  email: '',
  busy: false,
  error: null,
  sync: null,
  hidden: new Set(),
  shareFor: null,
  opening: null,
  setDialog: (dialog) => set({ dialog, error: null }),
  setEmail: (email) => set({ email }),
  set: (p) => set(p),
}));

/** Remember the signed-in account on this device (or forget the current one when `null`). */
export function rememberAccount(user: AccountUser | null): void {
  const st = useAccount.getState();
  write(CURRENT_KEY, user);
  if (!user) {
    st.set({ user: null, sync: null });
    return;
  }
  const known = [
    { user, usedAt: new Date().toISOString() },
    ...st.known.filter((k) => k.user.id !== user.id),
  ].slice(0, 8);
  write(KNOWN_KEY, known);
  st.set({ user, known });
}

/** Forget an account on this device's list (its copies stay; ADR-142). */
export function forgetAccount(id: string): void {
  const known = useAccount.getState().known.filter((k) => k.user.id !== id);
  write(KNOWN_KEY, known);
  useAccount.getState().set({ known });
}

/** The online chunk, loaded on first use. */
export const online = () => import('../online/client');
