import { describe, expect, it } from 'vitest'

import {
  buildPhotoshopInspectScript,
  buildPhotoshopRenderScript,
  createPhotoshopPsdEngine,
  PhotoshopPsdEngineError,
  type PsdTemplateManifest,
} from './index.js'

const template: PsdTemplateManifest = {
  id: 'promo',
  name: 'Promo',
  version: 1,
  sourcePath: 'C:/Workspace/PSD/promo.psd',
  document: { width: 1080, height: 1080 },
  slots: [
    { id: 'headline', kind: 'text', label: 'Headline', layerPath: ['Headline'], required: true },
    { id: 'image', kind: 'smart-object', label: 'Image', layerPath: ['Image'], required: false },
  ],
}

describe('Photoshop PSD adapter', () => {
  it('builds JSX scripts that isolate file paths and slot values as JSON', () => {
    const inspectScript = buildPhotoshopInspectScript('C:/Workspace/PSD/promo.psd')
    const renderScript = buildPhotoshopRenderScript({
      template,
      input: { headline: 'Summer Sale' },
      outputPath: 'C:/Workspace/Exports/promo.png',
    })

    expect(inspectScript).toContain('__MTB_JSON__')
    expect(renderScript).toContain('Summer Sale')
    expect(renderScript).toContain('C:/Workspace/Exports/promo.png')
  })

  it('parses inspect output and delegates render to the configured script runner', async () => {
    const scripts: string[] = []
    const engine = createPhotoshopPsdEngine({
      runScript: async (script) => {
        scripts.push(script)
        return `noise\n__MTB_JSON__${JSON.stringify(template)}`
      },
    })

    await expect(engine.inspect(template.sourcePath!)).resolves.toMatchObject({ id: 'promo', sourcePath: template.sourcePath })
    await expect(engine.render(template, { headline: 'Sale', __outputPath: 'C:/Workspace/Exports/out.png' })).resolves.toEqual({
      outputPath: 'C:/Workspace/Exports/out.png',
    })
    expect(scripts).toHaveLength(2)
  })

  it('rejects render calls without a source PSD path', async () => {
    const engine = createPhotoshopPsdEngine({ runScript: async () => '{}' })
    const { sourcePath: _sourcePath, ...withoutSource } = template

    await expect(engine.render(withoutSource, { headline: 'Sale' })).rejects.toBeInstanceOf(PhotoshopPsdEngineError)
  })
})
