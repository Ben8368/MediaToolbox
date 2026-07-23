import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { presets } from '../apps/web-composer/presets'
import { WebComposerPresetDialog } from '../apps/web-composer/WebComposerPresetPicker'
import { PresetStandaloneToolbar } from './PresetStandalonePage'

describe('standalone preset preview', () => {
  it('renders a preset selector alongside the aspect ratio controls', () => {
    const preset = presets.find((item) => item.id === 'vex-vision')
    expect(preset).toBeDefined()
    if (!preset) return

    const markup = renderToStaticMarkup(
      <PresetStandaloneToolbar
        preset={preset}
        aspectRatio="16:9"
        presetDialogOpen={false}
        onOpenPresetDialog={vi.fn()}
        onChangeAspectRatio={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="\u9009\u62e9\u9884\u8bbe\uff1aVEX Vision"')
    expect(markup).toContain('aria-label="\u9009\u62e9\u753b\u5e45"')
    expect(markup).toContain('16:9')
  })

  it('shares the full preset dialog with the workbench picker', () => {
    const markup = renderToStaticMarkup(
      <WebComposerPresetDialog
        activePresetId="vex-vision"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="\u9009\u62e9\u9884\u8bbe"')
    for (const preset of presets) expect(markup).toContain(preset.name)
  })
})
