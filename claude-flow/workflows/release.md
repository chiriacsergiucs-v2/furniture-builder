# Release

1. PR from a branch; CI `verify` green (lint, typecheck, tests, build).
2. Lockfile committed; `npm ci` clean.
3. No third-party origins in `dist/`; base path `/furniture-builder/`.
4. README claims match behaviour (guidance labelled as guidance; nothing claimed for unrun checks).
5. Merge **only on the user's instruction**. Then cite the `Deploy GitHub Pages` run id. "Live-verified" only if
   someone opened the published URL and checked it.
