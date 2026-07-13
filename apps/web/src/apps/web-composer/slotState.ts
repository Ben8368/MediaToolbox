import type {
  WebComposerIconContent,
  WebComposerImageContent,
  WebComposerMediaContent,
  WebComposerNumberControl,
  WebComposerPresetState,
  WebComposerSlotContentKind,
  WebComposerSlotValue,
  WebComposerTextContent,
} from '@mediatoolbox/contracts'

type SlotValueUpdater = (value: WebComposerSlotValue) => WebComposerSlotValue

function decimalPlaces(value: number) {
  const [, fraction = ''] = String(value).toLowerCase().split('.')
  if (!String(value).toLowerCase().includes('e-')) return fraction.length
  const exponent = Number(String(value).toLowerCase().split('e-')[1] ?? 0)
  return exponent
}

export function clampSlotNumber(value: number, control: WebComposerNumberControl) {
  const minimum = Math.min(control.min, control.max)
  const maximum = Math.max(control.min, control.max)
  const finiteValue = Number.isFinite(value) ? value : minimum
  const bounded = Math.min(maximum, Math.max(minimum, finiteValue))

  if (!Number.isFinite(control.step) || control.step <= 0) return bounded

  const steps = Math.round((bounded - minimum) / control.step)
  const snapped = Math.min(maximum, Math.max(minimum, minimum + steps * control.step))
  const precision = Math.max(
    decimalPlaces(minimum),
    decimalPlaces(maximum),
    decimalPlaces(control.step),
  )
  return Number(snapped.toFixed(Math.min(precision, 12)))
}

export function updateSlotValue(
  state: WebComposerPresetState,
  slotId: string,
  updater: SlotValueUpdater,
) {
  const current = state.slots[slotId]
  if (!current) return state

  const next = updater(current)
  if (next === current) return state
  return {
    ...state,
    slots: {
      ...state.slots,
      [slotId]: next,
    },
  }
}

export function setSlotActiveKind(
  state: WebComposerPresetState,
  slotId: string,
  activeKind: WebComposerSlotContentKind,
) {
  return updateSlotValue(state, slotId, (value) => {
    if (value.activeKind === activeKind || value[activeKind] === undefined) return value
    return { ...value, activeKind }
  })
}

export function setSlotVisibility(
  state: WebComposerPresetState,
  slotId: string,
  visible: boolean,
) {
  return updateSlotValue(state, slotId, (value) => (
    value.visible === visible ? value : { ...value, visible }
  ))
}

export function setSlotOffset(
  state: WebComposerPresetState,
  slotId: string,
  axis: 'x' | 'y',
  value: number,
  control: WebComposerNumberControl,
) {
  return updateSlotValue(state, slotId, (slotValue) => {
    const nextValue = clampSlotNumber(value, control)
    if (slotValue.offset[axis] === nextValue) return slotValue
    return {
      ...slotValue,
      offset: { ...slotValue.offset, [axis]: nextValue },
    }
  })
}

export function updateSlotText(
  state: WebComposerPresetState,
  slotId: string,
  patch: Partial<WebComposerTextContent>,
) {
  return updateSlotValue(state, slotId, (value) => (
    value.text ? { ...value, text: { ...value.text, ...patch } } : value
  ))
}

export function updateSlotIcon(
  state: WebComposerPresetState,
  slotId: string,
  patch: Partial<WebComposerIconContent>,
) {
  return updateSlotValue(state, slotId, (value) => (
    value.icon ? { ...value, icon: { ...value.icon, ...patch } } : value
  ))
}

export function updateSlotImage(
  state: WebComposerPresetState,
  slotId: string,
  patch: Partial<WebComposerImageContent>,
) {
  return updateSlotValue(state, slotId, (value) => (
    value.image ? { ...value, image: { ...value.image, ...patch } } : value
  ))
}

export function updateSlotMedia(
  state: WebComposerPresetState,
  slotId: string,
  patch: Partial<WebComposerMediaContent>,
) {
  return updateSlotValue(state, slotId, (value) => (
    value.media ? { ...value, media: { ...value.media, ...patch } } : value
  ))
}
