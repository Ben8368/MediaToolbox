import { useMemo, useRef, useState } from 'react'
import type { WebComposerExportSettings, WebComposerPresetId, WebComposerPresetState } from '@mediatoolbox/contracts'

import { createExportSettings, createInitialPresetStates } from './web-composer/model'
import { presetById, presets, clonePresetState } from './web-composer/presets'
import { WebComposerInspector } from './web-composer/WebComposerInspector'
import { WebComposerPresetPicker } from './web-composer/WebComposerPresetPicker'
import { WebComposerPreviewStage } from './web-composer/WebComposerPreviewStage'
import { useWebComposerExport } from './web-composer/useWebComposerExport'

export function WebComposerApp() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [activePresetId, setActivePresetId] = useState<WebComposerPresetId>(presets[0].id)
  const [presetStates, setPresetStates] = useState(createInitialPresetStates)
  const [exportSettings, setExportSettings] = useState<WebComposerExportSettings>(() => createExportSettings())
  const exporter = useWebComposerExport(iframeRef)

  const activePreset = useMemo(() => presetById.get(activePresetId) ?? presets[0], [activePresetId])
  const activeState = presetStates[activePreset.id]

  const updateActiveState = (state: WebComposerPresetState) => {
    setPresetStates((current) => ({ ...current, [activePreset.id]: state }))
  }

  const resetActivePreset = () => {
    updateActiveState(clonePresetState(activePreset.defaults))
  }

  return (
    <div className="wc-app">
      <WebComposerPresetPicker activePresetId={activePresetId} onSelect={setActivePresetId} />
      <div className="wc-workspace">
        <WebComposerInspector
          preset={activePreset}
          state={activeState}
          settings={exportSettings}
          busy={exporter.busy}
          onStateChange={updateActiveState}
          onSettingsChange={setExportSettings}
          onExport={(kind) => void exporter.exportComposition(kind, activePreset.id, exportSettings)}
          onReset={resetActivePreset}
        />
        <WebComposerPreviewStage
          iframeRef={iframeRef}
          presetId={activePreset.id}
          state={activeState}
          settings={exportSettings}
          ready={exporter.ready}
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
        <small>{activePreset.name}@{activePreset.version} · Slot 编辑模式</small>
      </footer>
    </div>
  )
}
