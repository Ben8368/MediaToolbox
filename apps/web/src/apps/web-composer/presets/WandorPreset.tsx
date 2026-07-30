import { useEffect, useRef } from 'react'
import { Upload } from 'lucide-react'
import type { CSSProperties } from 'react'

import { getMedia, getMediaProps, getSlot, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
import type { PresetState } from './types'
import { wandorVideoSource } from './manifests/wandor'

const navigation = [
  { id: 'nav.discover', label: 'Discover' },
  { id: 'nav.pricing', label: 'Pricing' },
  { id: 'nav.faqs', label: 'FAQs' },
] as const

function NavButton({ state, viewport, slotId, className }: {
  state: PresetState
  viewport: PresetViewport
  slotId: string
  className?: string
}) {
  return (
    <button type="button" className={className} {...slotElementProps(state, slotId, viewport)}>
      <PresetSlotContent state={state} slotId={slotId} viewport={viewport} />
    </button>
  )
}

export function WandorPreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const background = getMedia(state)
  const backgroundSrc = background?.src || wandorVideoSource
  const uploadSlot = getSlot(state, 'prompt.upload')

  useEffect(() => {
    document.title = 'Wandor — Where will you go next?'
  }, [])

  return (
    <section
      className="wandor-preset preset-canvas"
      aria-label="Wandor travel planner"
      style={{
        '--wandor-heading': state.theme.headingFont,
        '--wandor-body': state.theme.bodyFont,
        '--wandor-prompt': state.theme.accentColor,
        '--wandor-text': state.theme.textColor,
      } as CSSProperties}
    >
      <div className="wandor-video-slot" {...slotElementProps(state, 'background', viewport)}>
        {background?.kind === 'image' ? (
          <img className="wandor-video" src={backgroundSrc} alt="" aria-hidden="true" {...getMediaProps(backgroundSrc)} />
        ) : (
          <video className="wandor-video" src={backgroundSrc} autoPlay muted loop playsInline aria-hidden="true" {...getMediaProps(backgroundSrc)} />
        )}
      </div>
      <div className="wandor-top-gradient" aria-hidden="true" />

      <div className="wandor-content">
        <nav className="wandor-nav" aria-label="Primary navigation">
          <span className="wandor-wordmark" {...slotElementProps(state, 'brand.logo', viewport)}>
            <PresetSlotContent state={state} slotId="brand.logo" viewport={viewport} />
          </span>
          <div className="wandor-nav-center">
            {navigation.map((item) => <NavButton key={item.id} state={state} viewport={viewport} slotId={item.id} className="wandor-nav-link" />)}
          </div>
          <div className="wandor-nav-actions">
            <NavButton state={state} viewport={viewport} slotId="nav.login" className="wandor-login" />
            <NavButton state={state} viewport={viewport} slotId="nav.cta" className="wandor-nav-cta" />
          </div>
        </nav>

        <div className="wandor-hero">
          <h1 {...slotElementProps(state, 'hero.heading', viewport)}>
            <PresetSlotContent state={state} slotId="hero.heading" viewport={viewport} />
          </h1>
          <p className="wandor-subtitle" {...slotElementProps(state, 'hero.subtext', viewport)}>
            <PresetSlotContent state={state} slotId="hero.subtext" viewport={viewport} />
          </p>

          <div className="wandor-prompt-card">
            <p className="wandor-prompt-text" {...slotElementProps(state, 'prompt.text', viewport)}>
              <PresetSlotContent state={state} slotId="prompt.text" viewport={viewport} />
            </p>
            <button type="button" className="wandor-prompt-cta" {...slotElementProps(state, 'prompt.cta', viewport)}>
              <PresetSlotContent state={state} slotId="prompt.cta" viewport={viewport} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="wandor-file-input" />
            <button
              type="button"
              className="wandor-upload"
              aria-label="Upload inspiration"
              onClick={() => fileInputRef.current?.click()}
              {...slotElementProps(state, 'prompt.upload', viewport)}
            >
              {uploadSlot?.activeKind === 'icon' && uploadSlot.icon?.iconId === 'upload'
                ? <Upload className="wandor-upload-icon" aria-hidden="true" />
                : <PresetSlotContent state={state} slotId="prompt.upload" viewport={viewport} iconClassName="wandor-upload-icon" />}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
