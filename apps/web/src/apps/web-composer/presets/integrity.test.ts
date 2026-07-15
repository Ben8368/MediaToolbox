import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'LumoraPreset.tsx': '1510eb02ea8872bb6cff7d9be770e4282584d0a657e741c95a4b2fe5f368e86b',
  'VaultShieldPreset.tsx': '4f1f4bedc003b4ecd7bc46421bab7d0d0af119362d5233b5d4694981c5178365',
  'ViktorPreset.tsx': '4dbf058c9dee1907e14a99f4f4301a29cf2b45ce677d324e9435cbab87f172a8',
  'presets.css': '51c9e3104bd5879bafe6d73cf4f9802651f6424843a718035516eba777548a18',
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
