import type {
  WebComposerPresetManifest,
  WebComposerPresetState,
  WebComposerSlotContentKind,
} from '@mediatoolbox/contracts'

export type WebComposerCompositionValidation = {
  valid: boolean
  reason: string | null
  slotId: string | null
}

function missingSourceReason(label: string, kind: Extract<WebComposerSlotContentKind, 'image' | 'media'>) {
  const sourceLabel = kind === 'image' ? '图片' : '媒体素材'
  return `“${label}”尚未选择${sourceLabel}，无法导出。`
}

export function validateWebComposerComposition(
  manifest: WebComposerPresetManifest,
  state: WebComposerPresetState,
): WebComposerCompositionValidation {
  for (const slot of manifest.slots) {
    const value = state.slots[slot.id]
    if (!value || !value.visible) continue

    if (value.activeKind === 'image' && !value.image?.src.trim()) {
      return {
        valid: false,
        reason: missingSourceReason(slot.label, 'image'),
        slotId: slot.id,
      }
    }

    if (value.activeKind === 'media' && !value.media?.src.trim()) {
      return {
        valid: false,
        reason: missingSourceReason(slot.label, 'media'),
        slotId: slot.id,
      }
    }
  }

  return { valid: true, reason: null, slotId: null }
}
