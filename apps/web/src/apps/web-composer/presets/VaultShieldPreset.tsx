import { useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { ArrowRightCircle, Fingerprint, LockKeyhole, Menu, X, Zap } from 'lucide-react'

import { MediaBackground } from './shared'
import type { PresetState } from './types'

function VaultLogo() {
  return (
    <svg width="32" height="32" fill="none" overflow="visible" viewBox="0 0 256 256" aria-hidden="true">
      <path
        d="M64 128h.5L32 95 0 64V0h64l64 64v.5L161 32l31-32h64v64l-64 64h-64v64l-32 31-32.5 33H0v-64l64-64Zm192 64-32 31-32.5 33H128v-64l64-64h64v64Z"
        fill="currentColor"
      />
    </svg>
  );
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  })
};

export function VaultShieldPreset({ state }: { state: PresetState }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = ["Vault", "Plans", "Install", "News", "Help"];

  return (
    <main
      className="vault-preset preset-canvas"
      style={
        {
          "--vault-text": state.textColor,
          "--vault-accent": state.accentColor,
          "--font-heading": state.headingFont,
          "--font-body": state.bodyFont
        } as CSSProperties
      }
    >
      <MediaBackground state={state} />
      <header className="vault-nav" aria-label="VaultShield navigation">
        <div className="vault-nav-inner">
          <a className="vault-logo" href="#" aria-label="VaultShield home">
            <VaultLogo />
          </a>
          <nav className="vault-nav-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item} href="#">
                {item}
              </a>
            ))}
          </nav>
          <div className="vault-actions">
            <a className="vault-primary" href="#">
              Start For Free
            </a>
            <a className="vault-login" href="#">
              Sign In
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
                <VaultLogo />
                <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                  <X />
                </button>
              </div>
              <nav className="vault-sheet-links" aria-label="Mobile navigation">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item}
                    href="#"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + index * 0.07 }}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item}
                  </motion.a>
                ))}
              </nav>
              <div className="vault-sheet-actions">
                <a className="vault-primary" href="#">
                  Start For Free
                </a>
                <a className="vault-login" href="#">
                  Sign In
                </a>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <section className="vault-hero">
        <div className="vault-copy">
          <motion.h1 variants={fadeUp} custom={0} initial="hidden" animate="visible">
            <Zap className="vault-inline-icon" />
            {state.texts.headingStart} <span>{state.texts.headingMiddle}</span>
            <LockKeyhole className="vault-inline-icon" />
            {state.texts.headingEnd}
            <Fingerprint className="vault-inline-icon" />
          </motion.h1>
          <motion.p variants={fadeUp} custom={1} initial="hidden" animate="visible">
            {state.texts.subtext}
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
          >
            <span>{state.texts.cta}</span>
            <ArrowRightCircle size={20} strokeWidth={2.25} />
          </motion.button>
        </div>
      </section>
    </main>
  );
}
