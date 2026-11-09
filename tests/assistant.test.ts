// The assistant (ADR-239, ADR-240): the action catalog covers every store action, plans are checked whole, previews
// leave the open document untouched, Apply is one undo step, and the request flow sends nothing unless switched on,
// accepted and signed in. The backend is the in-memory one (`src/online/fake.ts`); nothing leaves the test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changesBetween, parseReply, planProblems } from '../src/core/assistant';
import { templates } from '../src/core/design';
import { makeItem, newProject, type Project } from '../src/core/project';
import type { CabinetParams, Design } from '../src/core/types';
import { rememberAccount } from '../src/store/accountStore';
import { actionSpecs, CATALOG, EXCLUDED } from '../src/store/assistantActions';
import { applyPlan, previewPlan } from '../src/store/assistantRun';
import { useAssistant } from '../src/store/assistantStore';
import { useDesign } from '../src/store/designStore';

const st = () => useDesign.getState();
const byTemplate = (id: string) => templates.find((t) => t.id === id)!.create();
const width = (d: Design) => (d.product.params as CabinetParams).width;

function twoPieces(): { p: Project; a: string; b: string } {
  const base = newProject();
  const a = makeItem(base, byTemplate('chest'));
  const b = makeItem({ ...base, items: [a] }, byTemplate('bookcase'));
  return { p: { ...base, items: [a, b] }, a: a.id, b: b.id };
}

describe('the action catalog (ADR-240)', () => {
  it('every store action is in the catalog or excluded with a reason', () => {
    const fns = Object.entries(st())
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k);
    const missing = fns.filter((k) => !(k in CATALOG) && !(k in EXCLUDED));
    expect(missing).toEqual([]);
    // Nothing is both allowed and excluded, and every catalog entry runs something.
    expect(Object.keys(CATALOG).filter((k) => k in EXCLUDED)).toEqual([]);
    for (const [name, e] of Object.entries(CATALOG))
      expect(
        !!e.run || typeof (st() as unknown as Record<string, unknown>)[name] === 'function',
      ).toBe(true);
  });

  it('saved-data, history and screen actions are not callable', () => {
    for (const k of [
      'load',
      'openProject',
      'replaceDesign',
      'updateProject',
      'undo',
      'undoProject',
      'editItem',
    ])
      expect(k in CATALOG).toBe(false);
  });
});

