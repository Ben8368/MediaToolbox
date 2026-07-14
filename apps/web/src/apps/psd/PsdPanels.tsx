import type { FormEventHandler } from 'react'

import type { TextLayerRecord, TranslationLanguage, WorkOrder } from '@mediatoolbox/contracts'

export type PsdActiveTab = 'scan' | 'workorder' | 'apply' | 'translate'

const TRANSLATION_LANGUAGES: Array<{ value: TranslationLanguage; label: string }> = [
  { value: 'ja', label: '日语 (Japanese)' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'pt', label: '葡萄牙语 (Portuguese)' },
  { value: 'en', label: '英语 (English)' },
  { value: 'ko', label: '韩语 (Korean)' },
  { value: 'fr', label: '法语 (French)' },
  { value: 'de', label: '德语 (German)' },
  { value: 'es', label: '西班牙语 (Spanish)' },
]

type PsdPanelsProps = {
  activeTab: PsdActiveTab
  workOrder: WorkOrder | null
  scanError: string
  workOrderDirty: boolean
  saving: boolean
  saveMessage: { success: boolean; text: string } | null
  onSaveWorkOrder: () => void
  onUpdateRecord: (index: number, field: keyof TextLayerRecord, value: unknown) => void
  changedCount: number
  applying: boolean
  applyResult: { success: boolean; message: string; outputPath?: string } | null
  onApply: FormEventHandler<HTMLFormElement>
  outputGrant: {
    grantId: string | null
    clearGrant: () => void
    selectOutputPath: (defaultPath?: string) => Promise<void>
  }
  targetLanguage: TranslationLanguage
  onTargetLanguageChange: (language: TranslationLanguage) => void
  customPrompt: string
  onCustomPromptChange: (prompt: string) => void
}

