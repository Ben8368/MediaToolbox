import type { WebComposerPresetId } from '@mediatoolbox/contracts'

import { presets } from './presets'

export function WebComposerSidebar({ activePresetId, onSelect }: {
  activePresetId: WebComposerPresetId
  onSelect: (presetId: WebComposerPresetId) => void
}) {
  return (
    <aside className="wc-sidebar" aria-label="网页合成预设">
      <div className="wc-sidebar-heading">
        <span>预设模板</span>
        <small>{presets.length}</small>
      </div>
      <div className="wc-preset-list">
        {presets.map((preset) => (
          <button
            className={preset.id === activePresetId ? 'wc-preset wc-preset--active' : 'wc-preset'}
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
          >
            <strong>{preset.name}</strong>
            <span>{preset.style}</span>
            <small>v{preset.version} · 模板已锁定</small>
          </button>
        ))}
      </div>
      <div className="wc-sidebar-note">
        <strong>结构保护</strong>
        <span>只修改预设声明的文案、素材与颜色，不改变页面结构。</span>
      </div>
    </aside>
  )
}
