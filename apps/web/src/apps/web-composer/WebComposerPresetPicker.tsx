import type { WebComposerPresetId } from '@mediatoolbox/contracts'
import { createPortal } from 'react-dom'

import { useWindowHeaderPortalTarget } from '@/windowHeaderPortal'
import { presets } from './presets'

export function WebComposerPresetPicker({ activePresetId, onSelect }: {
  activePresetId: WebComposerPresetId
  onSelect: (presetId: WebComposerPresetId) => void
}) {
  const portalTarget = useWindowHeaderPortalTarget()

  if (!portalTarget) return null

  return createPortal(
    <label className="wc-preset-picker">
      <span>预设</span>
      <select
        aria-label="预设模板"
        value={activePresetId}
        onChange={(event) => onSelect(event.target.value as WebComposerPresetId)}
      >
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name} · {preset.style}
          </option>
        ))}
      </select>
    </label>,
    portalTarget,
  )
}
