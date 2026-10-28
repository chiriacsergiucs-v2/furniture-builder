import type { AccountUser, Backend, RemoteRecord, ShareLink, SharedItem } from '../core/account';

/**
 * An in-memory backend with the same rules as the Supabase migration (owner-only records, revision checks, Trash,
 * share links), for tests and for checking the app without a project. Several "devices" can share one server.
 */
export interface FakeServer {
  users: Map<string, { user: AccountUser; password: string }>;
  records: Map<string, RemoteRecord & { owner: string }>;
  shares: Map<string, ShareLink & { owner: string }>;
  sentResets: string[];
  /** While true every call fails like a lost connection. */
  offline: boolean;
}

export const fakeServer = (): FakeServer => ({
  users: new Map(),
  records: new Map(),
  shares: new Map(),
  sentResets: [],
  offline: false,
});

/** A server row without its owner, as the app sees it. */
function strip<T extends { owner: string }>(row: T): Omit<T, 'owner'> {
  const out: Partial<T> = { ...row };
  delete out.owner;
  return out as Omit<T, 'owner'>;
}

let seq = 0;
const id = () => `id-${++seq}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

export function fakeBackend(server: FakeServer = fakeServer()): Backend & { server: FakeServer } {
  let me: AccountUser | null = null;
  const net = () => {
    if (server.offline) throw new Error('Check your connection and try again.');
  };
  const own = () => {
    net();
    if (!me) throw new Error('not signed in');
    return me.id;
  };
  return {
    server,
    async currentUser() {
      return me;
    },
    async signInWithPassword(email, password) {
      if (server.offline) return { ok: false, error: 'Check your connection and try again.' };
      const u = [...server.users.values()].find(
        (x) => x.user.email === email && x.user.provider === 'email',
      );
      if (!u || u.password !== password) return { ok: false, error: 'Email or password is wrong.' };
      me = u.user;
      return { ok: true, user: me };
    },
    async signUp(email, password) {
      if (server.offline) return { ok: false, error: 'Check your connection and try again.' };
      if (
        [...server.users.values()].some(
          (x) => x.user.email === email && x.user.provider === 'email',
        )
      )
        return { ok: false, error: 'An account with this email already exists.' };
      const user: AccountUser = { id: id(), email, provider: 'email' };
      server.users.set(user.id, { user, password });
      me = user;
      return { ok: true, user };
    },
    async signInWithGoogle() {
      if (server.offline) return { ok: false, error: 'Check your connection and try again.' };
      const user: AccountUser = {
        id: id(),
        email: 'google.user@example.com',
        name: 'Google User',
        provider: 'google',
      };
      server.users.set(user.id, { user, password: '' });
      me = user;
      return { ok: true };
    },
    async sendPasswordReset(email) {
      if (server.offline) return { ok: false, error: 'Check your connection and try again.' };
      if ([...server.users.values()].some((x) => x.user.email === email))
        server.sentResets.push(email);
      return { ok: true };
    },
    async updatePassword(password) {
      if (!me) return { ok: false, error: 'This link has expired. Ask for a new one.' };
      server.users.get(me.id)!.password = password;
      return { ok: true, user: me };
    },
    async signOut() {
      me = null;
    },
    async listRecords() {
      const o = own();
      return [...server.records.values()]
        .filter((r) => r.owner === o)
        .map((r) => structuredClone(strip(r)));
    },
    async saveRecord(r) {
      const o = own();
      if (!r.id) {
        const rec = {
          id: id(),
          kind: r.kind,
          name: r.name,
          body: structuredClone(r.body),
          bodySchema: r.bodySchema,
          revision: 1,
          updatedAt: now(),
          deletedAt: null,
          owner: o,
        };
        server.records.set(rec.id, rec);
        return { ok: true, record: structuredClone(strip(rec)) };
      }
      const cur = server.records.get(r.id);
      if (!cur || cur.owner !== o || cur.revision !== r.baseRevision)
        return { ok: false, conflict: true };
      Object.assign(cur, {
        name: r.name,
        body: structuredClone(r.body),
        bodySchema: r.bodySchema,
        revision: cur.revision + 1,
        updatedAt: now(),
        deletedAt: null,
      });
      return { ok: true, record: structuredClone(strip(cur)) };
    },
    async trashRecord(rid, trash) {
      const o = own();
      const cur = server.records.get(rid);
      if (cur && cur.owner === o)
        Object.assign(cur, { deletedAt: trash ? now() : null, updatedAt: now() });
    },
    async purgeTrash() {
      const o = own();
      let n = 0;
      for (const [k, r] of server.records)
        if (r.owner === o && r.deletedAt && Date.now() - Date.parse(r.deletedAt) >= 7 * 864e5) {
          server.records.delete(k);
          n++;
        }
      return n;
    },
    async createShare(recordId, shareId) {
      const o = own();
      const rec = server.records.get(recordId);
      if (!rec || rec.owner !== o || rec.deletedAt) throw new Error('not found');
      const s = { id: shareId, recordId, createdAt: now(), stoppedAt: null, owner: o };
      server.shares.set(shareId, s);
      return strip(s);
    },
    async listShares() {
      const o = own();
      return [...server.shares.values()].filter((s) => s.owner === o).map(strip);
    },
    async stopShare(shareId) {
      const o = own();
      const s = server.shares.get(shareId);
      if (s && s.owner === o && !s.stoppedAt) s.stoppedAt = now();
    },
    async openShare(shareId): Promise<SharedItem | null> {
      net();
      const s = server.shares.get(shareId);
      const r = s && !s.stoppedAt ? server.records.get(s.recordId) : undefined;
      return r && !r.deletedAt
        ? {
            name: r.name,
            kind: r.kind,
            body: structuredClone(r.body),
            bodySchema: r.bodySchema,
            updatedAt: r.updatedAt,
          }
        : null;
    },
    async deleteAccount() {
      const o = own();
      server.users.delete(o);
      for (const [k, r] of server.records) if (r.owner === o) server.records.delete(k);
      for (const [k, s] of server.shares) if (s.owner === o) server.shares.delete(k);
      me = null;
      return { ok: true };
    },
  };
}
