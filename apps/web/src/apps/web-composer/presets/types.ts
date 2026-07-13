import type { ComponentType } from 'react'
import type {
  WebComposerEditableField,
  WebComposerPresetManifest,
  WebComposerPresetState,
} from '@mediatoolbox/contracts'

export type PresetState = WebComposerPresetState
export type EditableField = WebComposerEditableField

export type PresetDefinition = WebComposerPresetManifest & {
  Component: ComponentType<{ state: PresetState }>
}
