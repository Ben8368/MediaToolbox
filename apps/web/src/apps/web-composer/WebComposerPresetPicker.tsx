import { useEffect, useId, useRef, useState } from 'react'
import type { WebComposerPresetId } from '@mediatoolbox/contracts'
import { createPortal } from 'react-dom'

import { useWindowHeaderPortalTarget } from '@/windowHeaderPortal'
import { presets } from './presets'

export function WebComposerPresetPicker({ activePresetId, onSelect }: {
  activePresetId: WebComposerPresetId
  onSelect: (presetId: WebComposerPresetId) => void
}) {
  const portalTarget = useWindowHeaderPortalTarget()
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0]

  useEffect(() => {
    if (!open) return
    const closeIfOutside = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeIfOutside)
    return () => document.removeEventListener('mousedown', closeIfOutside)
  }, [open])

  if (!portalTarget) return null

  return createPortal(
    <div className="wc-preset-picker" ref={pickerRef}>
      <button
        type="button"
        className="wc-preset-picker__trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="wc-preset-picker__label">预设</span>
        <strong>{activePreset.name}</strong>
        <span className="wc-preset-picker__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="wc-preset-picker__menu" id={menuId} role="menu" aria-label="选择预设">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="menuitemradio"
              aria-checked={preset.id === activePresetId}
              className={preset.id === activePresetId ? 'is-active' : ''}
              onClick={() => {
                onSelect(preset.id)
                setOpen(false)
              }}
            >
              <strong>{preset.name}</strong>
              <span>{preset.style}</span>
            </button>
          ))}
        </div>
      )}
    </div>,
    portalTarget,
  )
}
