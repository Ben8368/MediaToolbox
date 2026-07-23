import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { presets } from './index'

const lockedFiles = {
  'MultiShowcasePreset.tsx': '4a7e89b57f289aceabb7696ec86c38fa7abc3f55f18ed7430e4b1beb843cc639',
  'LumoraPreset.tsx': '67ddfac07e1baa112d5e5c3bd46c8a36901d6f96a939860baee12a28eaf5df6d',
  'VaultShieldPreset.tsx': '4f1f4bedc003b4ecd7bc46421bab7d0d0af119362d5233b5d4694981c5178365',
  'ViktorPreset.tsx': '7600f7482f6ff60ed5de756ae7c01c75d6c23f65150fa7c372bc8ce7efd8cdb5',
  'presets.css': 'f69abb393065791346ae9e08d49e6a7bd49bda01e1ef54dd65bfc55a61a8cc9d',
  'TraceGridPreset.tsx': '7b03069c233eef347337b91a5b152a0a1d42b04e04b3370c94dbfbb7daa70c91',
  'trace-grid.css': '45829e4f1961d9bb956fc26289f3d8f6c5286974a5084ad5136c3d68a4665b49',
  'VexVisionPreset.tsx': '36149f8ff4a9244f2ab470760bcb44e2c880a6b2d163ee0792109aeabd9524e1',
  'vex-vision.css': '536e5e5ccb8b35398d32df8d73af23063830b3b96689d9e2de6226d3f69cb071',
} as const

describe('locked web composer preset sources', () => {
  for (const [filename, expected] of Object.entries(lockedFiles)) {
    it(`keeps ${filename} unchanged for its declared preset version`, () => {
      const path = fileURLToPath(new URL(filename, import.meta.url))
      const actual = createHash('sha256').update(fs.readFileSync(path)).digest('hex')
      expect(actual).toBe(expected)
    })
  }
})

describe('web composer background exports', () => {
  it('provides a background slot for every preset', () => {
    for (const preset of presets) {
      expect(preset.slots.some((slot) => slot.id === 'background')).toBe(true)
    }
  })
})
