import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AccountUser, Backend, RemoteRecord, SaveResult, ShareLink } from '../core/account';

/**
 * The Supabase backend (ADR-127): auth with Google and email/password, the `records` and `shares` tables and their
 * functions (`supabase/migrations/`). Only the public (anon) key ships; the server enforces every rule (ADR-131).
 * The session is kept in this device's storage (G-234), so a reload or an offline start stays signed in.
 */

const toUser = (u: User): AccountUser => ({
  id: u.id,
  email: u.email ?? '',
  name:
    (u.user_metadata?.full_name as string | undefined) ??
    (u.user_metadata?.name as string | undefined),
  provider: u.app_metadata?.provider === 'google' ? 'google' : 'email',
});

type Row = {
  id: string;
  kind: RemoteRecord['kind'];
  name: string;
  body: unknown;
  body_schema: number;
  revision: number;
  updated_at: string;
  deleted_at: string | null;
};
const toRecord = (r: Row): RemoteRecord => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  body: r.body,
  bodySchema: r.body_schema,
  revision: r.revision,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
type ShareRow = { id: string; record_id: string; created_at: string; stopped_at: string | null };
const toShare = (s: ShareRow): ShareLink => ({
  id: s.id,
  recordId: s.record_id,
  createdAt: s.created_at,
  stoppedAt: s.stopped_at,
});

/** Plain words for the messages the user sees; the provider's text when there is no better one. */
function said(e: { message?: string; code?: string } | null | undefined): string {
  const m = e?.message ?? '';
  if (/invalid login credentials/i.test(m)) return 'Email or password is wrong.';
  if (/already registered|already exists/i.test(m))
    return 'An account with this email already exists.';
  if (/fetch|network|failed to/i.test(m)) return 'Check your connection and try again.';
  if (/rate limit/i.test(m)) return 'Too many tries. Wait a while and try again.';
  if (/expired|invalid.*(token|link)/i.test(m)) return 'This link has expired. Ask for a new one.';
  return m || 'Something went wrong. Try again.';
}

export function supabaseBackend(url: string, anonKey: string, appUrl: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return {
    async currentUser() {
      const { data } = await sb.auth.getSession();
      return data.session?.user ? toUser(data.session.user) : null;
    },
    async signInWithPassword(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      return error || !data.user
        ? { ok: false, error: said(error) }
        : { ok: true, user: toUser(data.user) };
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error || !data.user) return { ok: false, error: said(error) };
      // No email verification (G-254): the project's "Confirm email" setting is off, so a session comes back.
      if (!data.session)
        return { ok: false, error: 'Check your inbox to finish creating the account.' };
      return { ok: true, user: toUser(data.user) };
    },
    async signInWithGoogle() {
      // Full-page redirect (G-247); scopes only what sign-in needs (ADR-135).
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: appUrl, scopes: 'openid email profile' },
      });
      return error ? { ok: false, error: said(error) } : { ok: true };
    },
    async sendPasswordReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}#reset-password`,
      });
      // The same answer whether or not the account exists (ADR-136); only real failures are reported.
      return error && !/not found|no user/i.test(error.message)
        ? { ok: false, error: said(error) }
        : { ok: true };
    },
    async updatePassword(password) {
      const { data, error } = await sb.auth.updateUser({ password });
      return error || !data.user
        ? { ok: false, error: said(error) }
        : { ok: true, user: toUser(data.user) };
    },
    async signOut() {
      await sb.auth.signOut({ scope: 'local' });
    },
    async listRecords() {
      const { data, error } = await sb
        .from('records')
        .select('id, kind, name, body, body_schema, revision, updated_at, deleted_at');
      if (error) throw new Error(said(error));
      return (data as Row[]).map(toRecord);
    },
    async saveRecord(r): Promise<SaveResult> {
      const { data, error } = await sb.rpc('save_record', {
        p_id: r.id ?? null,
        p_kind: r.kind,
        p_name: r.name,
        p_body: r.body,
        p_schema: r.bodySchema,
        p_base: r.baseRevision ?? null,
      });
      if (error?.code === '40001') return { ok: false, conflict: true };
      if (error)
        return { ok: false, error: error.code === '53100' ? 'Your account is full.' : said(error) };
      return { ok: true, record: toRecord(data as Row) };
    },
    async trashRecord(id, trash) {
      const { error } = await sb.rpc('trash_record', { p_id: id, p_trash: trash });
      if (error) throw new Error(said(error));
    },
    async purgeTrash() {
      const { data, error } = await sb.rpc('purge_trash');
      if (error) throw new Error(said(error));
      return (data as number) ?? 0;
    },
    async createShare(recordId, shareId) {
      const { data, error } = await sb.rpc('create_share', { p_record: recordId, p_id: shareId });
      if (error)
        throw new Error(error.code === '53400' ? 'Too many links in the last hour.' : said(error));
      return toShare(data as ShareRow);
    },
    async listShares() {
      const { data, error } = await sb
        .from('shares')
        .select('id, record_id, created_at, stopped_at');
      if (error) throw new Error(said(error));
      return (data as ShareRow[]).map(toShare);
    },
    async stopShare(shareId) {
      const { error } = await sb.rpc('stop_share', { p_id: shareId });
      if (error) throw new Error(said(error));
    },
    async openShare(shareId) {
      const { data, error } = await sb.rpc('open_share', { p_id: shareId });
      if (error) throw new Error(said(error));
      const row = (
        data as (Omit<Row, 'id' | 'revision' | 'deleted_at'> & { updated_at: string })[]
      )[0];
      return row
        ? {
            name: row.name,
            kind: row.kind,
            body: row.body,
            bodySchema: row.body_schema,
            updatedAt: row.updated_at,
          }
        : null;
    },
    async deleteAccount() {
      const { error } = await sb.rpc('delete_my_account');
      if (error) return { ok: false, error: said(error) };
      await sb.auth.signOut({ scope: 'local' });
      return { ok: true };
    },
  };
}
