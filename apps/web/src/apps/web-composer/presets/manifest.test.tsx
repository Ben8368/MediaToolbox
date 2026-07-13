import { renderToStaticMarkup } from 'react-dom/server'
import { WEB_COMPOSER_PRESET_CATALOG } from '@mediatoolbox/contracts'
import { describe, expect, it } from 'vitest'

import { presets } from './index'

describe('web composer preset manifests', () => {
  it('matches the shared preset catalog', () => {
    expect(presets.map((preset) => preset.id).sort()).toEqual(
      Object.keys(WEB_COMPOSER_PRESET_CATALOG).sort(),
    )

    for (const preset of presets) {
      const catalogEntry = WEB_COMPOSER_PRESET_CATALOG[preset.id]
      expect(preset.version).toBe(catalogEntry.currentVersion)
      expect(catalogEntry.supportedVersions).toContain(preset.version)
      expect(preset.defaults.id).toBe(preset.id)
      expect(preset.defaults.schemaVersion).toBe(2)
    }
  })

  for (const preset of presets) {
    it(`keeps ${preset.id} slot declarations and defaults aligned`, () => {
      const slotIds = preset.slots.map((slot) => slot.id)
      expect(new Set(slotIds).size).toBe(slotIds.length)
      expect(Object.keys(preset.defaults.slots).sort()).toEqual([...slotIds].sort())

      for (const slot of preset.slots) {
        const value = preset.defaults.slots[slot.id]
        expect(value).toBeDefined()
        if (!value) continue

        expect(Object.prototype.hasOwnProperty.call(slot.editors, value.activeKind)).toBe(true)
        expect({
          text: value.text,
          icon: value.icon,
          image: value.image,
          media: value.media,
        }[value.activeKind]).toBeDefined()

        if (value.activeKind === 'icon' && value.icon && slot.editors.icon) {
          expect(slot.editors.icon.iconIds).toContain(value.icon.iconId)
        }
      }
    })

    it(`renders every ${preset.id} slot as an editable DOM target`, () => {
      const Component = preset.Component
      const markup = renderToStaticMarkup(
        <Component
          state={preset.defaults}
          viewport={{
            width: preset.designSize.width,
            height: preset.designSize.height,
            designWidth: preset.designSize.width,
            designHeight: preset.designSize.height,
          }}
        />,
      )

      for (const slot of preset.slots) {
        expect(markup).toContain(`data-wc-slot="${slot.id}"`)
      }
    })
  }
})
