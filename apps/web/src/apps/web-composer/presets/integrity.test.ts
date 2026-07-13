import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'LumoraPreset.tsx': 'da14d78a29ed8a87bd743b669c722dc9974ae171a2e6176fbfc275edc7edc815',
  'VaultShieldPreset.tsx': '78b619e24ed8fb0ab4fd60ab09c3329699f5bd09f1e327f5b7d57b3ae063e3f7',
  'ViktorPreset.tsx': 'f4b6a09167d34e6ce8c3c751d8fccc153ce09328b59ad1f7a76b02a4a7dfb595',
  'presets.css': 'd3923b820ab4921335599339e00d336f09f459c776e0a406c82e21be87f994cb',
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
