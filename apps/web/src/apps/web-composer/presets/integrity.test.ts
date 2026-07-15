import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'LumoraPreset.tsx': '1510eb02ea8872bb6cff7d9be770e4282584d0a657e741c95a4b2fe5f368e86b',
  'VaultShieldPreset.tsx': '60b3402d3667d0131ab89167f1f6a0e3ad8187e1f7c6d3abeaccb690fdbace3e',
  'ViktorPreset.tsx': '4dbf058c9dee1907e14a99f4f4301a29cf2b45ce677d324e9435cbab87f172a8',
  'presets.css': '44ced91b47f65176df4a414edb4c59f8e42628a24de883bbf454f3f308e10f7e',
} as const

describe('locked web composer preset sources', () => {
  for (const [filename, expected] of Object.entries(lockedFiles)) {
    it(`keeps ${filename} unchanged for preset version 2`, () => {
      const path = fileURLToPath(new URL(filename, import.meta.url))
      const actual = createHash('sha256').update(fs.readFileSync(path)).digest('hex')
      expect(actual).toBe(expected)
    })
  }
})
