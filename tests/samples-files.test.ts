import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateProject } from '../src/core/project'
import { sampleProjects } from '../src/core/samples/mobila'

/** The importable project files in docs/samples are the generator's output. `WRITE_SAMPLES=1 npx vitest run tests/samples-files.test.ts` rewrites them. */
describe('sample project files', () => {
  for (const s of sampleProjects) {
    it(`${s.id}.project.json matches the generator and imports`, () => {
      const path = new URL(`../docs/samples/${s.id}.project.json`, import.meta.url)
      const json = `${JSON.stringify(s.create(), null, 2)}\n`
      if (process.env.WRITE_SAMPLES) writeFileSync(path, json)
      const text = readFileSync(path, 'utf8')
      expect(text).toBe(json)
      expect(validateProject(JSON.parse(text))).toEqual([])
    })
  }
})
