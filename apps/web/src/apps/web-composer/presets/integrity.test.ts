import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'LumoraPreset.tsx': '1510eb02ea8872bb6cff7d9be770e4282584d0a657e741c95a4b2fe5f368e86b',
  'VaultShieldPreset.tsx': '78b619e24ed8fb0ab4fd60ab09c3329699f5bd09f1e327f5b7d57b3ae063e3f7',
  'ViktorPreset.tsx': '4dbf058c9dee1907e14a99f4f4301a29cf2b45ce677d324e9435cbab87f172a8',
  'presets.css': '8685bb39b305127876f4c1d4a32200ca6cdf23e86f90e6d2217e0a07ad9847b6',
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
