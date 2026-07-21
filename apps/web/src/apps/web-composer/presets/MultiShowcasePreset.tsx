import type { CSSProperties } from 'react'

import { MediaBackground, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
import type { PresetState } from './types'

const cards = [
  { id: 'camera-motion' },
  { id: 'vfx' },
  { id: 'shot-scales' },
]

export function MultiShowcasePreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  return (
    <main
      className="multi-showcase-preset preset-canvas"
      style={{ '--multi-showcase-text': state.theme.textColor } as CSSProperties}
    >
      <MediaBackground state={state} viewport={viewport} />
      <div className="multi-showcase-layout">
        <header className="multi-showcase-brand">
          <span className="multi-showcase-brand-mark" {...slotElementProps(state, 'brand.mark', viewport)}>
            <PresetSlotContent state={state} slotId="brand.mark" viewport={viewport} iconClassName="multi-showcase-brand-icon" imageClassName="multi-showcase-brand-image" />
          </span>
        </header>

        <section className="multi-showcase-copy">
          <div className="multi-showcase-product-line">
            <span {...slotElementProps(state, 'hero.product', viewport)}><PresetSlotContent state={state} slotId="hero.product" viewport={viewport} /></span>
          </div>
          <h1 {...slotElementProps(state, 'hero.heading', viewport)}><PresetSlotContent state={state} slotId="hero.heading" viewport={viewport} /></h1>
          <div className="multi-showcase-cards">
            {cards.map((card) => (
              <article className="multi-showcase-card" key={card.id}>
                <div className="multi-showcase-card-image-wrap" {...slotElementProps(state, `card.${card.id}.image`, viewport)}>
                  <PresetSlotContent state={state} slotId={`card.${card.id}.image`} viewport={viewport} imageClassName="multi-showcase-card-image" />
                </div>
                <span {...slotElementProps(state, `card.${card.id}.label`, viewport)}>
                  <PresetSlotContent state={state} slotId={`card.${card.id}.label`} viewport={viewport} />
                </span>
              </article>
            ))}
          </div>
          <button className="multi-showcase-cta" type="button" {...slotElementProps(state, 'hero.cta', viewport)}>
            <PresetSlotContent state={state} slotId="hero.cta" viewport={viewport} />
          </button>
        </section>

        <section className="multi-showcase-hero-image" {...slotElementProps(state, 'hero.image', viewport)}>
          <PresetSlotContent state={state} slotId="hero.image" viewport={viewport} imageClassName="multi-showcase-hero-image-content" />
        </section>
      </div>
    </main>
  )
}
