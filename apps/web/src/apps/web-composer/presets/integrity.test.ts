import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'LumoraPreset.tsx': '67ddfac07e1baa112d5e5c3bd46c8a36901d6f96a939860baee12a28eaf5df6d',
  'VaultShieldPreset.tsx': '4f1f4bedc003b4ecd7bc46421bab7d0d0af119362d5233b5d4694981c5178365',
  'ViktorPreset.tsx': '7600f7482f6ff60ed5de756ae7c01c75d6c23f65150fa7c372bc8ce7efd8cdb5',
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
