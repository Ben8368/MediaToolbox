import type {
  WebComposerPresetManifest,
  WebComposerPresetState,
  WebComposerSlotValue,
} from '@mediatoolbox/contracts'
import { describe, expect, it } from 'vitest'

import { validateWebComposerComposition } from './compositionValidation'
import { presets } from './presets'

const manifest: WebComposerPresetManifest = {
  id: 'lumora',
  version: 2,
  name: 'Test preset',
  style: 'Test',
  description: 'Composition validation fixture',
  designSize: { width: 1920, height: 1080 },
  upstreamSourceSha: 'source',
  upstreamStyleSha: 'style',
  slots: [
    {
      id: 'brand.logo',
      label: 'Logo',
      group: '页头',
      canHide: true,
      editors: {
        text: { multiline: false },
        image: { accept: 'image/*', fit: ['contain', 'cover'] },
      },
    },
    {
      id: 'background',
      label: '背景素材',
      group: '画布',
      canHide: true,
      editors: {
        media: { accept: 'image/*,video/*', kinds: ['video', 'image'], fit: ['cover', 'contain'] },
      },
    },
  ],
  defaults: {
    schemaVersion: 2,
    id: 'lumora',
    slots: {},
    theme: {
      headingFont: 'serif',
      bodyFont: 'sans-serif',
      accentColor: '#ffffff',
      textColor: '#ffffff',
    },
  },
}

const textLogo: WebComposerSlotValue = {
  activeKind: 'text',
  visible: true,
  offset: { x: 0, y: 0 },
  text: {
    value: 'Lumora',
    fontFamily: null,
    fontSize: null,
    fontWeight: null,
    color: null,
  },
  image: {
    src: '',
    alt: 'Logo',
    width: null,
    height: null,
    fit: 'contain',
  },
}

const background: WebComposerSlotValue = {
  activeKind: 'media',
  visible: true,
  offset: { x: 0, y: 0 },
  media: {
    kind: 'video',
    src: '/static/background.mp4',
    fit: 'cover',
  },
}

function createState(slots: Record<string, WebComposerSlotValue>): WebComposerPresetState {
  return {
    ...manifest.defaults,
    slots,
  }
}

describe('validateWebComposerComposition', () => {
  it('allows every shipped preset default composition', () => {
    for (const preset of presets) {
      expect(validateWebComposerComposition(preset, preset.defaults)).toEqual({
        valid: true,
        reason: null,
        slotId: null,
      })
    }
  })

  it('allows empty inactive image candidates', () => {
    expect(validateWebComposerComposition(manifest, createState({
      'brand.logo': textLogo,
      background,
    }))).toEqual({ valid: true, reason: null, slotId: null })
  })

  it('blocks a visible active image without a source', () => {
    const result = validateWebComposerComposition(manifest, createState({
      'brand.logo': { ...textLogo, activeKind: 'image' },
      background,
    }))

    expect(result).toEqual({
      valid: false,
      reason: '“Logo”尚未选择图片，无法导出。',
      slotId: 'brand.logo',
    })
  })

  it('blocks whitespace-only media sources', () => {
    const result = validateWebComposerComposition(manifest, createState({
      'brand.logo': textLogo,
      background: {
        ...background,
        media: { ...background.media!, src: '   ' },
      },
    }))

    expect(result).toEqual({
      valid: false,
      reason: '“背景素材”尚未选择媒体素材，无法导出。',
      slotId: 'background',
    })
  })

  it('ignores empty sources for hidden slots', () => {
    expect(validateWebComposerComposition(manifest, createState({
      'brand.logo': { ...textLogo, activeKind: 'image', visible: false },
      background,
    }))).toEqual({ valid: true, reason: null, slotId: null })
  })

  it('allows populated active image and media slots', () => {
    expect(validateWebComposerComposition(manifest, createState({
      'brand.logo': {
        ...textLogo,
        activeKind: 'image',
        image: { ...textLogo.image!, src: '/api/filebrowser/file?path=logo.png' },
      },
      background: {
        ...background,
        media: { ...background.media!, src: '/api/filebrowser/file?path=background.mp4' },
      },
    }))).toEqual({ valid: true, reason: null, slotId: null })
  })
})
