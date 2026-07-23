import type { CSSProperties } from 'react'

import { MediaBackground, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
import type { PresetState } from './types'

const navItems = ['Platform', 'Solutions', 'Resources', 'Pricing'].map((label, index) => ({
  id: `nav.${index}`,
  label,
}))

export function TraceGridPreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  return (
    <main
      className="trace-grid-preset preset-canvas"
      style={
        {
          '--trace-accent': state.theme.accentColor,
          '--trace-text': state.theme.textColor,
          '--font-heading': state.theme.headingFont,
          '--font-body': state.theme.bodyFont,
        } as CSSProperties
      }
    >
      <MediaBackground state={state} viewport={viewport} />
      <div className="trace-grid-shade" aria-hidden="true" />

      <header className="trace-grid-nav">
        <a className="trace-grid-brand" href="#" aria-label="Trace Grid home">
          <span className="trace-grid-brand-mark" {...slotElementProps(state, 'brand.mark', viewport)}>
            <PresetSlotContent state={state} slotId="brand.mark" viewport={viewport} />
          </span>
          <span className="trace-grid-brand-name" {...slotElementProps(state, 'brand.logo', viewport)}>
            <PresetSlotContent state={state} slotId="brand.logo" viewport={viewport} />
          </span>
        </a>
        <nav className="trace-grid-nav-links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.id} href="#" {...slotElementProps(state, item.id, viewport)}>
              <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
            </a>
          ))}
        </nav>
        <a className="trace-grid-nav-cta" href="#" {...slotElementProps(state, 'nav.cta', viewport)}>
          <PresetSlotContent state={state} slotId="nav.cta" viewport={viewport} />
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="trace-grid-hero">
        <div className="trace-grid-copy">
          <div className="trace-grid-eyebrow" {...slotElementProps(state, 'hero.eyebrow', viewport)}>
            <span aria-hidden="true" />
            <PresetSlotContent state={state} slotId="hero.eyebrow" viewport={viewport} />
          </div>
          <h1>
            <span {...slotElementProps(state, 'hero.heading.line1', viewport)}>
              <PresetSlotContent state={state} slotId="hero.heading.line1" viewport={viewport} />
            </span>
            <span {...slotElementProps(state, 'hero.heading.line2', viewport)}>
              <PresetSlotContent state={state} slotId="hero.heading.line2" viewport={viewport} />
            </span>
          </h1>
          <p {...slotElementProps(state, 'hero.subtext', viewport)}>
            <PresetSlotContent state={state} slotId="hero.subtext" viewport={viewport} />
          </p>
          <a className="trace-grid-primary" href="#" {...slotElementProps(state, 'hero.cta', viewport)}>
            <PresetSlotContent state={state} slotId="hero.cta" viewport={viewport} />
            <span aria-hidden="true">→</span>
          </a>
        </div>

        <aside className="trace-grid-metric" aria-label="Live threat metric">
          <div className="trace-grid-metric-label" {...slotElementProps(state, 'metric.label', viewport)}>
            <span aria-hidden="true" />
            <PresetSlotContent state={state} slotId="metric.label" viewport={viewport} />
          </div>
          <strong {...slotElementProps(state, 'metric.value', viewport)}>
            <PresetSlotContent state={state} slotId="metric.value" viewport={viewport} />
          </strong>
          <div className="trace-grid-sparkline" aria-hidden="true">
            {[28, 45, 34, 60, 52, 74, 58, 88, 68, 96].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </aside>
      </section>

      <div className="trace-grid-ribbon" aria-hidden="true">
        {Array.from({ length: 30 }, (_, index) => (
          <i
            key={index}
            style={{ '--trace-delay': `${index * -70}ms`, opacity: 0.42 + index * 0.018 } as CSSProperties }
          />
        ))}
      </div>

      <footer className="trace-grid-footer">
        <div className="trace-grid-status" {...slotElementProps(state, 'footer.status', viewport)}>
          <span aria-hidden="true" />
          <PresetSlotContent state={state} slotId="footer.status" viewport={viewport} />
        </div>
        <div className="trace-grid-coordinate" {...slotElementProps(state, 'footer.coordinate', viewport)}>
          <PresetSlotContent state={state} slotId="footer.coordinate" viewport={viewport} />
        </div>
      </footer>
    </main>
  )
}
