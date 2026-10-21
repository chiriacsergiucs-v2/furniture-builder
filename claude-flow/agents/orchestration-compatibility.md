# Agent role: `orchestration-compatibility`

## Purpose
Keep this folder usable: task states, agent routing, runtime pinning (TSK-001) and the structural validity of every JSON/markdown asset here.

## Owns (single-writer scope)
- `claude-flow/README.md`, `PROJECT.md`, `manifest.json`, `tasks/**`, `workflows/**`, `memory/**`, `scripts/**`.

## Reads before acting
ADR-0028, ADR-0029, ADR-0030; `tasks/tasks.json`; `manifest.json`; the installed/pinned runtime version if any.

## May write
Files under *Owns*; task `status`, `owner`, `evidence` fields; `manifest.json.runtime`.

## Commands this role is expected to run
`python3 -I claude-flow/scripts/validate.py` (must pass before any commit touching this folder); for TSK-001 the pinned CLI's `init`/`validate` in a disposable worktree only.

## Gates this role enforces
- Only READY tasks with satisfied `depends_on` are started; blocked statuses are not promoted silently.
- A task's `verification` commands are run by `verifier`, not by the implementing role.
- Native runtime files are committed only after ADR-0030 becomes Accepted.

## Never
- Translate contracts into a guessed runtime schema.
- Edit `delivery/backlog.json` or `delivery/milestones.md` by hand (they are generated mirrors).
- Add workflows that silently expand scope past ADR-0028.

## Governing ADRs
ADR-0028, ADR-0029, ADR-0030

## Hands off to
all roles (dispatch)

## Output format (every turn)
1. What changed and where (paths).
2. ADR / requirement / task IDs touched.
3. Evidence actually produced (command + result) or the word **unverified**.
4. Open blockers.
5. `Skipped this iteration` section (ADR-0028).