describe('plans (ADR-240)', () => {
  beforeEach(() => st().load(byTemplate('chest')));

  it('a plan with an unknown action or a bad argument is rejected whole and the design is unchanged', () => {
    const before = st().design;
    const calls = [
      { action: 'resizePiece', args: { key: 'width', value: 1000 } },
      { action: 'deleteEverything', args: {} },
    ];
    expect(planProblems(calls, actionSpecs())).toEqual([
      'Step 2 (deleteEverything): unknown action',
    ]);
    const run = previewPlan(calls);
    expect(run.ok).toBe(false);
    expect(st().design).toBe(before);
    const bad = previewPlan([{ action: 'resizePiece', args: { key: 'width', value: 'wide' } }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems[0]).toMatch(/value must be a whole number/);
    expect(st().design).toBe(before);
  });

  it('a valid plan previews on a copy: the open design and its history are unchanged until Apply', () => {
    const before = st().design;
    const past = st().past;
    const run = previewPlan([{ action: 'resizePiece', args: { key: 'width', value: 1000 } }]);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(st().design).toBe(before);
    expect(st().past).toBe(past);
    expect(
      run.preview.changes.some(
        (c) => /width/.test(c.path) && c.before === '800' && c.after === '1000',
      ),
    ).toBe(true);
  });

  it('Apply is one undo step; one Undo restores the design exactly', () => {
    const before = st().design;
    const run = previewPlan([
      { action: 'resizePiece', args: { key: 'width', value: 1000 } },
      { action: 'rename', args: { name: 'Wide chest' } },
    ]);
    if (!run.ok) throw new Error(run.problems.join());
    expect(applyPlan(run.preview)).toBeNull();
    expect(width(st().design)).toBe(1000);
    expect(st().design.name).toBe('Wide chest');
    st().undo();
    expect(st().design).toBe(before);
  });

  it('a preview after a hand edit cannot be applied', () => {
    const run = previewPlan([{ action: 'resizePiece', args: { key: 'width', value: 1000 } }]);
    if (!run.ok) throw new Error(run.problems.join());
    st().rename('Edited by hand');
    expect(applyPlan(run.preview)).toBe('changed');
    expect(width(st().design)).toBe(800);
  });

  it('new error diagnostics show in the preview with their severity', () => {
    const run = previewPlan([{ action: 'resizePiece', args: { key: 'width', value: 40 } }]);
    if (!run.ok) throw new Error(run.problems.join());
    expect(run.preview.diagnostics.length).toBeGreaterThan(0);
    expect(run.preview.diagnostics[0].severity).toBe('error');
  });

  it('in a project, Apply is one project undo step', () => {
    const { p, a, b } = twoPieces();
    st().openProject(p);
    const start = st().project;
    const run = previewPlan([
      { action: 'resizeItem', args: { id: a, key: 'width', value: 900 } },
      { action: 'moveItemBy', args: { id: b, dx: 100, dz: 0 } },
    ]);
    if (!run.ok) throw new Error(run.problems.join());
    expect(st().project).toBe(start);
    expect(applyPlan(run.preview)).toBeNull();
    expect(width(st().project!.items.find((i) => i.id === a)!.design)).toBe(900);
    st().undoProject();
    expect(st().project).toEqual(start);
  });

  it('changesBetween names array items and skips timestamps', () => {
    const c = changesBetween(
      { items: [{ id: 'x', name: 'Wardrobe', w: 1200 }], updatedAt: '1' },
      { items: [{ id: 'x', name: 'Wardrobe', w: 1000 }], updatedAt: '2' },
    );
    expect(c).toEqual([{ path: 'items › Wardrobe › w', before: '1200', after: '1000' }]);
  });

  it('parseReply reads a question or a plan and nothing else', () => {
    expect(parseReply({ kind: 'question', text: 'Which wardrobe?' })).toEqual({
      kind: 'question',
      text: 'Which wardrobe?',
    });
    expect(
      parseReply({ kind: 'plan', summary: 's', calls: [{ action: 'a', args: { x: 1 } }] }),
    ).toEqual({
      kind: 'plan',
      summary: 's',
      calls: [{ action: 'a', args: { x: 1 } }],
    });
    expect(parseReply({ kind: 'plan', summary: 's', calls: [7] })).toBeNull();
    expect(parseReply('hello')).toBeNull();
  });
});

describe('the request flow (ADR-239)', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
    st().load(byTemplate('chest'));
    useAssistant.setState({
      enabled: false,
      consented: false,
      lines: [],
      preview: null,
      busy: false,
    });
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    rememberAccount(null);
    (await import('../src/online/client')).setBackend(null);
  });

  async function signedIn(reply: (body: unknown) => unknown) {
    const { fakeBackend, fakeServer } = await import('../src/online/fake');
    const client = await import('../src/online/client');
    const server = fakeServer();
    server.assistant = reply;
    const backend = fakeBackend(server);
    client.setBackend(backend);
    const res = await backend.signUp('a@example.com', 'long-password-1');
    if (!res.ok) throw new Error('sign up');
    rememberAccount(res.user);
    return server;
  }

  it('nothing is sent while switched off or before the consent is accepted', async () => {
    const server = await signedIn(() => ({ kind: 'question', text: 'Hi' }));
    await useAssistant.getState().send('make it wider');
    useAssistant.getState().setEnabled(true);
    await useAssistant.getState().send('make it wider');
    expect(server.assistantCalls ?? []).toEqual([]);
    useAssistant.getState().accept();
    await useAssistant.getState().send('make it wider');
    expect(server.assistantCalls).toHaveLength(1);
  });

  it('the request holds the message, the design, the selection and the actions, and no geometry', async () => {
    const server = await signedIn(() => ({ kind: 'question', text: 'How wide?' }));
    useAssistant.setState({ enabled: true, consented: true });
    st().select(null);
    await useAssistant.getState().send('make it wider');
    const body = server.assistantCalls![0] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'actions',
      'document',
      'history',
      'message',
      'selection',
    ]);
    expect(body.document).toEqual({ kind: 'design', value: st().design });
    expect(JSON.stringify(body)).not.toMatch(/"panels":\[|"diagnostics":|data:image/);
    // A question changes nothing and is shown.
    expect(useAssistant.getState().lines.at(-1)).toEqual({ role: 'assistant', text: 'How wide?' });
    expect(useAssistant.getState().preview).toBeNull();
  });

  it('a plan reply previews; Apply changes the design', async () => {
    await signedIn(() => ({
      kind: 'plan',
      summary: 'Width to 1000 mm.',
      calls: [{ action: 'resizePiece', args: { key: 'width', value: 1000 } }],
    }));
    useAssistant.setState({ enabled: true, consented: true });
    await useAssistant.getState().send('make it 1000 wide');
    expect(width(st().design)).toBe(800);
    expect(useAssistant.getState().preview?.changes.length).toBeGreaterThan(0);
    useAssistant.getState().apply();
    expect(width(st().design)).toBe(1000);
  });

  it('each failure shows its message and leaves the design unchanged', async () => {
    const server = await signedIn(() => ({ kind: 'question', text: 'x' }));
    useAssistant.setState({ enabled: true, consented: true });
    const before = st().design;
    const last = () => useAssistant.getState().lines.at(-1);

    server.offline = true;
    await useAssistant.getState().send('a');
    expect(last()).toEqual({ role: 'error', text: 'Check your connection and try again.' });
    server.offline = false;

    server.assistantLeft = 0;
    await useAssistant.getState().send('b');
    expect(last()?.text).toBe(
      'You reached today’s limit of assistant requests. Try again tomorrow.',
    );
    delete server.assistantLeft;

    server.assistant = undefined;
    await useAssistant.getState().send('c');
    expect(last()?.text).toBe('The assistant is not set up on this server yet.');

    server.assistant = () => {
      throw new Error('Model error 502.');
    };
    await useAssistant.getState().send('provider');
    expect(last()).toEqual({ role: 'error', text: 'Model error 502.' });

    rememberAccount(null);
    await useAssistant.getState().send('d');
    expect(last()?.text).toBe('Sign in to use the assistant.');
    expect(st().design).toBe(before);
  });
});