export function PsdPanels(props: PsdPanelsProps) {
  const {
    activeTab, workOrder, scanError, workOrderDirty, saving, saveMessage,
    onSaveWorkOrder, onUpdateRecord, changedCount, applying, applyResult,
    onApply, outputGrant, targetLanguage, onTargetLanguageChange,
    customPrompt, onCustomPromptChange,
  } = props
  const targetLanguageLabel = TRANSLATION_LANGUAGES
    .find((language) => language.value === targetLanguage)?.label.split(' ')[0] ?? '目标语言'
  const defaultPrompt = `把所选画板的文案翻译成${targetLanguageLabel}，需要适配本地化翻译，同时文案长度和原文相接近，行数保持一致`

  if (activeTab === 'scan') {
    return (
      <section className="psd-result">
        {!workOrder && !scanError && <div className="psd-empty">选择 PSD/PSB 文件后点击「扫描文件」，工单将自动创建。</div>}
        {workOrder && (
          <>
            <div className="psd-summary">
              <strong>{workOrder.psdFileName}</strong>
              <span>{workOrder.documentWidth}×{workOrder.documentHeight}px · {workOrder.documentResolution}dpi · {workOrder.records.length} 个文字图层</span>
            </div>
            <div className="psd-slot-table">
              <div className="psd-slot-row psd-slot-row--head">
                <span>图层路径</span><span>原始文案</span><span>字体</span><span>大小 / 行高</span>
              </div>
              {workOrder.records.map((record) => (
                <div className="psd-slot-row" key={record.id}>
                  <span className="psd-layer-path">{record.soChain.length > 0 ? '[SO] ' : ''}{record.layerPath}</span>
                  <span className="psd-text-preview">{record.originalText}</span>
                  <span>{record.originalFontFamily} {record.originalFontStyle}</span>
                  <span>{record.originalSizePt}pt{record.originalLeadingPt ? ` / ${record.originalLeadingPt}pt` : ''}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    )
  }

  if (!workOrder) return null

  if (activeTab === 'workorder') {
    return (
      <section className="psd-result psd-editor">
        <div className="psd-editor-header">
          <strong>工单编辑 — {workOrder.psdFileName}</strong>
          <button className="mt-btn mt-btn--primary" type="button" disabled={!workOrderDirty || saving} onClick={onSaveWorkOrder}>
            {saving ? '保存中...' : '保存工单'}
          </button>
        </div>
        {saveMessage && <div className={`psd-message psd-message--${saveMessage.success ? 'ok' : 'error'}`}>{saveMessage.text}</div>}
        <div className="psd-wo-table">
          <div className="psd-wo-row psd-wo-row--head">
            <span>启用</span><span>图层</span><span>原始文案</span><span>新文案</span><span>新字族</span><span>新字重</span>
          </div>
          {workOrder.records.map((record, index) => (
            <div className="psd-wo-row" key={record.id}>
              <input type="checkbox" checked={record.enabled} onChange={(event) => onUpdateRecord(index, 'enabled', event.target.checked)} title="启用此图层" />
              <span className="psd-layer-path" title={record.layerPath}>
                {record.soChain.length > 0 && <span className="psd-so-badge">SO</span>}
                {record.layerPath.split('/').pop()}
              </span>
              <span className="psd-text-preview" title={record.originalText}>{record.originalText}</span>
              <input className="psd-wo-input" value={record.newText ?? ''} onChange={(event) => onUpdateRecord(index, 'newText', event.target.value || undefined)} placeholder={record.originalText} disabled={!record.enabled} />
              <input className="psd-wo-input" value={record.newFontFamily ?? ''} onChange={(event) => onUpdateRecord(index, 'newFontFamily', event.target.value || undefined)} placeholder={record.originalFontFamily} disabled={!record.enabled} />
              <input className="psd-wo-input" value={record.newFontStyle ?? ''} onChange={(event) => onUpdateRecord(index, 'newFontStyle', event.target.value || undefined)} placeholder={record.originalFontStyle || 'Regular'} disabled={!record.enabled} />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (activeTab === 'apply') {
    return (
      <section className="psd-result">
        <form className="psd-apply-form" onSubmit={onApply}>
          <div className="psd-apply-info">
            <div><span>源文件</span><strong>{workOrder.psdFileName}</strong></div>
            <div><span>待改图层</span><strong>{changedCount} / {workOrder.records.length}</strong></div>
          </div>
          {workOrderDirty && <div className="psd-message psd-message--error">工单有未保存的修改，请先在「工单编辑」保存再应用。</div>}
          <div className="psd-apply-output">
            <span>输出路径</span>
            <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
              {outputGrant.grantId ? (
                <>
                  <span className="psd-grant-label">已授权外部路径</span>
                  <button type="button" className="mt-btn" onClick={outputGrant.clearGrant} title="取消">✕</button>
                </>
              ) : <span className="psd-grant-label psd-grant-label--none">工作区 Exports 目录（自动生成文件名）</span>}
              <button type="button" className="mt-btn" onClick={() => void outputGrant.selectOutputPath()}>选择外部路径</button>
            </div>
          </div>
          <button className="mt-btn mt-btn--primary" type="submit" disabled={applying || workOrderDirty || changedCount === 0}>
            {applying ? '应用中（自适应算法运行中）...' : `应用工单（${changedCount} 个图层）`}
          </button>
        </form>
        {applyResult && (
          <div className={`psd-message psd-message--${applyResult.success ? 'ok' : 'error'}`}>
            <strong>{applyResult.message}</strong>
            {applyResult.outputPath && <p>输出：{applyResult.outputPath}</p>}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="psd-result psd-translate">
      <div className="psd-translate-notice">
        <span className="psd-badge psd-badge--coming">功能预留</span>
        <p>AI 自动翻译功能暂未开放。接口已预留，后续接入 AI Agent 时可直接扩展。</p>
      </div>
      <div className="psd-translate-config">
        <label className="mt-field">
          <span>目标语言</span>
          <select className="psd-slot-select" value={targetLanguage} onChange={(event) => onTargetLanguageChange(event.target.value as TranslationLanguage)}>
            {TRANSLATION_LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
          </select>
        </label>
        <label className="mt-field">
          <span>自定义提示词（可选）</span>
          <textarea className="psd-translate-prompt" value={customPrompt} onChange={(event) => onCustomPromptChange(event.target.value)} placeholder={defaultPrompt} rows={3} />
        </label>
        <div className="psd-translate-preview"><span>预览提示词：</span><code>{customPrompt || defaultPrompt}</code></div>
        <button className="mt-btn mt-btn--primary" type="button" disabled title="AI 翻译功能暂未开放">发送翻译请求（暂未开放）</button>
      </div>
    </section>
  )
}
