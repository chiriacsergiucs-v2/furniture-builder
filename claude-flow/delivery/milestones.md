# Milestones (GENERATED from docs/progress.json)

Current step: `STEP_12` · status `in_progress` · next action: Complete B24 with a dedicated bed support/slat generator and wardrobe door/rail components, each with independent manufacturing and installation validation. Do not count conceptual 90 variants as ready.

| STEP | Title | Status | Notes |
|---|---|---|---|
| STEP_00 | Repository and dependency audit | `pending` | Audit incomplete |
| STEP_01 | Bootstrap application | `implemented_unverified` | Requires dependency install and/or further tests |
| STEP_02 | Manufacturing data model | `verified_partial` | Local standalone geometry tests passed, production acceptance pending |
| STEP_03 | Dexie IndexedDB persistence and legacy migration | `verified` | GitHub CI 38028499465 (Vitest + Playwright); full database JSON restore tested |
| STEP_04 | Project editor | `implemented_unverified` | Requires dependency install and/or further tests |
| STEP_05 | Guillotine optimization engine | `verified_partial` | Local standalone geometry tests passed, production acceptance pending |
| STEP_06 | Cutting validation and test suite | `verified_partial` | Local standalone geometry tests passed, production acceptance pending |
| STEP_07 | Interactive cutting diagrams | `implemented_unverified` | Requires dependency install and/or further tests |
| STEP_08 | Statistics and material calculations | `implemented_unverified` | Requires dependency install and/or further tests |
| STEP_09 | Import and export | `implemented_unverified` | Requires dependency install and/or further tests |
| STEP_10 | PWA and offline functionality | `verified_partial` | Offline PWA Chromium Playwright test passed; real Android device test pending |
| STEP_11 | GitHub Pages and CI/CD | `verified` | GitHub Pages workflow 38028499287 succeeded at f7f38e7; external HTTP fetch unavailable |
| STEP_12 | User experience and resilience | `implemented_unverified` | Requires dependency install and/or further tests |
| STEP_13 | End-to-end verification | `pending` |  |
| STEP_14 | Release and documentation | `pending` |  |

## Gates

| Gate | Value |
|---|---|
| G1 | `client_only_dexie_exception_approved_no_backend` |
| G2 | `verified_chromium_e2e` |
| G3 | `pending_full_verification` |
| G4 | `pending_full_verification` |
| G5 | `pending_full_verification` |
| G6 | `pending_full_verification` |
| G7 | `verified_project_preset_full_json_tests` |
| G8 | `verified_mobile_viewports_playwright` |
| G9 | `verified_chromium_playwright` |
| G10 | `github_pages_deployment_succeeded_http_external_not_checked` |

Last evidence recorded in progress.json: CI https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38028499465; deploy https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38028499287

All CI/Pages run IDs here are **reported** by the repo docs, not re-executed by this folder (ADR-0029).
