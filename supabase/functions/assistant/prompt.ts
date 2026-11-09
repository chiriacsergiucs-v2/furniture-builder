// The assistant's fixed prompt (ADR-239): the system text, the tools and how the action list is written for the
// model. Kept apart from index.ts so scripts/assistant-eval.mjs sends exactly what the function sends.
export interface ArgSpec {
  name: string;
  type: string;
  enum?: string[];
  nullable?: boolean;
  optional?: boolean;
  description?: string;
}
export interface ActionSpec {
  name: string;
  description: string;
  args: ArgSpec[];
}
export const SYSTEM = `You are the assistant inside Furniture Builder, an app for designing cabinets and other casework and
getting a cut list. The user writes what they want changed in the open piece or project. You answer by calling
exactly one tool:

- propose_plan: when the request is clear. List the action calls that make the change, in order, using only the
  actions listed below and only their arguments. Sizes are whole millimetres; x is width, y height from the floor,
  z depth from the back. Use ids exactly as they appear in the document. In a project, select a piece with
  selectItem before calling an action on "the open piece". The app checks the plan, shows the user every change and
  applies it only when they choose Apply.
- ask_question: when the request is ambiguous, could mean several things, or needs a fact you do not have. Ask one
  short question. Never guess a hardware specification, a load, a drilling depth, a screw size or a supplier value:
  ask instead.

Reply in the language the user writes in. Keep summaries and questions short and plain.`;

export function actionList(actions: ActionSpec[]): string {
  return actions
    .map((a) => {
      const args = a.args
        .map((g) => {
          const kind = g.enum ? g.enum.map((v) => JSON.stringify(v)).join(' | ') : g.type;
          const mods = [g.optional ? 'optional' : '', g.nullable ? 'or null' : '']
            .filter(Boolean)
            .join(', ');
          return `${g.name}: ${kind}${mods ? ` (${mods})` : ''}${g.description ? ` — ${g.description}` : ''}`;
        })
        .join('; ');
      return `- ${a.name}(${args}): ${a.description}`;
    })
    .join('\n');
}

/** The first two turns of every request: the open document, the selection and the actions the model may call. */
export function openingTurns(
  document: { kind: 'design' | 'project'; value: unknown },
  selection: { itemIds?: string[]; spaceId?: string | null } | undefined,
  actions: ActionSpec[],
) {
  const context = [
    `The open ${document.kind}:`,
    JSON.stringify(document.value),
    `Selected project pieces: ${JSON.stringify(selection?.itemIds ?? [])}; selected space: ${JSON.stringify(selection?.spaceId ?? null)}.`,
    'The actions you may call:',
    actionList(actions),
  ].join('\n');
  return [
    { role: 'user' as const, content: context },
    { role: 'assistant' as const, content: 'Understood. I will answer with one tool call.' },
  ];
}

// strict: off, per-action argument schemas for propose_plan would be a union of the 100 actions in
// src/store/assistantActions.ts, past the 16 union-parameter limit, and many arguments are free-form objects (patch,
// board, style) that additionalProperties false would reject; planProblems in src/core/assistant.ts checks every
// call in the app before anything is shown or applied.
export const TOOLS = [
  {
    name: 'propose_plan',
    description:
      'Proposes the change the user asked for as an ordered list of action calls with a one-sentence summary; the app checks the whole plan, shows the user every change and applies it only when they choose Apply. ' +
      'Use it when the request is clear and every step can be made with the actions listed in the first message, using ids exactly as they appear in the document. ' +
      'Do not use it when the request is ambiguous, could mean several things or needs a fact you do not have; call ask_question instead. ' +
      "summary is one plain sentence in the user's language saying what the plan does; calls is the ordered list, and each call has action, the exact name of one listed action, and args, an object holding that action's arguments by name. " +
      'This tool never changes the design by itself, never calls an action that is not listed, and never carries a guessed hardware specification, load, drilling depth, screw size or supplier value.',
    input_schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: "What the plan does, in one plain sentence in the user's language.",
        },
        calls: {
          type: 'array',
          description: 'The action calls, in the order they run.',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'The exact name of one listed action.' },
              args: {
                type: 'object',
                description: "The action's arguments by name; sizes in whole millimetres.",
              },
            },
            required: ['action', 'args'],
          },
        },
      },
      required: ['summary', 'calls'],
    },
  },
  {
    name: 'ask_question',
    description:
      'Asks the user one short question and changes nothing; the app shows the question in the chat and the answer arrives as the next message. ' +
      'Use it when the request is unclear, could mean several things, or needs a fact you do not have, such as a hardware specification, a load, a drilling depth, a screw size or a supplier value. ' +
      'Do not use it when the request is clear enough to plan with the listed actions; call propose_plan instead. ' +
      "question is one short, plain question in the user's language. " +
      'This tool never changes the design, never proposes actions and never asks more than one question at a time.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: "One short, plain question in the user's language.",
        },
      },
      required: ['question'],
    },
    cache_control: { type: 'ephemeral' },
  },
];
