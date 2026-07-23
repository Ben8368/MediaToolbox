import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { getSlot, getText, MediaBackground, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
import type { PresetState } from './types'

const navItems = ['Story', 'Investing', 'Building', 'Advisory'].map((label, index) => ({
  id: `nav.${index}`,
  label,
}))

function useDelayedVisibility(delay: number) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [delay])

  return visible
}

function FadeIn({ children, className, delay, duration = 1000 }: {
  children: ReactNode
  className: string
  delay: number
  duration?: number
}) {
  const visible = useDelayedVisibility(delay)
  return (
    <div
      className={`${className} vex-fade${visible ? ' is-visible' : ''}`}
      style={{ '--vex-fade-duration': `${duration}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}

function AnimatedHeadingLine({ state, viewport, slotId, precedingLength }: {
  state: PresetState
  viewport: PresetViewport
  slotId: string
  precedingLength: number
}) {
  const visible = useDelayedVisibility(200)
  const slot = getSlot(state, slotId)
  const text = getText(state, slotId)

  return (
    <span
      className={`vex-heading-line${visible ? ' is-visible' : ''}`}
      {...slotElementProps(state, slotId, viewport)}
    >
      {slot?.activeKind === 'text' ? [...text].map((character, index) => (
        <span
          className="vex-heading-character"
          key={`${character}-${index}`}
          style={{ transitionDelay: `${(precedingLength + index) * 30}ms` }}
        >
          {character === ' ' ? '\u00a0' : character}
        </span>
      )) : <PresetSlotContent state={state} slotId={slotId} viewport={viewport} />}
    </span>
  )
}

export function VexVisionPreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  const firstLineLength = getText(state, 'hero.heading.line1').length

  return (
    <main
      className="vex-preset preset-canvas"
      style={{
        '--vex-font-heading': state.theme.headingFont,
        '--vex-font-body': state.theme.bodyFont,
        '--vex-text': state.theme.textColor,
      } as CSSProperties}
    >
      <MediaBackground state={state} viewport={viewport} />

      <header className="vex-header">
        <div className="vex-navbar vex-liquid-glass">
          <a className="vex-logo" href="#" aria-label="VEX home" {...slotElementProps(state, 'brand.logo', viewport)}>
            <PresetSlotContent state={state} slotId="brand.logo" viewport={viewport} />
          </a>
          <nav className="vex-nav-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.id} href="#" {...slotElementProps(state, item.id, viewport)}>
                <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
              </a>
            ))}
          </nav>
          <a className="vex-nav-cta" href="#" {...slotElementProps(state, 'nav.cta', viewport)}>
            <PresetSlotContent state={state} slotId="nav.cta" viewport={viewport} />
          </a>
        </div>
      </header>

      <section className="vex-hero">
        <div className="vex-hero-grid">
          <div className="vex-copy">
            <h1>
              <AnimatedHeadingLine state={state} viewport={viewport} slotId="hero.heading.line1" precedingLength={0} />
              <AnimatedHeadingLine state={state} viewport={viewport} slotId="hero.heading.line2" precedingLength={firstLineLength} />
            </h1>
            <FadeIn className="vex-subtext-wrap" delay={800}>
              <p {...slotElementProps(state, 'hero.subtext', viewport)}>
                <PresetSlotContent state={state} slotId="hero.subtext" viewport={viewport} />
              </p>
            </FadeIn>
            <FadeIn className="vex-actions" delay={1200}>
              <a className="vex-primary" href="#" {...slotElementProps(state, 'hero.primary', viewport)}>
                <PresetSlotContent state={state} slotId="hero.primary" viewport={viewport} />
              </a>
              <a className="vex-secondary vex-liquid-glass" href="#" {...slotElementProps(state, 'hero.secondary', viewport)}>
                <PresetSlotContent state={state} slotId="hero.secondary" viewport={viewport} />
              </a>
            </FadeIn>
          </div>

          <FadeIn className="vex-tag-wrap" delay={1400}>
            <div className="vex-tag vex-liquid-glass" {...slotElementProps(state, 'hero.tag', viewport)}>
              <PresetSlotContent state={state} slotId="hero.tag" viewport={viewport} />
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  )
}