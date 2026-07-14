import { useCallback, useState, type FormEvent } from 'react'

import { applyWorkOrder, getWorkOrder, scanPsd, updateWorkOrder } from '@/api'
import { useExternalReadGrant, useExternalWriteGrant } from '@/hooks/useExternalPathGrant'
import { ResizableAppSidebar } from '@/components/ResizableAppSidebar'
import type { WorkOrder, TextLayerRecord, TranslationLanguage } from '@mediatoolbox/contracts'

const DEFAULT_PSD_PATH = '/Workspace/PSD/document.psd'

type ActiveTab = 'scan' | 'workorder' | 'apply' | 'translate'

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

export function PsdApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scan')

  // 扫描状态
  const inputGrant = useExternalReadGrant(DEFAULT_PSD_PATH)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  // 工单状态
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [workOrderDirty, setWorkOrderDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ success: boolean; text: string } | null>(null)

  // 应用状态
  const outputGrant = useExternalWriteGrant()
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string; outputPath?: string } | null>(null)

  // AI 翻译状态
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>('ja')
  const [customPrompt, setCustomPrompt] = useState('')

  const scan = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if (scanning) return
    setScanning(true)
    setScanError('')
    setWorkOrder(null)
    setWorkOrderDirty(false)
    setSaveMessage(null)
    setApplyResult(null)
    try {
      const scanResult = await scanPsd(inputGrant.displayPath.trim(), inputGrant.grantId ?? undefined)
      if (!scanResult.ok || !scanResult.workOrderId) {
        throw new Error(scanResult.message || 'PSD 扫描失败')
      }
      const woResult = await getWorkOrder(scanResult.workOrderId)
      if (!woResult.ok || !woResult.workOrder) {
        throw new Error(woResult.message || '获取工单失败')
      }
      setWorkOrder(woResult.workOrder)
      setActiveTab('workorder')
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : '扫描失败')
    } finally {
      setScanning(false)
    }
  }, [scanning, inputGrant.displayPath, inputGrant.grantId])

  const updateRecord = useCallback((index: number, field: keyof TextLayerRecord, value: unknown) => {
    if (!workOrder) return
    const records = workOrder.records.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    setWorkOrder({ ...workOrder, records })
    setWorkOrderDirty(true)
  }, [workOrder])

  const saveWorkOrder = useCallback(async () => {
    if (!workOrder || saving) return
    setSaving(true)
    setSaveMessage(null)
    try {
      const result = await updateWorkOrder(workOrder)
      if (result.ok) {
        setWorkOrderDirty(false)
        setSaveMessage({ success: true, text: '工单已保存' })
      } else {
        setSaveMessage({ success: false, text: result.message || '保存失败' })
      }
    } catch (err: unknown) {
      setSaveMessage({ success: false, text: err instanceof Error ? err.message : '保存失败' })
    } finally {
      setSaving(false)
    }
  }, [workOrder, saving])

  const apply = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if (!workOrder || applying) return
    if (workOrderDirty) {
      setApplyResult({ success: false, message: '工单有未保存的修改，请先在「工单编辑」保存。' })
      return
    }
    setApplying(true)
    setApplyResult(null)
    try {
      const result = await applyWorkOrder(workOrder.id, undefined, outputGrant.grantId ?? undefined)
      if (result.ok) {
        setApplyResult({
          success: true,
          message: `应用完成：${result.appliedCount ?? 0} 个图层已修改，${result.skippedCount ?? 0} 个跳过`,
          outputPath: result.outputPath,
        })
      } else {
        setApplyResult({ success: false, message: result.message || '应用失败' })
      }
    } catch (err: unknown) {
      setApplyResult({ success: false, message: err instanceof Error ? err.message : '应用失败' })
    } finally {
      setApplying(false)
    }
  }, [workOrder, applying, workOrderDirty, outputGrant.grantId])

  const enabledCount = workOrder?.records.filter((r) => r.enabled).length ?? 0
  const changedCount = workOrder?.records.filter((r) => r.enabled && (r.newText !== undefined || r.newFontFamily !== undefined)).length ?? 0

  return (
    <div className="psd-app">
      <ResizableAppSidebar className="psd-sidebar" storageKey="psd">
        <button
          className={`psd-nav${activeTab === 'scan' ? ' psd-nav--active' : ''}`}
          type="button"
          onClick={() => setActiveTab('scan')}
        >
          <span className="psd-nav__icon">⊙</span>
          <span>扫描</span>
        </button>
        <button
          className={`psd-nav${activeTab === 'workorder' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!workOrder}
          onClick={() => setActiveTab('workorder')}
        >
          <span className="psd-nav__icon">≡</span>
          <span>工单编辑</span>
          {workOrderDirty && <small>●</small>}
          {workOrder && <small>{enabledCount}</small>}
        </button>
        <button
          className={`psd-nav${activeTab === 'apply' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!workOrder}
          onClick={() => setActiveTab('apply')}
        >
          <span className="psd-nav__icon">▶</span>
          <span>应用输出</span>
          {workOrder && <small>{changedCount}</small>}
        </button>
        <button
          className={`psd-nav${activeTab === 'translate' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!workOrder}
          onClick={() => setActiveTab('translate')}
        >
          <span className="psd-nav__icon">AI</span>
          <span>AI 翻译</span>
          <small className="psd-nav__beta">预留</small>
        </button>
      </ResizableAppSidebar>

      <main className="psd-panel">
        {/* 顶部文件栏 */}
        <form className="psd-form" onSubmit={scan}>
          <label className="mt-field">
            <span>PSD / PSB 路径</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                value={inputGrant.displayPath}
                onChange={(e) => { inputGrant.setDisplayPath(e.target.value); if (inputGrant.grantId) inputGrant.clearGrant() }}
                placeholder="/Workspace/PSD/document.psd"
                readOnly={!!inputGrant.grantId}
                style={{ flex: 1 }}
              />
              {inputGrant.grantId && (
                <button type="button" className="mt-btn" onClick={inputGrant.clearGrant} title="清除授权">✕</button>
              )}
              <button type="button" className="mt-btn" onClick={inputGrant.importExternal} title="从外部导入（需要桌面版）">从外部导入</button>
            </div>
          </label>
          <button className="mt-btn mt-btn--primary" type="submit" disabled={!inputGrant.displayPath.trim() || scanning}>
            {scanning ? '扫描中...' : '扫描文件'}
          </button>
        </form>

        {scanError && <div className="psd-message psd-message--error">{scanError}</div>}

        {/* Tab: 扫描结果 */}
        {activeTab === 'scan' && (
          <section className="psd-result">
            {!workOrder && !scanError && (
              <div className="psd-empty">选择 PSD/PSB 文件后点击「扫描文件」，工单将自动创建。</div>
            )}
            {workOrder && (
              <>
                <div className="psd-summary">
                  <strong>{workOrder.psdFileName}</strong>
                  <span>{workOrder.documentWidth}×{workOrder.documentHeight}px · {workOrder.documentResolution}dpi · {workOrder.records.length} 个文字图层</span>
                </div>
                <div className="psd-slot-table">
                  <div className="psd-slot-row psd-slot-row--head">
                    <span>图层路径</span>
                    <span>原始文案</span>
                    <span>字体</span>
                    <span>大小 / 行高</span>
                  </div>
                  {workOrder.records.map((rec) => (
                    <div className="psd-slot-row" key={rec.id}>
                      <span className="psd-layer-path">{rec.soChain.length > 0 ? `[SO] ` : ''}{rec.layerPath}</span>
                      <span className="psd-text-preview">{rec.originalText}</span>
                      <span>{rec.originalFontFamily} {rec.originalFontStyle}</span>
                      <span>{rec.originalSizePt}pt{rec.originalLeadingPt ? ` / ${rec.originalLeadingPt}pt` : ''}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Tab: 工单编辑 */}
        {activeTab === 'workorder' && workOrder && (
          <section className="psd-result psd-editor">
            <div className="psd-editor-header">
              <strong>工单编辑 — {workOrder.psdFileName}</strong>
              <button
                className="mt-btn mt-btn--primary"
                type="button"
                disabled={!workOrderDirty || saving}
                onClick={saveWorkOrder}
              >
                {saving ? '保存中...' : '保存工单'}
              </button>
            </div>
            {saveMessage && (
              <div className={`psd-message psd-message--${saveMessage.success ? 'ok' : 'error'}`}>{saveMessage.text}</div>
            )}
            <div className="psd-wo-table">
              <div className="psd-wo-row psd-wo-row--head">
                <span>启用</span>
                <span>图层</span>
                <span>原始文案</span>
                <span>新文案</span>
                <span>新字族</span>
                <span>新字重</span>
              </div>
              {workOrder.records.map((rec, index) => (
                <div className="psd-wo-row" key={rec.id}>
                  <input
                    type="checkbox"
                    checked={rec.enabled}
                    onChange={(e) => updateRecord(index, 'enabled', e.target.checked)}
                    title="启用此图层"
                  />
                  <span className="psd-layer-path" title={rec.layerPath}>
                    {rec.soChain.length > 0 && <span className="psd-so-badge">SO</span>}
                    {rec.layerPath.split('/').pop()}
                  </span>
                  <span className="psd-text-preview" title={rec.originalText}>{rec.originalText}</span>
                  <input
                    className="psd-wo-input"
                    value={rec.newText ?? ''}
                    onChange={(e) => updateRecord(index, 'newText', e.target.value || undefined)}
                    placeholder={rec.originalText}
                    disabled={!rec.enabled}
                  />
                  <input
                    className="psd-wo-input"
                    value={rec.newFontFamily ?? ''}
                    onChange={(e) => updateRecord(index, 'newFontFamily', e.target.value || undefined)}
                    placeholder={rec.originalFontFamily}
                    disabled={!rec.enabled}
                  />
                  <input
                    className="psd-wo-input"
                    value={rec.newFontStyle ?? ''}
                    onChange={(e) => updateRecord(index, 'newFontStyle', e.target.value || undefined)}
                    placeholder={rec.originalFontStyle || 'Regular'}
                    disabled={!rec.enabled}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab: 应用输出 */}
        {activeTab === 'apply' && workOrder && (
          <section className="psd-result">
            <form className="psd-apply-form" onSubmit={apply}>
              <div className="psd-apply-info">
                <div><span>源文件</span><strong>{workOrder.psdFileName}</strong></div>
                <div><span>待改图层</span><strong>{changedCount} / {workOrder.records.length}</strong></div>
              </div>
              {workOrderDirty && (
                <div className="psd-message psd-message--error">工单有未保存的修改，请先在「工单编辑」保存再应用。</div>
              )}
              <div className="psd-apply-output">
                <span>输出路径</span>
                <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                  {outputGrant.grantId ? (
                    <>
                      <span className="psd-grant-label">已授权外部路径</span>
                      <button type="button" className="mt-btn" onClick={outputGrant.clearGrant} title="取消">✕</button>
                    </>
                  ) : (
                    <span className="psd-grant-label psd-grant-label--none">工作区 Exports 目录（自动生成文件名）</span>
                  )}
                  <button type="button" className="mt-btn" onClick={() => void outputGrant.selectOutputPath()}>选择外部路径</button>
                </div>
              </div>
              <button
                className="mt-btn mt-btn--primary"
                type="submit"
                disabled={applying || workOrderDirty || changedCount === 0}
              >
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
        )}

        {/* Tab: AI 翻译（占位） */}
        {activeTab === 'translate' && workOrder && (
          <section className="psd-result psd-translate">
            <div className="psd-translate-notice">
              <span className="psd-badge psd-badge--coming">功能预留</span>
              <p>AI 自动翻译功能暂未开放。接口已预留，后续接入 AI Agent 时可直接扩展。</p>
            </div>
            <div className="psd-translate-config">
              <label className="mt-field">
                <span>目标语言</span>
                <select
                  className="psd-slot-select"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value as TranslationLanguage)}
                >
                  {TRANSLATION_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </label>
              <label className="mt-field">
                <span>自定义提示词（可选）</span>
                <textarea
                  className="psd-translate-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={`把所选画板的文案翻译成${TRANSLATION_LANGUAGES.find(l => l.value === targetLanguage)?.label.split(' ')[0] ?? '目标语言'}，需要适配本地化翻译，同时文案长度和原文相接近，行数保持一致`}
                  rows={3}
                />
              </label>
              <div className="psd-translate-preview">
                <span>预览提示词：</span>
                <code>{customPrompt || `把所选画板的文案翻译成${TRANSLATION_LANGUAGES.find(l => l.value === targetLanguage)?.label.split(' ')[0] ?? '目标语言'}，需要适配本地化翻译，同时文案长度和原文相接近，行数保持一致`}</code>
              </div>
              <button className="mt-btn mt-btn--primary" type="button" disabled title="AI 翻译功能暂未开放">
                发送翻译请求（暂未开放）
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
