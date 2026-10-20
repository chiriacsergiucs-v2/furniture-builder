# Claude Flow / Ruflo — version neutral

**Compatibility: VERSION_UNVERIFIED.** Neither repository package.json nor available source verifies a project-pinned or installed `ruflo` / `claude-flow` runtime. Do not copy these into `.claude-flow` as native schemas without checking CLI version and its generated scaffold.

**Onboarding:** (1) identify explicit installed/pinned version; (2) initialise in a disposable worktree with that version; (3) inspect generated format; (4) translate agent roles and tasks under its native schema; (5) validate with its CLI; (6) keep source/decision registry visible to all agents; (7) start only READY tasks.

**Version-neutral assets:** `agents/` role contracts, `workflows/` coordination gates, `tasks/tasks.json`, `memory/` permanent source/decision guardrails.

**Single writer rule:** shared component interfaces, persistence contracts and manufacturing semantics require the `architecture-authority` role. Agents never fill UNKNOWN physical measurements by inference.
