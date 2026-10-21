# Dependencies (from `package.json` at the indexed commit)

| Package | Version | Role | Licence (per docs/licences.md) | Network side-effects |
|---|---|---|---|---|
| react / react-dom | ^19.1.1 | UI | MIT | none |
| dexie | 4.2.1 | IndexedDB wrapper | Apache-2.0 | none (no Dexie Cloud) |
| exceljs | ^4.4.0 | XLSX read/write (lazy) | MIT (to confirm, TSK-011) | none |
| three / @react-three/fiber | 0.186.1 / 9.8.1 | 3D preview (lazy) | MIT | none |
| @dnd-kit/core, sortable, utilities | 6.3.1 / 10.0.0 / 3.2.2 | reorder | MIT | none |
| vite, @vitejs/plugin-react, vite-plugin-pwa | ^7.1 / ^5.0 / ^1.0.3 | build, PWA | dev | — |
| typescript, eslint, typescript-eslint | ^5.9 / ^9.33 / ^8.40 | dev | dev | — |
| vitest, @playwright/test, fake-indexeddb | ^3.2 / ^1.55 / 6.2.5 | tests | dev; fake-indexeddb Apache-2.0 | — |
| @types/* | — | dev types | MIT | — |

Rules: a new runtime dependency needs a licence row, a lazy-load decision (ADR-0027), a network check (ADR-0002)
and the bot `lockfile.yml` run before CI/deploy claims (ADR-0029). Transitive audit is TSK-011.
