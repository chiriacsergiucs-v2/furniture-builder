# GitHub Pages deployment

Repository: https://github.com/chiriacsergiucs-v2/furniture-builder
Potential site: https://chiriacsergiucs-v2.github.io/furniture-builder/
Vite base: `/furniture-builder/`; PWA scope/start_url match; hash navigation avoids path rewrites.

1. Commit all source code, generate and commit package-lock.json, replace temporary npm install steps with npm ci.
2. Verify full CI locally or in GitHub Actions. Enable Pages from Actions in the repository Settings if account supports Pages for this private repo. **Do not change repo visibility automatically.**
3. Run deploy workflow on main, verify live assets, scope, service worker registration, offline reload, and Android installation before marking G10 passed.
4. GitHub Pages does not receive any customer project files. Project data lives only in browser localStorage.

Current status: NOT DEPLOYED / NOT VERIFIED.
