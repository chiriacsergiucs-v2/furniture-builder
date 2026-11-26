import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateProject } from '../src/core/project';
import { sampleProjects } from './fixtures/mobila';

/**
 * The Dormitor project file the browser script tools/shapes/find-it.mjs imports is the generator's output (G-028: the
 * other sample files left docs/samples). `WRITE_SAMPLES=1 npx vitest run tests/samples-files.test.ts` rewrites it.
 */
describe('sample project file', () => {
  const s = sampleProjects.find((p) => p.id === 'mobila-dormitor')!;
  it(`${s.id}.project.json matches the generator and imports`, () => {
    const path = new URL(`./fixtures/${s.id}.project.json`, import.meta.url);
    const json = `${JSON.stringify(s.create(), null, 2)}\n`;
    if (process.env.WRITE_SAMPLES) writeFileSync(path, json);
    const text = readFileSync(path, 'utf8');
    expect(text).toBe(json);
    expect(validateProject(JSON.parse(text))).toEqual([]);
  });
});
