import type { AccountUser, AuthResult } from '../core/account';
import { t } from '../core/i18n';
import type { LocalTable } from '../core/sync';
import { online, rememberAccount, useAccount } from './accountStore';

/**
 * What the account UI does (ADR-134 to ADR-138, ADR-142). Each action loads the online chunk on first use.
 */

const st = () => useAccount.getState();
let unsubscribe: (() => void) | null = null;

async function refreshHidden(): Promise<void> {
  const c = await online();
  st().set({ hidden: await c.otherAccountsItems(st().user?.id ?? null) });
}

/** Signed in: remember the account, follow its sync status and sync now and after each save. */
async function started(user: AccountUser): Promise<void> {
  rememberAccount(user);
  const c = await online();
  unsubscribe?.();
  unsubscribe = c.onSyncStatus((s) => st().set({ sync: { ...s } }));
  c.startAutoSync();
  await refreshHidden();
}

const authParams = () =>
  typeof location !== 'undefined' &&
  (/[?&]code=/.test(location.search) ||
    /access_token=|#reset-password/.test(location.hash) ||
    /[?&]error_description=/.test(location.search));

/**
 * At start: a remembered account shows at once (no request); then, or when coming back from Google or a reset link,
 * the session is checked. Offline, the remembered account stays and every offline feature works (ADR-134).
 */
export async function initAccount(): Promise<void> {
  if (!st().configured) return;
  if (!st().user && !authParams()) return;
  try {
    const c = await online();
    const user = await c.currentUser();
    if (user) await started(user);
    else if (typeof navigator === 'undefined' || navigator.onLine !== false) rememberAccount(null);
    if (typeof location !== 'undefined' && location.hash === '#reset-password')
      st().setDialog('reset');
    if (typeof location !== 'undefined' && /[?&]error_description=/.test(location.search))
      st().set({ dialog: 'sign-in', error: t('Google sign-in did not finish. Try again.') });
    if (typeof history !== 'undefined' && authParams())
      history.replaceState(null, '', `${location.pathname}#projects`);
  } catch {
    /* offline or not set up: the remembered account stays */
  }
}

async function run(f: () => Promise<AuthResult | { ok: true } | { ok: false; error: string }>) {
  st().set({ busy: true, error: null });
  try {
    const r = await f();
    if (!r.ok) st().set({ error: r.error });
    return r;
  } catch (e) {
    const error = (e as Error).message || t('Check your connection and try again.');
    st().set({ error });
    return { ok: false as const, error };
  } finally {
    st().set({ busy: false });
  }
}

export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const r = await run(async () => (await online()).signIn(email, password));
  if (r.ok && 'user' in r) {
    await started((r as { user: AccountUser }).user);
    st().setDialog(null);
  }
  return r.ok;
}

export async function createAccount(email: string, password: string): Promise<boolean> {
  const r = await run(async () => (await online()).signUp(email, password));
  if (r.ok && 'user' in r) {
    await started((r as { user: AccountUser }).user);
    st().setDialog(null);
  }
  return r.ok;
}

/** Full-page redirect to Google (G-247): the app comes back and `initAccount` finishes it. */
export async function continueWithGoogle(): Promise<void> {
  const r = await run(async () => (await online()).signInWithGoogle());
  if (r.ok) {
    // A fake backend signs in at once; Supabase leaves the page.
    const user = await (await online()).currentUser();
    if (user) {
      await started(user);
      st().setDialog(null);
    }
  }
}

export async function sendReset(email: string): Promise<void> {
  const r = await run(async () => (await online()).sendReset(email));
  if (r.ok) st().set({ dialog: 'forgot-sent', email });
}

export async function saveNewPassword(password: string): Promise<boolean> {
  const r = await run(async () => (await online()).updatePassword(password));
  if (r.ok && 'user' in r) {
    await started((r as { user: AccountUser }).user);
    st().set({ dialog: 'account', error: null });
  }
  return r.ok;
}

/** Sign out; `removeCopies` removes this device's copies of the account's items (G-227, default keep). */
export async function signOut(removeCopies = false): Promise<void> {
  const user = st().user;
  st().set({ busy: true });
  try {
    unsubscribe?.();
    unsubscribe = null;
    if (user) await (await online()).signOut(user.id, removeCopies);
  } catch {
    /* offline: forget the session here anyway */
  } finally {
    rememberAccount(null);
    st().set({ busy: false, dialog: null });
    await refreshHidden().catch(() => {});
  }
}

/** Switch to another account used on this device (ADR-142): sign out here, keep copies, sign in as the other. */
export async function switchTo(email: string): Promise<void> {
  await signOut(false);
  st().set({ dialog: 'sign-in', email });
}

export async function syncNow(): Promise<void> {
  await (await online()).sync();
}

export async function setDeviceOnly(table: LocalTable, id: string, on: boolean): Promise<void> {
  const user = st().user;
  if (!user) return;
  await (await online()).setDeviceOnly(user.id, table, id, on);
}

export async function exportMyData(): Promise<void> {
  st().set({ busy: true, error: null });
  try {
    const z = await (await online()).exportMyData();
    const url = URL.createObjectURL(z.blob);
    Object.assign(document.createElement('a'), { href: url, download: z.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    st().set({ error: (e as Error).message });
  } finally {
    st().set({ busy: false });
  }
}

export async function deleteMyAccount(): Promise<boolean> {
  const user = st().user;
  if (!user) return false;
  const r = await run(async () => (await online()).deleteMyAccount(user.id));
  if (r.ok) {
    unsubscribe?.();
    unsubscribe = null;
    rememberAccount(null);
    st().set({ dialog: null });
  }
  return r.ok;
}
