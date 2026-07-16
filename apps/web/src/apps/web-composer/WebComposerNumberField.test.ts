import { describe, expect, it } from 'vitest'

import {
  committedNullableNumberValue,
  liveNullableNumberValue,
} from './WebComposerNumberField'

const dimensionControl = { min: 8, max: 960, step: 1 }

describe('WebComposerNumberField', () => {
  it('keeps an incomplete below-min digit as a draft until the full value is valid', () => {
    expect(liveNullableNumberValue('2', dimensionControl)).toBeUndefined()
    expect(liveNullableNumberValue('20', dimensionControl)).toBe(20)
  })

  it('normalizes an unfinished draft when the field is committed', () => {
    expect(committedNullableNumberValue('2', dimensionControl, 200)).toBe(8)
    expect(committedNullableNumberValue('999', dimensionControl, 200)).toBe(960)
  })

  it('supports clearing an override and preserves the fallback for invalid drafts', () => {
    expect(liveNullableNumberValue('', dimensionControl)).toBeNull()
    expect(committedNullableNumberValue('', dimensionControl, 200)).toBeNull()
    expect(committedNullableNumberValue('invalid', dimensionControl, 200)).toBe(200)
  })

  it('only publishes live values aligned to the declared step', () => {
    const control = { min: 0, max: 10, step: 0.5 }

    expect(liveNullableNumberValue('1.24', control)).toBeUndefined()
    expect(liveNullableNumberValue('1.5', control)).toBe(1.5)
    expect(committedNullableNumberValue('1.24', control, null)).toBe(1)
  })
})
