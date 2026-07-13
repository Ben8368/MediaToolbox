import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Menu, X } from 'lucide-react'

import { getMedia, getMediaProps, getSlot, getText, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
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

const navItems = ['Works', 'Services', 'About', 'Contact'].map((label, index) => ({ id: `nav.${index}`, label }))

export function ViktorPreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const clock = useClock();
  const background = getMedia(state);
  const nameSlot = getSlot(state, 'hero.name');
  const accent = activeIndex === 0 ? state.theme.accentColor : state.theme.textColor;
  const dotGlow = activeIndex === 0 ? "rgba(245, 152, 242, 0.8)" : "rgba(255,255,255,0.76)";

  return (
    <main
      className="viktor-preset preset-canvas"
      style={{ "--viktor-accent": accent, "--viktor-glow": dotGlow, fontFamily: state.theme.bodyFont } as CSSProperties}
    >
      <div className="viktor-bg-stack" aria-label="背景素材" {...slotElementProps(state, 'background', viewport)}>
        {viktorVideos.map((video, index) => {
          const source = background?.src && index === activeIndex ? background.src : video.src;
          return background?.kind === "image" && index === activeIndex ? (
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
              <a className="nav-link-underline" key={item.id} href={`#${item.label.toLowerCase()}`} {...slotElementProps(state, item.id, viewport)}>
                <span>{String(index + 1).padStart(2, "0")} /</span>
                <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
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
            <a className="nav-link-underline" href={`mailto:${getText(state, 'contact.email')}`} {...slotElementProps(state, 'contact.email', viewport)}>
              <PresetSlotContent state={state} slotId="contact.email" viewport={viewport} />
            </a>
            <time aria-label="Current time">{clock}</time>
          </div>
        </div>
        <nav className={`viktor-mobile-nav ${menuOpen ? "is-open" : ""}`} aria-label="Mobile navigation">
          <div>
            {navItems.map((item, index) => (
              <a key={item.id} href={`#${item.label.toLowerCase()}`} onClick={() => setMenuOpen(false)} {...slotElementProps(state, item.id, viewport)}>
                <span>{String(index + 1).padStart(2, "0")} /</span>
                <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
              </a>
            ))}
            <a href={`mailto:${getText(state, 'contact.email')}`} {...slotElementProps(state, 'contact.email', viewport)}>
              <PresetSlotContent state={state} slotId="contact.email" viewport={viewport} />
            </a>
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
                {...slotElementProps(state, `switch.${index}`, viewport)}
              >
                {String(index + 1).padStart(2, "0")} / <PresetSlotContent state={state} slotId={`switch.${index}`} viewport={viewport} />
              </button>
            ))}
          </div>
          <div className="viktor-status" role="status" aria-label="Availability status" {...slotElementProps(state, 'hero.status', viewport)}>
            <span />
            <PresetSlotContent state={state} slotId="hero.status" viewport={viewport} />
          </div>
        </div>
        <div className="viktor-bottom">
          <h1 {...slotElementProps(state, 'hero.name', viewport, { fontFamily: state.theme.headingFont })}>
            <PresetSlotContent state={state} slotId="hero.name" viewport={viewport} />
            {nameSlot?.activeKind === 'text' && <span>.</span>}
          </h1>
          <div className="viktor-copy">
            <p {...slotElementProps(state, 'hero.subtext', viewport)}>
              <PresetSlotContent state={state} slotId="hero.subtext" viewport={viewport} />
            </p>
            <a className="viktor-project-button" href="#contact" {...slotElementProps(state, 'hero.cta', viewport)}>
              <span><PresetSlotContent state={state} slotId="hero.cta" viewport={viewport} /></span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
