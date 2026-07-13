import type { WebComposerPresetId, WebComposerPresetState, WebComposerSlotValue } from '@mediatoolbox/contracts'

import { LumoraPreset } from './LumoraPreset'
import { lumoraManifest } from './manifests/lumora'
import { vaultShieldManifest } from './manifests/vaultshield'
import { viktorManifest } from './manifests/viktor'
import type { PresetDefinition } from './types'
import { VaultShieldPreset } from './VaultShieldPreset'
import { ViktorPreset } from './ViktorPreset'

export const presets: PresetDefinition[] = [
  { ...lumoraManifest, Component: LumoraPreset },
  { ...vaultShieldManifest, Component: VaultShieldPreset },
  { ...viktorManifest, Component: ViktorPreset },
]

export const presetById = new Map(presets.map((preset) => [preset.id, preset]))

function cloneSlotValue(value: WebComposerSlotValue): WebComposerSlotValue {
  return {
    ...value,
    offset: { ...value.offset },
    ...(value.text ? { text: { ...value.text } } : {}),
    ...(value.icon ? { icon: { ...value.icon } } : {}),
    ...(value.image ? { image: { ...value.image } } : {}),
    ...(value.media ? { media: { ...value.media } } : {}),
  }
}

export function clonePresetState(state: WebComposerPresetState): WebComposerPresetState {
  return {
    ...state,
    slots: Object.fromEntries(Object.entries(state.slots).map(([id, value]) => [id, cloneSlotValue(value)])),
    theme: { ...state.theme },
  }
}

export function createPresetState(presetId: WebComposerPresetId) {
  const preset = presetById.get(presetId) ?? presets[0]
  return clonePresetState(preset.defaults)
}
