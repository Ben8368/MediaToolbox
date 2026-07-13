import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'LumoraPreset.tsx': '0f551678ac613cc9265aa9391b02e778534992ba3dccef7c3420f8537cd057f6',
  'VaultShieldPreset.tsx': '55ddc4343c1b434e616cdb3bf6b14dcd2e0973a56629f9fa334575eff11c382c',
  'ViktorPreset.tsx': '20f8986b5830a52adddd5f1250a1daa986de9fa0f93624341e0ed6edc465c95b',
  'presets.css': 'd3923b820ab4921335599339e00d336f09f459c776e0a406c82e21be87f994cb',
} as const

describe('locked web composer preset sources', () => {
  for (const [filename, expected] of Object.entries(lockedFiles)) {
    it(`keeps ${filename} unchanged for preset version 1`, () => {
      const path = fileURLToPath(new URL(filename, import.meta.url))
      const actual = createHash('sha256').update(fs.readFileSync(path)).digest('hex')
      expect(actual).toBe(expected)
    })
  }
})
