import { beforeEach, describe, expect, it, vi } from 'vitest';

// ADR-135, ADR-136, ADR-128: the Supabase adapter asks Google only for sign-in data, returns to the app, sends the
// reset link back to the app, and maps the server's conflict to "keep both". The client library is mocked: no network.
const calls: Record<string, unknown[]> = {};
const rec =
  (name: string) =>
  (...args: unknown[]) => {
    calls[name] = args;
    return result[name] ?? Promise.resolve({ data: {}, error: null });
  };
const result: Record<string, Promise<unknown>> = {};
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    calls.createClient = args;
    return {
      auth: {
        signInWithOAuth: rec('signInWithOAuth'),
        resetPasswordForEmail: rec('resetPasswordForEmail'),
        signInWithPassword: rec('signInWithPassword'),
        signOut: rec('signOut'),
      },
      rpc: rec('rpc'),
    };
  },
}));

const { supabaseBackend } = await import('../src/online/supabase');
const APP = 'https://chiriacsergiucs-v2.github.io/furniture-builder/';

describe('Supabase adapter', () => {
  beforeEach(() => {
    for (const k of Object.keys(calls)) delete calls[k];
    for (const k of Object.keys(result)) delete result[k];
  });
  it('keeps the session on the device and uses the PKCE redirect flow (G-234, G-247)', () => {
    supabaseBackend('https://x.supabase.co', 'anon', APP);
    const opts = calls.createClient[2] as { auth: Record<string, unknown> };
    expect(opts.auth).toMatchObject({
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    });
  });
  it('Google: only openid, email and profile; back to the app (ADR-135)', async () => {
    const b = supabaseBackend('https://x.supabase.co', 'anon', APP);
    await b.signInWithGoogle();
    expect(calls.signInWithOAuth[0]).toEqual({
      provider: 'google',
      options: { redirectTo: APP, scopes: 'openid email profile' },
    });
  });
  it('reset link returns to the app; the answer is the same for an unknown email (ADR-136)', async () => {
    const b = supabaseBackend('https://x.supabase.co', 'anon', APP);
    result.resetPasswordForEmail = Promise.resolve({
      data: {},
      error: { message: 'User not found' },
    });
    expect(await b.sendPasswordReset('nobody@example.com')).toEqual({ ok: true });
    expect(calls.resetPasswordForEmail[1]).toEqual({ redirectTo: `${APP}#reset-password` });
  });
  it('plain words for a wrong password', async () => {
    const b = supabaseBackend('https://x.supabase.co', 'anon', APP);
    result.signInWithPassword = Promise.resolve({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    expect(await b.signInWithPassword('a@b.c', 'x')).toEqual({
      ok: false,
      error: 'Email or password is wrong.',
    });
  });
  it('a stale revision (40001) is a conflict, a full account says so (ADR-129, G-223)', async () => {
    const b = supabaseBackend('https://x.supabase.co', 'anon', APP);
    result.rpc = Promise.resolve({ data: null, error: { code: '40001', message: 'conflict' } });
    expect(
      await b.saveRecord({
        id: 'r',
        kind: 'design',
        name: 'n',
        body: {},
        bodySchema: 3,
        baseRevision: 1,
      }),
    ).toEqual({ ok: false, conflict: true });
    result.rpc = Promise.resolve({ data: null, error: { code: '53100', message: 'account full' } });
    expect(await b.saveRecord({ kind: 'design', name: 'n', body: {}, bodySchema: 3 })).toEqual({
      ok: false,
      error: 'Your account is full.',
    });
    expect(calls.rpc[0]).toBe('save_record');
  });
});
