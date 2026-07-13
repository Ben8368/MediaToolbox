import type { WebComposerPresetState } from '@mediatoolbox/contracts'

import { ResizableAppSidebar } from '@/components/ResizableAppSidebar'
import type { PresetDefinition } from './presets/types'
import { setSlotVisibility } from './slotState'
import { WebComposerCanvasInspector } from './WebComposerCanvasInspector'
import { WebComposerElementOutline } from './WebComposerElementOutline'
import {
  WebComposerSlotEditor,
  type WebComposerSlotMetrics,
} from './WebComposerSlotEditor'

export type { WebComposerSlotMetrics } from './WebComposerSlotEditor'

export function WebComposerInspector({
  preset,
  state,
  selectedSlotId,
  metrics,
  onStateChange,
  onSelectSlot,
}: {
  preset: PresetDefinition
  state: WebComposerPresetState
  selectedSlotId: string | null
  metrics?: WebComposerSlotMetrics | null
  onStateChange: (state: WebComposerPresetState) => void
  onSelectSlot: (slotId: string | null) => void
}) {
  const selectedSlot = selectedSlotId
    ? preset.slots.find((slot) => slot.id === selectedSlotId)
    : undefined
  const selectedValue = selectedSlot ? state.slots[selectedSlot.id] : undefined
  const selectionAnnouncement = selectedSlot
    ? `已选择：${selectedSlot.label}${selectedValue?.visible === false ? '，当前已隐藏' : ''}`
    : '当前显示画布主题设置'

  return (
    <ResizableAppSidebar
      className="wc-inspector wc-context-inspector"
      storageKey="web-composer"
      aria-label="预设上下文编辑器"
    >
      <WebComposerElementOutline
        slots={preset.slots}
        state={state}
        selectedSlotId={selectedSlotId}
        onSelectSlot={onSelectSlot}
        onRestoreSlot={(slotId) => onStateChange(setSlotVisibility(state, slotId, true))}
      />

      <div className="wc-context-content">
        {selectedSlot && selectedValue ? (
          <>
            <button
              type="button"
              className="wc-context-back"
              onClick={() => onSelectSlot(null)}
            >
              ← 返回画布主题
            </button>
            <WebComposerSlotEditor
              key={selectedSlot.id}
              slot={selectedSlot}
              value={selectedValue}
              state={state}
              metrics={metrics}
              onStateChange={onStateChange}
            />
          </>
        ) : (
          <>
            <div className="wc-context-empty">
              <strong>点击画布元素开始编辑</strong>
              <span>可选择文案、Logo、图标或背景；隐藏元素可从上方元素列表恢复。</span>
            </div>
            <WebComposerCanvasInspector
              presetName={preset.name}
              state={state}
              onStateChange={onStateChange}
            />
          </>
        )}
      </div>
      <p className="wc-visually-hidden" aria-live="polite">{selectionAnnouncement}</p>
    </ResizableAppSidebar>
  )
}
