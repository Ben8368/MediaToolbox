import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const lockedFiles = {
  'MultiShowcasePreset.tsx': '4a7e89b57f289aceabb7696ec86c38fa7abc3f55f18ed7430e4b1beb843cc639',
  'LumoraPreset.tsx': '67ddfac07e1baa112d5e5c3bd46c8a36901d6f96a939860baee12a28eaf5df6d',
  'VaultShieldPreset.tsx': '4f1f4bedc003b4ecd7bc46421bab7d0d0af119362d5233b5d4694981c5178365',
  'ViktorPreset.tsx': '7600f7482f6ff60ed5de756ae7c01c75d6c23f65150fa7c372bc8ce7efd8cdb5',
  'presets.css': 'f69abb393065791346ae9e08d49e6a7bd49bda01e1ef54dd65bfc55a61a8cc9d',
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
