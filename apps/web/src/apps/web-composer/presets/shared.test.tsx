import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { WebComposerPresetState } from '@mediatoolbox/contracts'

import { PresetSlotContent } from './shared'

const state: WebComposerPresetState = {
  schemaVersion: 2,
  id: 'multi-showcase',
  slots: {
    logo: {
      activeKind: 'image',
      visible: true,
      offset: { x: 0, y: 0 },
      image: {
        src: '/static/logo.png',
        alt: 'Logo',
        width: 160,
        height: null,
        fit: 'contain',
      },
    },
  },
  theme: {
    headingFont: 'sans-serif',
    bodyFont: 'sans-serif',
    accentColor: '#000000',
    textColor: '#000000',
  },
}

describe('preset image sizing', () => {
  it('keeps image logos proportional when only one size dimension is set', () => {
    const markup = renderToStaticMarkup(
      <PresetSlotContent
        state={state}
        slotId="logo"
        viewport={{ width: 1920, height: 1080, designWidth: 1920, designHeight: 1080 }}
      />,
    )

    expect(markup).toContain('width:160px;height:auto')
  })
})
