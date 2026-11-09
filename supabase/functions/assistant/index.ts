// The assistant's server side (ADR-239): a Supabase Edge Function (Deno). It checks the caller's session, takes one
// request from the account's daily allowance, sends the request to the model provider with the key kept here as a
// secret, and returns either a question or a plan of catalog calls. It stores no chat and no design.
//
// Deploy: `supabase functions deploy assistant` and `supabase secrets set ANTHROPIC_API_KEY=...`; optional secrets
// ASSISTANT_MODEL (default claude-opus-5-5), ASSISTANT_DAILY_CAP (default 50) and ASSISTANT_ALLOWED_ORIGIN.
import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { type ActionSpec, openingTurns, SYSTEM, TOOLS } from './prompt.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const MODEL = Deno.env.get('ASSISTANT_MODEL') ?? 'claude-opus-5-5';
const CAP = Math.max(1, Number(Deno.env.get('ASSISTANT_DAILY_CAP') ?? '50') || 50);
const ORIGIN = Deno.env.get('ASSISTANT_ALLOWED_ORIGIN') ?? 'https://chiriacsergiucs-v2.github.io';
/** The largest request body accepted, in characters (a big project is well under this). */
const MAX_BODY = 600_000;

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

interface AssistantRequest {
  message: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  document: { kind: 'design' | 'project'; value: unknown };
  selection: { itemIds: string[]; spaceId: string | null | undefined };
  actions: ActionSpec[];
}

function valid(body: unknown): body is AssistantRequest {
  const b = body as AssistantRequest;
  return (
    !!b &&
    typeof b.message === 'string' &&
    b.message.trim().length > 0 &&
    Array.isArray(b.history) &&
    !!b.document &&
    (b.document.kind === 'design' || b.document.kind === 'project') &&
    Array.isArray(b.actions)
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const auth = req.headers.get('Authorization');
  if (!auth) return json(401, { error: 'Sign in first.' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who.user) return json(401, { error: 'Sign in first.' });

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'Too large.' });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'Not JSON.' });
  }
  if (!valid(body)) return json(400, { error: 'Not an assistant request.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: left, error: capError } = await admin.rpc('assistant_take', {
    uid: who.user.id,
    cap: CAP,
  });
  if (capError) return json(500, { error: 'Usage could not be counted.' });
  if (typeof left === 'number' && left < 0) return json(429, { error: 'Daily limit reached.' });

  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  const messages = [
    ...openingTurns(body.document, body.selection, body.actions),
    ...body.history.slice(-20).map((h) => ({ role: h.role, content: h.text })),
    { role: 'user' as const, content: body.message },
  ];

  // Refusal fallbacks on by default (server-side, routed by the API).
  const params = {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: TOOLS,
    tool_choice: { type: 'auto' },
    messages,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
  let res;
  try {
    res = await client.beta.messages.create(
      params as unknown as Parameters<typeof client.beta.messages.create>[0],
    );
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError)
      return json(503, { error: 'The model is busy. Try again.' });
    if (e instanceof Anthropic.APIError) return json(502, { error: `Model error ${e.status}.` });
    return json(502, { error: 'The model could not be reached.' });
  }
  if (res.stop_reason === 'refusal')
    return json(200, {
      kind: 'question',
      text: 'I cannot help with that request. Try describing the change differently.',
    });

  for (const block of res.content) {
    if (block.type !== 'tool_use') continue;
    const input = block.input as Record<string, unknown>;
    if (block.name === 'ask_question' && typeof input.question === 'string')
      return json(200, { kind: 'question', text: input.question });
    if (block.name === 'propose_plan')
      return json(200, {
        kind: 'plan',
        summary: String(input.summary ?? ''),
        calls: input.calls ?? [],
      });
  }
  const said = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim();
  return json(200, { kind: 'question', text: said || 'Could you say that differently?' });
});
