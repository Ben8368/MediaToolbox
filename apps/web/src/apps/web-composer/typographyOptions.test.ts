import { describe, expect, it } from 'vitest'

import { fontWeightLabel, getFontOptions, getFontSizeOptions, webComposerFontOptions } from './typographyOptions'

describe('web composer typography options', () => {
  it('keeps preset and legacy custom fonts selectable', () => {
    expect(getFontOptions("'Instrument Serif', serif")).toBe(webComposerFontOptions)
    expect(getFontOptions("'Legacy Display', serif")[0]).toEqual({
      label: '当前自定义字体',
      value: "'Legacy Display', serif",
    })
  })

  it('offers common sizes within the manifest range and preserves a custom value', () => {
    expect(getFontSizeOptions({ min: 12, max: 40, step: 2 }, 26)).toEqual([12, 14, 16, 18, 20, 24, 26, 28, 32, 36, 40])
  })

  it('adds readable labels to font weights', () => {
    expect(fontWeightLabel(400)).toBe('400 · 常规')
    expect(fontWeightLabel(700)).toBe('700 · 粗体')
  })
})
