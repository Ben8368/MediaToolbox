import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VaultShieldPreset } from './VaultShieldPreset'
import { vaultShieldManifest } from './manifests/vaultshield'

const viewport = {
  width: 1920,
  height: 1080,
  designWidth: 1920,
  designHeight: 1080,
}

describe('VaultShield headline', () => {
  it('uses one editable multiline heading without inherited inline icons', () => {
    const heading = vaultShieldManifest.slots.find((slot) => slot.id === 'hero.heading')

    expect(heading?.editors.text?.multiline).toBe(true)
    expect(vaultShieldManifest.slots.some((slot) => slot.id.startsWith('hero.icon.'))).toBe(false)

    const markup = renderToStaticMarkup(
      <VaultShieldPreset state={vaultShieldManifest.defaults} viewport={viewport} />,
    )
    expect(markup).toContain('data-wc-slot="hero.heading"')
    expect(markup).toContain('Lock Down Your\nPasswords\nwith Ironclad Security')
  })
})
