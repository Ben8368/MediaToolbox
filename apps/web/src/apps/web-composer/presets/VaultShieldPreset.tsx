import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Menu, X } from 'lucide-react'

import { MediaBackground, PresetSlotContent, slotElementProps } from './shared'
import type { PresetViewport } from './shared'
import type { PresetState } from './types'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  })
};

const navItems = ['Vault', 'Plans', 'Install', 'News', 'Help'].map((label, index) => ({ id: `nav.${index}`, label }))

export function VaultShieldPreset({ state, viewport }: { state: PresetState; viewport: PresetViewport }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main
      className="vault-preset preset-canvas"
      style={
        {
          "--vault-text": state.theme.textColor,
          "--vault-accent": state.theme.accentColor,
          "--font-heading": state.theme.headingFont,
          "--font-body": state.theme.bodyFont
        } as CSSProperties
      }
    >
      <MediaBackground state={state} viewport={viewport} />
      <header className="vault-nav" aria-label="VaultShield navigation">
        <div className="vault-nav-inner">
          <a className="vault-logo" href="#" aria-label="VaultShield home" {...slotElementProps(state, 'brand.logo', viewport)}>
            <PresetSlotContent state={state} slotId="brand.logo" viewport={viewport} />
          </a>
          <nav className="vault-nav-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.id} href="#" {...slotElementProps(state, item.id, viewport)}>
                <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
              </a>
            ))}
          </nav>
          <div className="vault-actions">
            <a className="vault-primary" href="#" {...slotElementProps(state, 'nav.primary', viewport)}>
              <PresetSlotContent state={state} slotId="nav.primary" viewport={viewport} />
            </a>
            <a className="vault-login" href="#" {...slotElementProps(state, 'nav.login', viewport)}>
              <PresetSlotContent state={state} slotId="nav.login" viewport={viewport} />
            </a>
          </div>
          <button
            className="vault-menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="vault-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              className="vault-sheet"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="vault-sheet-header">
                <span className="vault-logo" {...slotElementProps(state, 'brand.logo', viewport)}>
                  <PresetSlotContent state={state} slotId="brand.logo" viewport={viewport} />
                </span>
                <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                  <X />
                </button>
              </div>
              <nav className="vault-sheet-links" aria-label="Mobile navigation">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.id}
                    href="#"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + index * 0.07 }}
                    onClick={() => setMenuOpen(false)}
                    {...slotElementProps(state, item.id, viewport)}
                  >
                    <PresetSlotContent state={state} slotId={item.id} viewport={viewport} />
                  </motion.a>
                ))}
              </nav>
              <div className="vault-sheet-actions">
                <a className="vault-primary" href="#" {...slotElementProps(state, 'nav.primary', viewport)}>
                  <PresetSlotContent state={state} slotId="nav.primary" viewport={viewport} />
                </a>
                <a className="vault-login" href="#" {...slotElementProps(state, 'nav.login', viewport)}>
                  <PresetSlotContent state={state} slotId="nav.login" viewport={viewport} />
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <section className="vault-hero">
        <div className="vault-copy">
          <motion.h1
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="visible"
            {...slotElementProps(state, 'hero.heading', viewport)}
          >
            <PresetSlotContent state={state} slotId="hero.heading" viewport={viewport} />
          </motion.h1>
          <motion.p variants={fadeUp} custom={1} initial="hidden" animate="visible" {...slotElementProps(state, 'hero.subtext', viewport)}>
            <PresetSlotContent state={state} slotId="hero.subtext" viewport={viewport} />
          </motion.p>
          <motion.button
            className="vault-cta"
            type="button"
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.04, filter: "brightness(1.1)" }}
            whileTap={{ scale: 0.96 }}
            {...slotElementProps(state, 'hero.cta', viewport)}
          >
            <span><PresetSlotContent state={state} slotId="hero.cta" viewport={viewport} /></span>
            <span className="wc-preset-slot-inline wc-preset-slot-icon" {...slotElementProps(state, 'hero.cta.icon', viewport)}>
              <PresetSlotContent state={state} slotId="hero.cta.icon" viewport={viewport} />
            </span>
          </motion.button>
        </div>
      </section>
    </main>
  );
}
