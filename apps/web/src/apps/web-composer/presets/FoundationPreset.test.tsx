import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { foundationManifest } from './manifests/foundation'
import { FoundationPreset } from './FoundationPreset'

const viewport = {
  width: 1920,
  height: 1080,
  designWidth: 1920,
  designHeight: 1080,
}

describe('Foundation preset', () => {
  it('uses the locally installed video and all eight local logo files', () => {
    const markup = renderToStaticMarkup(<FoundationPreset state={foundationManifest.defaults} viewport={viewport} />)

    expect(markup).toContain('src="/static/web-composer/videos/foundation-hero.mp4"')
    expect(markup).not.toContain('cloudfront.net')
    for (const name of ['procure', 'shopify', 'blender', 'figma', 'spotify', 'lottielab', 'google-cloud', 'bing']) {
      expect(markup).toContain(`/static/web-composer/foundation/logos/${name}.svg`)
    }
  })

  it('keeps the requested video, motion, navigation and seamless marquee structure', () => {
    const markup = renderToStaticMarkup(<FoundationPreset state={foundationManifest.defaults} viewport={viewport} />)

    expect(markup).toContain('autoplay=""')
    expect(markup).toContain('loop=""')
    expect(markup).toContain('muted=""')
    expect(markup).toContain('playsinline=""')
    expect(markup).toContain('Foundation of the')
    expect(markup).toContain('new digital epoch')
    expect(markup.match(/alt="Procure"/g)).toHaveLength(2)
    expect(markup).toContain('Get in touch')
  })

  it('renders a user-replaced image background instead of pinning the built-in video', () => {
    const state = structuredClone(foundationManifest.defaults)
    state.slots.background.media = {
      kind: 'image',
      src: '/api/filebrowser/file?path=%2FWorkspace%2Ffoundation-background.png',
      fit: 'cover',
    }
    const markup = renderToStaticMarkup(<FoundationPreset state={state} viewport={viewport} />)

    expect(markup).toContain('src="/api/filebrowser/file?path=%2FWorkspace%2Ffoundation-background.png"')
    expect(markup).not.toContain('<video')
  })
})
