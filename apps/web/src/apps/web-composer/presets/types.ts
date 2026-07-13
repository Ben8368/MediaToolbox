import type { ComponentType } from 'react'
import type { WebComposerPresetManifest, WebComposerPresetState } from '@mediatoolbox/contracts'

import type { PresetViewport } from './shared'

export type PresetState = WebComposerPresetState

export type PresetDefinition = WebComposerPresetManifest & {
  Component: ComponentType<{ state: PresetState; viewport: PresetViewport }>
}
