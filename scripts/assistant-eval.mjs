// Assistant tool-choice eval: sends each request in tests/assistant-eval/cases.jsonl to the model with exactly the
// system text, tools and opening turns of supabase/functions/assistant (prompt.ts), and checks the tool it picks and
// the action its plan calls. It also counts the cached prefix (tools + system) against the model's cache minimum.
//
// Run: ANTHROPIC_API_KEY=... node scripts/assistant-eval.mjs   (optional: ASSISTANT_MODEL, EVAL_ONLY=c01,c02)
// Without ANTHROPIC_API_KEY it prints a notice and exits 0; it is never run in CI. Every run is billed.
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('assistant-eval: ANTHROPIC_API_KEY is not set; nothing was sent.');
  process.exit(0);
}

const MODEL = process.env.ASSISTANT_MODEL ?? 'claude-opus-5-5';
/** The minimum cacheable prefix for the current models, in tokens. */
const CACHE_MIN = 512;
const only = process.env.EVAL_ONLY?.split(',');
const cases = readFileSync(new URL('../tests/assistant-eval/cases.jsonl', import.meta.url), 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))
  .filter((c) => !only || only.includes(c.id));

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { SYSTEM, TOOLS, openingTurns } = await vite.ssrLoadModule(
    '/supabase/functions/assistant/prompt.ts',
  );
  const { actionSpecs } = await vite.ssrLoadModule('/src/store/assistantActions.ts');
  const { templates } = await vite.ssrLoadModule('/src/core/design.ts');
  const { makeItem, newProject } = await vite.ssrLoadModule('/src/core/project.ts');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');

  const create = (id) => templates.find((t) => t.id === id).create();
  const documentFor = (spec) => {
    const [kind, ids] = spec.split(':');
    if (kind === 'design') return { kind, value: create(ids) };
    let project = newProject();
    for (const id of ids.split('+'))
      project = { ...project, items: [...project.items, makeItem(project, create(id))] };
    return { kind, value: project };
  };

  const client = new Anthropic();
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }];
  const prefix = await client.messages.countTokens({
    model: MODEL,
    system,
    tools: TOOLS,
    messages: [{ role: 'user', content: '.' }],
  });
  console.log(
    `prefix (tools + system + one-token message): ${prefix.input_tokens} tokens, cache minimum ${CACHE_MIN}`,
  );

  const actions = actionSpecs();
  let passed = 0;
  for (const c of cases) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system,
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      messages: [
        ...openingTurns(documentFor(c.document), { itemIds: [], spaceId: null }, actions),
        { role: 'user', content: c.message },
      ],
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    const use = res.content.find((b) => b.type === 'tool_use');
    const tool = use?.name ?? `(no tool, stop ${res.stop_reason})`;
    const called = (use?.input?.calls ?? []).map((k) => k.action);
    const wanted = c.expect_action ? c.expect_action.split('|') : [];
    const ok =
      tool === c.expect_tool && (wanted.length === 0 || called.some((a) => wanted.includes(a)));
    if (ok) passed++;
    console.log(
      `${ok ? 'pass' : 'FAIL'} ${c.id} ${tool} [${called.join(', ')}] ` +
        `cache read ${res.usage.cache_read_input_tokens ?? 0} — ${c.message}`,
    );
  }
  console.log(`${passed}/${cases.length} passed`);
  process.exitCode = passed === cases.length ? 0 : 1;
} finally {
  await vite.close();
}
