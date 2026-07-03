import { describe, expect, it, vi } from 'vitest'
import type { PsdEngine, PsdTemplateManifest } from '@mediatoolbox/psd-core'

import { createPsdEngineFromEnv, PsdWorkerEngineNotConfiguredError, PsdWorkerInputError, runPsdWorkerJob, validateRenderInput } from './index.js'

const template: PsdTemplateManifest = {
  id: 'promo',
  name: 'Promo',
  version: 1,
  document: { width: 1080, height: 1080 },
  slots: [
    { id: 'headline', kind: 'text', label: 'Headline', layerPath: ['headline'], required: true },
    { id: 'badge', kind: 'text', label: 'Badge', layerPath: ['badge'], required: false },
  ],
}

describe('runPsdWorkerJob', () => {
  it('requires an explicit PSD engine adapter', async () => {
    await expect(runPsdWorkerJob({ type: 'inspect', psdPath: 'template.psd' })).rejects.toBeInstanceOf(PsdWorkerEngineNotConfiguredError)
  })

  it('delegates inspect and render to the configured engine', async () => {
    const engine: PsdEngine = {
      inspect: vi.fn(async () => template),
      render: vi.fn(async () => ({ outputPath: '/Workspace/Exports/promo.png' })),
    }

    await expect(runPsdWorkerJob({ type: 'inspect', psdPath: 'template.psd' }, { engine })).resolves.toEqual({ type: 'inspect', manifest: template })
    await expect(runPsdWorkerJob({ type: 'render', template, input: { headline: 'Sale' } }, { engine })).resolves.toEqual({
      type: 'render',
      outputPath: '/Workspace/Exports/promo.png',
    })
  })

  it('creates a Photoshop adapter from explicit environment configuration', () => {
    expect(createPsdEngineFromEnv({ MEDIATOOLBOX_PHOTOSHOP_COMMAND: 'photoshop-adapter' })).toBeDefined()
    expect(createPsdEngineFromEnv({})).toBeUndefined()
  })
})

describe('validateRenderInput', () => {
  it('rejects missing required slots before calling Photoshop adapters', () => {
    expect(() => validateRenderInput(template, {})).toThrow(PsdWorkerInputError)
  })
})
