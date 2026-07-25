import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'

import { getMedia, getMediaProps, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
import type { PresetState } from './types'

const localAsset = (name: string) => `/static/web-composer/foundation/logos/${name}.svg`

const logos = [
  { src: localAsset('procure'), alt: 'Procure', gradient: 'linear-gradient(135deg, #60a5fa, #2563eb)' },
  { src: localAsset('shopify'), alt: 'Shopify', gradient: 'linear-gradient(135deg, #fde68a, #f59e0b)' },
  { src: localAsset('blender'), alt: 'Blender', gradient: 'linear-gradient(135deg, #7dd3fc, #2563eb)' },
  { src: localAsset('figma'), alt: 'Figma', gradient: 'linear-gradient(135deg, #c4b5fd, #7c3aed)' },
  { src: localAsset('spotify'), alt: 'Spotify', gradient: 'linear-gradient(135deg, #fb7185, #e11d48)' },
  { src: localAsset('lottielab'), alt: 'Lottielab', gradient: 'linear-gradient(135deg, #fde047, #65a30d)' },
  { src: localAsset('google-cloud'), alt: 'Google Cloud', gradient: 'linear-gradient(135deg, #bae6fd, #38bdf8)' },
  { src: localAsset('bing'), alt: 'Bing', gradient: 'linear-gradient(135deg, #67e8f9, #0f766e)' },
] as const

const heroContainerClass = 'foundation-hero relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-white border border-slate-200/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] overflow-hidden h-[600px] flex flex-col'

const navClass = 'foundation-navbar flex items-center bg-white/90 backdrop-blur-2xl px-1.5 py-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-slate-200/40'

const marqueeCardClass = 'foundation-marquee-card group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all overflow-hidden'

export function FoundationPreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  const background = getMedia(state)
  const backgroundSrc = background?.src || '/static/web-composer/videos/foundation-hero.mp4'

  return (
    <main
      className="foundation-preset preset-canvas"
      style={{ '--foundation-heading': state.theme.headingFont, '--foundation-body': state.theme.bodyFont } as CSSProperties}
    >
      <section className={heroContainerClass}>
        <div className="foundation-video-layer absolute inset-0 pointer-events-none z-0 overflow-hidden select-none" {...slotElementProps(state, 'background', viewport)}>
          {background?.kind === 'image' ? (
            <img
              className="foundation-video w-full h-full object-cover scale-105 transition-transform duration-1000"
              src={backgroundSrc}
              alt=""
              aria-hidden="true"
              {...getMediaProps(backgroundSrc)}
            />
          ) : (
            <video
              className="foundation-video w-full h-full object-cover scale-105 transition-transform duration-1000"
              src={backgroundSrc}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              {...getMediaProps(backgroundSrc)}
            />
          )}
        </div>

        <motion.div
          className="foundation-copy relative z-20 flex-1 px-8 md:px-16 pt-12 md:pt-16 flex flex-col items-start"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="foundation-heading font-display text-[42px] md:text-[56px] font-medium tracking-tight text-[#0a1b33]">
            <span {...slotElementProps(state, 'hero.heading.line1', viewport)}><PresetSlotContent state={state} slotId="hero.heading.line1" viewport={viewport} /></span><br />
            <span {...slotElementProps(state, 'hero.heading.line2', viewport)}><PresetSlotContent state={state} slotId="hero.heading.line2" viewport={viewport} /></span>
          </h1>
          <p className="foundation-subheadline font-sans text-[14px] md:text-[15px] text-[#64748b]" {...slotElementProps(state, 'hero.subtext', viewport)}>
            <PresetSlotContent state={state} slotId="hero.subtext" viewport={viewport} />
          </p>
          <motion.button
            className="foundation-contact-button bg-[#0a152d] text-white rounded-full"
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.98 }}
            {...slotElementProps(state, 'hero.cta', viewport)}
          >
            <PresetSlotContent state={state} slotId="hero.cta" viewport={viewport} />
          </motion.button>
        </motion.div>

        <div className="foundation-nav-wrap absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
          <motion.nav
            className={navClass}
            aria-label="Foundation navigation"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="foundation-nav-logo w-9 h-9 bg-white border-slate-100 shadow-sm" {...slotElementProps(state, 'brand.logo', viewport)}>
              <PresetSlotContent state={state} slotId="brand.logo" viewport={viewport} />
            </span>
            <button type="button" className="foundation-nav-link text-[12px] font-semibold text-slate-500 hover:text-[#0a1b33]" {...slotElementProps(state, 'nav.products', viewport)}><PresetSlotContent state={state} slotId="nav.products" viewport={viewport} /></button>
            <button type="button" className="foundation-nav-link text-[12px] font-semibold text-slate-500 hover:text-[#0a1b33]" {...slotElementProps(state, 'nav.docs', viewport)}><PresetSlotContent state={state} slotId="nav.docs" viewport={viewport} /></button>
            <button type="button" className="foundation-nav-cta bg-white px-5 py-2 rounded-full text-[12px] font-semibold text-[#0a1b33] border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all" {...slotElementProps(state, 'nav.cta', viewport)}>
              <PresetSlotContent state={state} slotId="nav.cta" viewport={viewport} /> <ChevronRight size={14} aria-hidden="true" />
            </button>
          </motion.nav>
        </div>
      </section>

      <section className="foundation-marquee mt-10" aria-label="Foundation ecosystem logos">
        <div className="foundation-marquee-track">
          {[...logos, ...logos].map((logo, index) => (
            <div className={marqueeCardClass} key={`${logo.alt}-${index}`}>
              <div className="foundation-marquee-gradient" style={{ '--foundation-logo-gradient': logo.gradient } as CSSProperties} />
              <img src={logo.src} alt={logo.alt} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
