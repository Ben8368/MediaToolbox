import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Menu, X } from 'lucide-react'

import { getMediaProps } from './shared'
import type { PresetState } from './types'

export const viktorVideos = [
  {
    label: "WATER WAVE",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260629_030107_874273ea-684a-4e90-bb96-8fdfde48d53d.mp4"
  },
  {
    label: "GRIDWAVE",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260629_032424_3c9c2a9d-807b-4482-80e6-dd6d9dfd4545.mp4"
  },
  {
    label: "LIGHT TUNNEL",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260627_094019_4214ea73-b963-46a4-8327-61489192de99.mp4"
  }
];

function useClock() {
  const formatter = useMemo(
    () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
    []
  );
  const [time, setTime] = useState(() => formatter.format(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatter.format(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, [formatter]);

  return `CUP ${time}`;
}

export function ViktorPreset({ state }: { state: PresetState }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const clock = useClock();
  const navItems = ["Works", "Services", "About", "Contact"];
  const accent = activeIndex === 0 ? state.accentColor : state.textColor;
  const dotGlow = activeIndex === 0 ? "rgba(245, 152, 242, 0.8)" : "rgba(255,255,255,0.76)";

  return (
    <main
      className="viktor-preset preset-canvas"
      style={{ "--viktor-accent": accent, "--viktor-glow": dotGlow, fontFamily: state.bodyFont } as CSSProperties}
    >
      <div className="viktor-bg-stack" aria-hidden="true">
        {viktorVideos.map((video, index) => {
          const source = state.backgroundUrl && index === activeIndex ? state.backgroundUrl : video.src;
          return state.backgroundKind === "image" && index === activeIndex ? (
            <img
              key={video.src}
              className={`viktor-bg-layer ${activeIndex === index ? "is-active" : ""}`}
              src={source}
              alt=""
              {...getMediaProps(source)}
            />
          ) : (
            <video
              key={video.src}
              className={`viktor-bg-layer ${activeIndex === index ? "is-active" : ""}`}
              src={source}
              autoPlay
              muted
              loop
              playsInline
              {...getMediaProps(source)}
            />
          );
        })}
        <div className="viktor-bg-dim" />
      </div>

      <header className="viktor-header">
        <div className="viktor-header-inner">
          <nav className="viktor-desktop-nav" aria-label="Primary navigation">
            {navItems.map((item, index) => (
              <a className="nav-link-underline" key={item} href={`#${item.toLowerCase()}`}>
                <span>{String(index + 1).padStart(2, "0")} /</span>
                {item}
              </a>
            ))}
          </nav>
          <button
            className="viktor-mobile-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <div className="viktor-contact">
            <a className="nav-link-underline" href="mailto:Davies@gmail.com">
              Davies@gmail.com
            </a>
            <time aria-label="Current time">{clock}</time>
          </div>
        </div>
        <nav className={`viktor-mobile-nav ${menuOpen ? "is-open" : ""}`} aria-label="Mobile navigation">
          <div>
            {navItems.map((item, index) => (
              <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMenuOpen(false)}>
                <span>{String(index + 1).padStart(2, "0")} /</span>
                {item}
              </a>
            ))}
            <a href="mailto:Davies@gmail.com">Davies@gmail.com</a>
          </div>
        </nav>
      </header>

      <section className="viktor-hero" aria-label="Creative portfolio hero">
        <div className="viktor-upper">
          <div className="viktor-switcher">
            {viktorVideos.map((video, index) => (
              <button
                key={video.label}
                type="button"
                className={activeIndex === index ? "is-active" : ""}
                aria-pressed={activeIndex === index}
                onClick={() => setActiveIndex(index)}
              >
                {String(index + 1).padStart(2, "0")} / {video.label}
              </button>
            ))}
          </div>
          <div className="viktor-status" role="status" aria-label="Availability status">
            <span />
            {state.texts.status}
          </div>
        </div>
        <div className="viktor-bottom">
          <h1 style={{ fontFamily: state.headingFont }}>
            {state.texts.name}
            <span>.</span>
          </h1>
          <div className="viktor-copy">
            <p>{state.texts.subtext}</p>
            <a className="viktor-project-button" href="#contact">
              <span>{state.texts.cta}</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
