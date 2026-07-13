import { describe, expect, it } from 'vitest'
import type {
  WebComposerPresetState,
  WebComposerSlotValue,
} from '@mediatoolbox/contracts'

import {
  clampSlotNumber,
  setSlotActiveKind,
  setSlotOffset,
  setSlotVisibility,
  updateSlotText,
} from './slotState'

function createState(slot: WebComposerSlotValue): WebComposerPresetState {
  return {
    schemaVersion: 2,
    id: 'lumora',
    slots: { heading: slot },
    theme: {
      headingFont: 'serif',
      bodyFont: 'sans-serif',
      accentColor: '#ffffff',
      textColor: '#eeeeee',
    },
  }
}

const textSlot: WebComposerSlotValue = {
  activeKind: 'text',
  visible: true,
  offset: { x: 0, y: 0 },
  text: {
    value: 'Heading',
    fontFamily: null,
    fontSize: null,
    fontWeight: null,
    color: null,
  },
  icon: {
    iconId: 'sparkles',
    size: 24,
    color: null,
  },
}

describe('web composer slot state', () => {
  it('clamps and snaps numeric controls to their declared step', () => {
    const control = { min: -10, max: 10, step: 0.5 }
    expect(clampSlotNumber(-99, control)).toBe(-10)
    expect(clampSlotNumber(99, control)).toBe(10)
    expect(clampSlotNumber(1.24, control)).toBe(1)
    expect(clampSlotNumber(1.26, control)).toBe(1.5)
    expect(clampSlotNumber(Number.NaN, control)).toBe(-10)
  })

  it('updates a slot immutably without changing sibling state branches', () => {
    const state = createState(textSlot)
    const next = updateSlotText(state, 'heading', { value: 'Updated' })

    expect(next).not.toBe(state)
    expect(next.slots).not.toBe(state.slots)
    expect(next.slots.heading).not.toBe(state.slots.heading)
    expect(next.slots.heading?.text?.value).toBe('Updated')
    expect(next.theme).toBe(state.theme)
    expect(state.slots.heading?.text?.value).toBe('Heading')
  })

  it('clamps offsets and keeps missing slots unchanged', () => {
    const state = createState(textSlot)
    const next = setSlotOffset(state, 'heading', 'x', 47, { min: -20, max: 20, step: 2 })

    expect(next.slots.heading?.offset.x).toBe(20)
    expect(setSlotOffset(state, 'missing', 'x', 5, { min: -20, max: 20, step: 1 })).toBe(state)
  })

  it('only activates content candidates that exist on the slot', () => {
    const state = createState(textSlot)
    const iconState = setSlotActiveKind(state, 'heading', 'icon')

    expect(iconState.slots.heading?.activeKind).toBe('icon')
    expect(setSlotActiveKind(state, 'heading', 'image')).toBe(state)
  })

  it('keeps hidden content values available for restoration', () => {
    const state = createState(textSlot)
    const hidden = setSlotVisibility(state, 'heading', false)
    const restored = setSlotVisibility(hidden, 'heading', true)

    expect(hidden.slots.heading?.visible).toBe(false)
    expect(hidden.slots.heading?.text?.value).toBe('Heading')
    expect(restored.slots.heading?.visible).toBe(true)
    expect(restored.slots.heading?.text?.value).toBe('Heading')
  })
})
