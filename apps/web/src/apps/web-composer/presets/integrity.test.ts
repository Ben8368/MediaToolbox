import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'LumoraPreset.tsx': 'e1cd4173b8dfd6004163e4399af3a6abcd06b39303f6293e539d0b433792bb31',
  'VaultShieldPreset.tsx': '78b619e24ed8fb0ab4fd60ab09c3329699f5bd09f1e327f5b7d57b3ae063e3f7',
  'ViktorPreset.tsx': '86813aef0d00515c2d13132e4de9450a599ddacf7fde95059465d929026d5ff5',
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
