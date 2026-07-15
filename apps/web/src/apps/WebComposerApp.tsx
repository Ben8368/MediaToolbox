import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  WebComposerEditorMode,
  WebComposerExportSettings,
  WebComposerPresetId,
  WebComposerPresetState,
} from '@mediatoolbox/contracts'

import { createExportSettings, createInitialPresetStates, createPreviewSessionId } from './web-composer/model'
import { presetById, presets, clonePresetState } from './web-composer/presets'
import { WebComposerInspector, type WebComposerSlotMetrics } from './web-composer/WebComposerInspector'
import { WebComposerPresetPicker } from './web-composer/WebComposerPresetPicker'
import { WebComposerPreviewStage } from './web-composer/WebComposerPreviewStage'
import { useWebComposerExport } from './web-composer/useWebComposerExport'

export function WebComposerApp() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sessionId = useMemo(createPreviewSessionId, [])
  const [activePresetId, setActivePresetId] = useState<WebComposerPresetId>(presets[0].id)
  const [presetStates, setPresetStates] = useState(createInitialPresetStates)
  const [exportSettings, setExportSettings] = useState<WebComposerExportSettings>(() => createExportSettings())
  const [mode, setMode] = useState<WebComposerEditorMode>('preview')
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<{ slotId: string; rect: WebComposerSlotMetrics } | null>(null)
  const exporter = useWebComposerExport(iframeRef, sessionId)

  const activePreset = useMemo(() => presetById.get(activePresetId) ?? presets[0], [activePresetId])
  const activeState = presetStates[activePreset.id] ?? activePreset.defaults

  const updateActiveState = useCallback((state: WebComposerPresetState) => {
    setPresetStates((current) => ({ ...current, [activePreset.id]: state }))
  }, [activePreset.id])

  const selectPreset = useCallback((presetId: WebComposerPresetId) => {
    const nextPreset = presetById.get(presetId) ?? presets[0]
    setPresetStates((current) => current[nextPreset.id]
      ? current
      : { ...current, [nextPreset.id]: clonePresetState(nextPreset.defaults) })
    setActivePresetId(nextPreset.id)
    setSelectedSlotId(null)
    setSelectedMetrics(null)
    setMode('preview')
  }, [])

  const selectSlot = useCallback((slotId: string | null) => {
    const validSlotId = slotId && activePreset.slots.some((slot) => slot.id === slotId) ? slotId : null
    setSelectedSlotId(validSlotId)
    setSelectedMetrics((current) => current?.slotId === validSlotId ? current : null)
  }, [activePreset.slots])

  const updateSlotMetrics = useCallback((slotId: string, rect: WebComposerSlotMetrics) => {
    setSelectedMetrics({ slotId, rect })
  }, [])

  const resetActivePreset = () => {
    updateActiveState(clonePresetState(activePreset.defaults))
    setSelectedMetrics(null)
  }

  return (
    <div className="wc-app">
      <WebComposerPresetPicker activePresetId={activePresetId} onSelect={selectPreset} />
      <div className="wc-workspace">
        <WebComposerInspector
          preset={activePreset}
          state={activeState}
          selectedSlotId={selectedSlotId}
          metrics={selectedMetrics?.slotId === selectedSlotId ? selectedMetrics.rect : null}
          onStateChange={updateActiveState}
          onSelectSlot={selectSlot}
        />
        <WebComposerPreviewStage
          iframeRef={iframeRef}
          sessionId={sessionId}
          preset={activePreset}
          state={activeState}
          settings={exportSettings}
          ready={exporter.ready}
          mode={mode}
          selectedSlotId={selectedSlotId}
          onModeChange={setMode}
          onSlotSelect={selectSlot}
          onSlotMetrics={updateSlotMetrics}
          onSettingsChange={setExportSettings}
          busy={exporter.busy}
          onExport={(kind) => void exporter.exportComposition(kind, activePreset.id, activePreset.version, exportSettings)}
          onReset={resetActivePreset}
        />
      </div>
      <footer className="wc-statusbar">
        <div>
          <span className={exporter.busy ? 'wc-status-dot wc-status-dot--busy' : 'wc-status-dot'} />
          <span title={exporter.status}>{exporter.status}</span>
        </div>
        {exporter.activeJobId && (
          <button type="button" onClick={() => void exporter.cancel()}>取消任务</button>
        )}
        <small>{activePreset.name}@{activePreset.version} · {mode === 'edit' ? '点击选中 / 左栏编辑' : '交互预览'}</small>
      </footer>
    </div>
  )
}
