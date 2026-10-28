/**
 * Accounts, account records and share links: the shapes the app and the backend agree on (ADR-128, ADR-132). Pure;
 * the network lives in `src/online` (ADR-126).
 */

export interface AccountUser {
  id: string;
  email: string;
  name?: string;
  /** How the user signed in (G-249: a Google and a password login with the same email are separate accounts). */
  provider: 'google' | 'email';
}

/** What a server record holds (ADR-128). Kinds: library pieces, local templates and the pictures they use (G-221). */
export type RecordKind = 'design' | 'template' | 'image';

export interface RemoteRecord {
  id: string;
  kind: RecordKind;
  name: string;
  body: unknown;
  bodySchema: number;
  revision: number;
  updatedAt: string;
  /** In the account Trash since then (G-228); purged after 7 days. */
  deletedAt?: string | null;
}

export interface SaveRequest {
  /** Absent: a new record. */
  id?: string;
  kind: RecordKind;
  name: string;
  body: unknown;
  bodySchema: number;
  /** The revision the change started from; the server refuses a stale one (a conflict, ADR-129). */
  baseRevision?: number;
}

export type SaveResult =
  | { ok: true; record: RemoteRecord }
  | { ok: false; conflict: true }
  | { ok: false; conflict?: false; error: string };

export interface ShareLink {
  id: string;
  recordId: string;
  createdAt: string;
  stoppedAt?: string | null;
}

/** What opening a share link returns: never the owner or any account field (ADR-132). */
export interface SharedItem {
  name: string;
  kind: RecordKind;
  body: unknown;
  bodySchema: number;
  updatedAt: string;
}

export type AuthResult = { ok: true; user: AccountUser } | { ok: false; error: string };

/** The backend the app talks to: Supabase in the app (`src/online/supabase.ts`), a fake in tests. */
export interface Backend {
  currentUser(): Promise<AccountUser | null>;
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  /** Starts the full-page redirect to Google (G-247); the app comes back signed in. */
  signInWithGoogle(): Promise<{ ok: true } | { ok: false; error: string }>;
  sendPasswordReset(email: string): Promise<{ ok: true } | { ok: false; error: string }>;
  updatePassword(password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  listRecords(): Promise<RemoteRecord[]>;
  saveRecord(r: SaveRequest): Promise<SaveResult>;
  trashRecord(id: string, trash: boolean): Promise<void>;
  purgeTrash(): Promise<number>;
  createShare(recordId: string, shareId: string): Promise<ShareLink>;
  listShares(): Promise<ShareLink[]>;
  stopShare(shareId: string): Promise<void>;
  openShare(shareId: string): Promise<SharedItem | null>;
  deleteAccount(): Promise<{ ok: true } | { ok: false; error: string }>;
}

/** An account remembered on this device (ADR-134, ADR-142): shown signed in at once, offline too, with no request. */
export interface KnownAccount {
  user: AccountUser;
  /** When it was last used here. */
  usedAt: string;
}

/** An unguessable share id: 128 random bits as base64url, 22 characters (ADR-131, ADR-132). */
export function newShareId(
  rand: (b: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b),
): string {
  const bytes = rand(new Uint8Array(16));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The link form (G-258): a fragment, never sent to GitHub Pages. */
export const SHARE_KEY = '#share=';
export const shareLink = (base: string, id: string) =>
  `${base.replace(/#.*$/, '')}${SHARE_KEY}${id}`;
export function shareIdFrom(hash: string): string | null {
  if (!hash.startsWith(SHARE_KEY)) return null;
  const id = hash.slice(SHARE_KEY.length);
  return /^[A-Za-z0-9_-]{22,64}$/.test(id) ? id : null;
}
