// Reads the --json report of tools/mobile-middle/find-it.mjs and passes only when at least one check whose name
// matches the pattern ran and every such check passed (goal file goals/mobile-middle-ground.md, ADR-295).
//   node tools/mobile-middle/report-check.mjs <report.json> <regex>
import { readFileSync } from 'node:fs';

const [file, pattern] = process.argv.slice(2);
const { results } = JSON.parse(readFileSync(file, 'utf8'));
const re = new RegExp(pattern, 'i');
const hits = results.filter((r) => re.test(r.name));
for (const r of hits) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.width}px ${r.name}`);
if (!hits.length) console.log(`no check matches /${pattern}/`);
process.exit(hits.length && hits.every((r) => r.ok) ? 0 : 1);
