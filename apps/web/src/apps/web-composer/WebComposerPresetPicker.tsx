import { useEffect, useState } from 'react'
import type { WebComposerPresetId } from '@mediatoolbox/contracts'
import { createPortal } from 'react-dom'

import { useWindowHeaderPortalTarget } from '@/windowHeaderPortal'
import type { PresetDefinition } from './presets/types'
import { presets } from './presets'

const thumbnailCopy = {
  'trace-grid': { eyebrow: 'TRACE GRID', title: 'Tracing\nthe unseen', action: 'Start scan' },
  'vex-vision': { eyebrow: 'VEX', title: 'Shaping tomorrow\nwith vision and action.', action: 'Start a Chat' },
  foundation: { eyebrow: 'FOUNDATION', title: 'Foundation of the\nnew digital epoch', action: 'Contact Us' },
  'multi-showcase': { eyebrow: 'BYTEPLUS', title: '多展示', action: 'Learn more' },
  lumora: { eyebrow: 'LUMORA', title: 'Find your\nnext path', action: 'Explore' },
  vaultshield: { eyebrow: 'VAULTSHIELD', title: 'Lock Down Your\nPasswords\nwith Ironclad Security', action: 'Get It Free' },
  viktor: { eyebrow: 'VIKTOR', title: 'VIKTOR\nSTUDIO', action: 'View projects' },
} as const

function PresetThumbnail({ preset }: { preset: PresetDefinition }) {
  const copy = thumbnailCopy[preset.id]

  return (
    <div className={`wc-preset-thumb wc-preset-thumb--${preset.id}`} aria-hidden="true">
      <span className="wc-preset-thumb__eyebrow">{copy.eyebrow}</span>
      <strong className="wc-preset-thumb__title">{copy.title}</strong>
      <span className="wc-preset-thumb__action">{copy.action}</span>
    </div>
  )
}

export function WebComposerPresetDialog({ activePresetId, onSelect, onClose }: {
  activePresetId: WebComposerPresetId
  onSelect: (presetId: WebComposerPresetId) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="wc-preset-dialog-overlay" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="选择预设"
        className="wc-preset-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="wc-preset-dialog__header">
          <strong>选择预设</strong>
          <button
            type="button"
            className="wc-preset-dialog__close"
            aria-label="关闭"
            onClick={onClose}
          />
        </div>
        <div className="wc-preset-dialog__grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`wc-preset-card${preset.id === activePresetId ? ' is-active' : ''}`}
              onClick={() => { onSelect(preset.id); onClose() }}
            >
              <div className="wc-preset-card__thumb">
                <PresetThumbnail preset={preset} />
              </div>
              <div className="wc-preset-card__info">
                <strong>{preset.name}</strong>
                <span>{preset.style}</span>
                <p>{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function WebComposerPresetPicker({ activePresetId, onSelect }: {
  activePresetId: WebComposerPresetId
  onSelect: (presetId: WebComposerPresetId) => void
}) {
  const portalTarget = useWindowHeaderPortalTarget()
  const [open, setOpen] = useState(false)
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0]

  const trigger = portalTarget ? createPortal(
    <div className="wc-preset-picker">
      <button
        type="button"
        className="wc-preset-picker__trigger"
        aria-label={`选择预设：${activePreset.name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <strong>{activePreset.name}</strong>
        <span className="wc-preset-picker__chevron" aria-hidden="true" />
      </button>
    </div>,
    portalTarget,
  ) : null

  return (
    <>
      {trigger}
      {open && (
        <WebComposerPresetDialog
          activePresetId={activePresetId}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
