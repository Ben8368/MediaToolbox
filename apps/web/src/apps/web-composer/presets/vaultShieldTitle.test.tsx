import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { clonePresetState } from './index'
import { VaultShieldPreset } from './VaultShieldPreset'
import { vaultShieldManifest } from './manifests/vaultshield'
import { updateVaultShieldHeadingText } from './vaultShieldTitle'

const viewport = {
  width: 1920,
  height: 1080,
  designWidth: 1920,
  designHeight: 1080,
}

describe('VaultShield heading decorations', () => {
  it('removes inherited title icons when headline copy changes', () => {
    const initial = clonePresetState(vaultShieldManifest.defaults)
    const updated = updateVaultShieldHeadingText(initial, 'hero.heading.start', {
      value: 'Protect every account',
    })

    expect(initial.slots['hero.icon.zap']?.visible).toBe(true)
    for (const slotId of ['hero.icon.zap', 'hero.icon.lock', 'hero.icon.fingerprint']) {
      expect(updated.slots[slotId]?.visible).toBe(false)
    }

    const markup = renderToStaticMarkup(<VaultShieldPreset state={updated} viewport={viewport} />)
    expect(markup).not.toContain('data-wc-slot="hero.icon.zap"')
    expect(markup).not.toContain('data-wc-slot="hero.icon.lock"')
    expect(markup).not.toContain('data-wc-slot="hero.icon.fingerprint"')
  })

  it('keeps the stock decorations when the text is unchanged', () => {
    const initial = clonePresetState(vaultShieldManifest.defaults)
    const updated = updateVaultShieldHeadingText(initial, 'hero.heading.start', {
      value: initial.slots['hero.heading.start']?.text?.value ?? '',
    })

    expect(updated.slots['hero.icon.zap']?.visible).toBe(true)
    expect(updated.slots['hero.icon.lock']?.visible).toBe(true)
    expect(updated.slots['hero.icon.fingerprint']?.visible).toBe(true)
  })
})
