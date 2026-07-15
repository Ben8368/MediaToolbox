import type {
  WebComposerPresetState,
  WebComposerSlotValue,
  WebComposerTextContent,
} from '@mediatoolbox/contracts'

import { updateSlotText } from '../slotState'

const vaultShieldHeadingSlotIds = new Set([
  'hero.heading.start',
  'hero.heading.middle',
  'hero.heading.end',
])

const vaultShieldHeadingIconSlotIds = [
  'hero.icon.zap',
  'hero.icon.lock',
  'hero.icon.fingerprint',
]

/**
 * VaultShield's default inline icons describe its stock password-security
 * headline. Once that headline is edited, hide the inherited decorations so
 * the composition does not imply claims that no longer match the copy.
 */
export function updateVaultShieldHeadingText(
  state: WebComposerPresetState,
  slotId: string,
  patch: Partial<WebComposerTextContent>,
) {
  const next = updateSlotText(state, slotId, patch)
  const titleChanged = typeof patch.value === 'string'
    && state.slots[slotId]?.text?.value !== patch.value

  if (!titleChanged || !vaultShieldHeadingSlotIds.has(slotId)) return next

  const hiddenIconSlots = vaultShieldHeadingIconSlotIds.reduce<Record<string, WebComposerSlotValue>>(
    (slots, iconSlotId) => {
      const iconSlot = next.slots[iconSlotId]
      if (iconSlot) slots[iconSlotId] = { ...iconSlot, visible: false }
      return slots
    },
    {},
  )

  return {
    ...next,
    slots: {
      ...next.slots,
      ...hiddenIconSlots,
    },
  }
}

export function isVaultShieldHeadingIconVisible(state: WebComposerPresetState, slotId: string) {
  return state.slots[slotId]?.visible !== false
}
