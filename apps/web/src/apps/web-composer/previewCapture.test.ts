import { describe, expect, it } from 'vitest'

import { objectFitRect } from './previewCapture'

describe('objectFitRect', () => {
  it('covers the export canvas while preserving the source aspect ratio', () => {
    expect(objectFitRect(1920, 1080, 1080, 1080, 'cover')).toEqual({
      x: -420,
      y: 0,
      width: 1920,
      height: 1080,
    })
  })

  it('contains the source when that fit mode is requested', () => {
    expect(objectFitRect(1920, 1080, 1080, 1080, 'contain')).toEqual({
      x: 0,
      y: 236.25,
      width: 1080,
      height: 607.5,
    })
  })
})
