import { useState } from 'react'
import { Menu, X } from 'lucide-react'

import { getMediaProps } from './shared'
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

export function LumoraPreset({ state }: { state: PresetState }) {
  const [activeVideo, setActiveVideo] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navItems = ["How It Works", "Features", "Pricing", "Community"];
  const isDarkSlide = activeVideo === 2;
  const foreground = isDarkSlide ? "#182C41" : state.textColor;
  const muted = isDarkSlide ? "rgba(24, 44, 65, 0.78)" : "rgba(255, 255, 255, 0.82)";
  const stats = state.texts.stats.split("|").map((item) => item.trim()).filter(Boolean);

  const switchVideo = (index: number) => {
    if (index === activeVideo || isTransitioning) return;
    setActiveVideo(index);
    setIsTransitioning(true);
    window.setTimeout(() => setIsTransitioning(false), 1000);
  };

  return (
    <section className="lumora-preset preset-canvas" style={{ fontFamily: state.headingFont }}>
      <div className="lumora-video-stack">
        {lumoraVideos.map((video, index) => {
          const source = state.backgroundUrl && index === activeVideo ? state.backgroundUrl : video.src;
          return state.backgroundKind === "image" && index === activeVideo ? (
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
          <a className="lumora-logo" href="#" aria-label="Lumora home">
            Lumora
          </a>
          <div className="lumora-nav-pill liquid-glass">
            <div className="lumora-nav-links" style={{ fontFamily: state.bodyFont }}>
              {navItems.map((item) => (
                <a key={item} href="#">
                  {item}
                </a>
              ))}
            </div>
            <a className="lumora-white-button" href="#" style={{ fontFamily: state.bodyFont }}>
              Get Started
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
          <div className="lumora-badge liquid-glass" style={{ fontFamily: state.bodyFont }}>
            {state.texts.badge}
          </div>
          <h1>
            {state.texts.headingLine1}
            <br />
            {state.texts.headingLine2}
          </h1>
          <p style={{ color: muted, fontFamily: state.bodyFont }}>{state.texts.subtext}</p>
          <form className="lumora-email liquid-glass" style={{ fontFamily: state.bodyFont }}>
            <input aria-label="Email" placeholder={state.texts.emailPlaceholder} />
            <button type="button">{state.texts.cta}</button>
          </form>
          <div className="lumora-switcher" style={{ fontFamily: state.bodyFont }}>
            {lumoraVideos.map((video, index) => (
              <button
                key={video.label}
                type="button"
                disabled={isTransitioning}
                className={activeVideo === index ? "is-active" : ""}
                onClick={() => switchVideo(index)}
              >
                {video.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lumora-stats" style={{ fontFamily: state.bodyFont }}>
          {stats.map((item, index) => (
            <span key={item}>
              {item}
              {index < stats.length - 1 && <b>|</b>}
            </span>
          ))}
        </div>
      </div>

      <div className={`lumora-mobile-panel ${menuOpen ? "is-open" : ""}`}>
        {navItems.map((item, index) => (
          <a
            key={item}
            href="#"
            style={{ transitionDelay: menuOpen ? `${100 + index * 50}ms` : "0ms" }}
            onClick={() => setMenuOpen(false)}
          >
            {item}
          </a>
        ))}
        <a className="mobile-cta" href="#" onClick={() => setMenuOpen(false)}>
          Get Started
        </a>
      </div>
    </section>
  );
}
