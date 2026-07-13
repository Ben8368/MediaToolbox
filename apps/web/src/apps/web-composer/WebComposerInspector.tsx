import { useState } from 'react'
import type { ChangeEvent } from 'react'
import type {
  WebComposerPresetState,
} from '@mediatoolbox/contracts'

import { filebrowserFileDownloadUrl, uploadFilebrowserFile } from '@/api'
import { ResizableAppSidebar } from '@/components/ResizableAppSidebar'
import type { PresetDefinition } from './presets/types'

export function WebComposerInspector({
  preset,
  state,
  busy,
  onStateChange,
  onExport,
  onReset,
}: {
  preset: PresetDefinition
  state: WebComposerPresetState
  busy: boolean
  onStateChange: (state: WebComposerPresetState) => void
  onExport: (kind: 'png' | 'webm') => void
  onReset: () => void
}) {
  const [uploadStatus, setUploadStatus] = useState('')

  const updateText = (key: string, value: string) => {
    onStateChange({ ...state, texts: { ...state.texts, [key]: value } })
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadStatus(`正在导入 ${file.name}…`)
    try {
      const result = await uploadFilebrowserFile('/Workspace', file)
      if (!result.ok || !result.path) throw new Error(result.message || '素材导入失败。')
      onStateChange({
        ...state,
        backgroundKind: file.type.startsWith('video/') ? 'video' : 'image',
        backgroundUrl: filebrowserFileDownloadUrl(result.path),
      })
      setUploadStatus(`已导入：${result.name || file.name}`)
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : '素材导入失败。')
    }
  }

  return (
    <ResizableAppSidebar className="wc-inspector" storageKey="web-composer" aria-label="预设属性编辑器">
      <div className="wc-inspector-content">
      <section className="wc-inspector-section">
        <header><strong>文案</strong><span>{preset.fields.length} 个 Slot</span></header>
        {preset.fields.map((field) => (
          <label className="wc-field" key={field.key}>
            <span>{field.label}</span>
            {field.kind === 'textarea' ? (
              <textarea
                value={state.texts[field.key] ?? ''}
                maxLength={field.maxLength}
                onChange={(event) => updateText(field.key, event.target.value)}
              />
            ) : (
              <input
                value={state.texts[field.key] ?? ''}
                maxLength={field.maxLength}
                onChange={(event) => updateText(field.key, event.target.value)}
              />
            )}
          </label>
        ))}
        <div className="wc-copy-note">
          <strong>{preset.name} · 模板已锁定</strong>
          <span>只修改预设声明的文案、素材与颜色，不改变页面结构。</span>
        </div>
      </section>

      <section className="wc-inspector-section">
        <header><strong>样式变量</strong><span>不改变布局</span></header>
        <label className="wc-field">
          <span>标题字体</span>
          <input value={state.headingFont} onChange={(event) => onStateChange({ ...state, headingFont: event.target.value })} />
        </label>
        <label className="wc-field">
          <span>正文字体</span>
          <input value={state.bodyFont} onChange={(event) => onStateChange({ ...state, bodyFont: event.target.value })} />
        </label>
        <div className="wc-color-row">
          <label className="wc-field">
            <span>强调色</span>
            <input type="color" value={state.accentColor} onChange={(event) => onStateChange({ ...state, accentColor: event.target.value })} />
          </label>
          <label className="wc-field">
            <span>文字色</span>
            <input type="color" value={state.textColor} onChange={(event) => onStateChange({ ...state, textColor: event.target.value })} />
          </label>
        </div>
      </section>

      <section className="wc-inspector-section">
        <header><strong>背景素材</strong><span>图片 / 视频</span></header>
        <div className="wc-segmented">
          <button type="button" className={state.backgroundKind === 'video' ? 'is-active' : ''} onClick={() => onStateChange({ ...state, backgroundKind: 'video' })}>视频</button>
          <button type="button" className={state.backgroundKind === 'image' ? 'is-active' : ''} onClick={() => onStateChange({ ...state, backgroundKind: 'image' })}>图片</button>
        </div>
        <label className="wc-field">
          <span>素材 URL</span>
          <textarea value={state.backgroundUrl} onChange={(event) => onStateChange({ ...state, backgroundUrl: event.target.value })} />
        </label>
        <label className="wc-upload">
          从工作区导入素材
          <input type="file" accept="image/*,video/*" onChange={handleUpload} />
        </label>
        {uploadStatus && <p className="wc-inline-status">{uploadStatus}</p>}
      </section>
      </div>

      <div className="wc-inspector-actions">
        <div className="wc-export-actions" aria-label="导出操作">
          <button type="button" disabled={busy} onClick={() => onExport('png')}>导出 PNG</button>
          <button type="button" disabled={busy} onClick={() => onExport('webm')}>导出 MP4</button>
        </div>
        <button className="wc-reset" type="button" disabled={busy} onClick={onReset}>恢复预设默认值</button>
      </div>
    </ResizableAppSidebar>
  )
}
