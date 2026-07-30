import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { wandorManifest, wandorVideoSource } from './manifests/wandor'
import { WandorPreset } from './WandorPreset'

const viewport = { width: 1920, height: 1080, designWidth: 1920, designHeight: 1080 }

describe('Wandor preset', () => {
  it('uses the installed looping video, travel copy, and liquid-glass prompt card', () => {
    const markup = renderToStaticMarkup(<WandorPreset state={wandorManifest.defaults} viewport={viewport} />)

    expect(markup).toContain(`src="${wandorVideoSource}"`)
    expect(markup).toContain('autoplay=""')
    expect(markup).toContain('muted=""')
    expect(markup).toContain('loop=""')
    expect(markup).toContain('playsinline=""')
    expect(markup).toContain('Where will you go next?')
    expect(markup).toContain('Upload inspiration')
    expect(markup).toContain('accept="image/*,.pdf"')
  })

  it('renders a user-replaced image background instead of the default video', () => {
    const state = structuredClone(wandorManifest.defaults)
    state.slots.background.media = { kind: 'image', src: '/api/filebrowser/file?path=%2FWorkspace%2Fwandor.jpg', fit: 'cover' }
    const markup = renderToStaticMarkup(<WandorPreset state={state} viewport={viewport} />)

    expect(markup).toContain('src="/api/filebrowser/file?path=%2FWorkspace%2Fwandor.jpg"')
    expect(markup).not.toContain('<video')
  })
})
