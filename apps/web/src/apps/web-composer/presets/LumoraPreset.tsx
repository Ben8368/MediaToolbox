import { useState } from 'react'
import { Menu, X } from 'lucide-react'

import { getMedia, getMediaProps, getSlot, getText, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
import type { PresetState } from './types'

export const lumoraVideos = [
  {
    label: "Golden Hour",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4"
  },
  {
    label: "Still Water",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4"
  },
  {
    label: "Deep Woods",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4"
  },
  {
    label: "Quiet Dawn",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4"
  }
];

const navItems = [
  { id: 'nav.how', fallback: 'How It Works' },
  { id: 'nav.features', fallback: 'Features' },
  { id: 'nav.pricing', fallback: 'Pricing' },
  { id: 'nav.community', fallback: 'Community' },
]

export function LumoraPreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  const [activeVideo, setActiveVideo] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isDarkSlide = activeVideo === 2;
  const foreground = isDarkSlide ? "#182C41" : state.theme.textColor;
  const muted = isDarkSlide ? "rgba(24, 44, 65, 0.78)" : "rgba(255, 255, 255, 0.82)";
  const background = getMedia(state);
  const statsSlot = getSlot(state, 'hero.stats');
  const stats = getText(state, 'hero.stats').split("|").map((item) => item.trim()).filter(Boolean);

  const switchVideo = (index: number) => {
    if (index === activeVideo || isTransitioning) return;
    setActiveVideo(index);
    setIsTransitioning(true);
    window.setTimeout(() => setIsTransitioning(false), 1000);
  };

  return (
    <section className="lumora-preset preset-canvas" style={{ fontFamily: state.theme.headingFont }}>
      <div className="lumora-video-stack" {...slotElementProps(state, 'background', viewport)}>
        {lumoraVideos.map((video, index) => {
          const source = background?.src && index === activeVideo ? background.src : video.src;
          return background?.kind === "image" && index === activeVideo ? (
            <img
              key={video.src}
              className={`lumora-bg-layer ${activeVideo === index ? "is-active" : ""}`}
              src={source}
              alt=""
              aria-hidden="true"
              {...getMediaProps(source)}
            />
          ) : (
            <video
              key={video.src}
              className={`lumora-bg-layer ${activeVideo === index ? "is-active" : ""}`}
              src={source}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              {...getMediaProps(source)}
            />
          );
        })}
      </div>
      <img
        className="lumora-train-overlay"
        src="https://soft-zoom-63098134.figma.site/_assets/v11/0b4a435b2df2747593c43d7a1c9b4578f7d8d90c.png"
        alt=""
        aria-hidden="true"
        crossOrigin="anonymous"
      />

      <div className="lumora-content">
        <nav className="lumora-nav" aria-label="Lumora navigation">
          <a className="lumora-logo" href="#" aria-label="Lumora home" {...slotElementProps(state, 'brand.logo', viewport)}>
            <PresetSlotContent state={state} slotId="brand.logo" viewport={viewport} />
          </a>
          <div className="lumora-nav-pill liquid-glass">
            <div className="lumora-nav-links" style={{ fontFamily: state.theme.bodyFont }}>
              {navItems.map((item) => (
                <a key={item.id} href="#" {...slotElementProps(state, item.id, viewport)}>
                  <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
                </a>
              ))}
            </div>
            <a className="lumora-white-button" href="#" {...slotElementProps(state, 'nav.cta', viewport, { fontFamily: state.theme.bodyFont })}>
              <PresetSlotContent state={state} slotId="nav.cta" viewport={viewport} />
            </a>
          </div>
          <button
            className="lumora-menu-button liquid-glass"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Menu className={menuOpen ? "icon-out" : "icon-in"} size={20} />
            <X className={menuOpen ? "icon-in" : "icon-out"} size={20} />
          </button>
        </nav>

        <div className="lumora-hero" style={{ color: foreground }}>
          <div className="lumora-badge liquid-glass" {...slotElementProps(state, 'hero.badge', viewport, { fontFamily: state.theme.bodyFont })}>
            <PresetSlotContent state={state} slotId="hero.badge" viewport={viewport} />
          </div>
          <h1>
            <span className="wc-preset-slot-inline" {...slotElementProps(state, 'hero.heading.line1', viewport)}>
              <PresetSlotContent state={state} slotId="hero.heading.line1" viewport={viewport} />
            </span>
            <br />
            <span className="wc-preset-slot-inline" {...slotElementProps(state, 'hero.heading.line2', viewport)}>
              <PresetSlotContent state={state} slotId="hero.heading.line2" viewport={viewport} />
            </span>
          </h1>
          <p {...slotElementProps(state, 'hero.subtext', viewport, { color: muted, fontFamily: state.theme.bodyFont })}>
            <PresetSlotContent state={state} slotId="hero.subtext" viewport={viewport} />
          </p>
          <form className="lumora-email liquid-glass" style={{ fontFamily: state.theme.bodyFont }}>
            <input aria-label="Email" placeholder={getText(state, 'hero.email-placeholder')} {...slotElementProps(state, 'hero.email-placeholder', viewport)} />
            <button type="button" {...slotElementProps(state, 'hero.cta', viewport)}>
              <PresetSlotContent state={state} slotId="hero.cta" viewport={viewport} />
            </button>
          </form>
          <div className="lumora-switcher" style={{ fontFamily: state.theme.bodyFont }}>
            {lumoraVideos.map((video, index) => (
              <button
                key={video.label}
                type="button"
                disabled={isTransitioning}
                className={activeVideo === index ? "is-active" : ""}
                onClick={() => switchVideo(index)}
                {...slotElementProps(state, `switch.${index}`, viewport)}
              >
                <PresetSlotContent state={state} slotId={`switch.${index}`} viewport={viewport} />
              </button>
            ))}
          </div>
        </div>

        <div className="lumora-stats" {...slotElementProps(state, 'hero.stats', viewport, { fontFamily: state.theme.bodyFont })}>
          {statsSlot?.activeKind === 'text' ? stats.map((item, index) => (
              <span key={`${item}-${index}`}>
                {item}
                {index < stats.length - 1 && <b>|</b>}
              </span>
            )) : <PresetSlotContent state={state} slotId="hero.stats" viewport={viewport} />}
        </div>
      </div>

      <div className={`lumora-mobile-panel ${menuOpen ? "is-open" : ""}`}>
        {navItems.map((item, index) => (
          <a
            key={item.id}
            href="#"
            onClick={() => setMenuOpen(false)}
            {...slotElementProps(state, item.id, viewport, { transitionDelay: menuOpen ? `${100 + index * 50}ms` : "0ms" })}
          >
            <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
          </a>
        ))}
        <a className="mobile-cta" href="#" onClick={() => setMenuOpen(false)} {...slotElementProps(state, 'nav.cta', viewport)}>
          <PresetSlotContent state={state} slotId="nav.cta" viewport={viewport} />
        </a>
      </div>
    </section>
  );
}
