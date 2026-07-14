import { useCallback, useState, type FormEvent } from 'react'

import { applyWorkOrder, getJob, getWorkOrder, scanPsd, updateWorkOrder } from '@/api'
import { useExternalReadGrant, useExternalWriteGrant } from '@/hooks/useExternalPathGrant'
import { ResizableAppSidebar } from '@/components/ResizableAppSidebar'
import type { JobRecord, WorkOrder, TextLayerRecord, TranslationLanguage } from '@mediatoolbox/contracts'
import { PsdPanels, type PsdActiveTab } from './psd/PsdPanels'

const TERMINAL_STATUSES = new Set<JobRecord['status']>(['succeeded', 'failed', 'canceled'])

const DEFAULT_PSD_PATH = '/Workspace/PSD/document.psd'

export function PsdApp() {
  const [activeTab, setActiveTab] = useState<PsdActiveTab>('scan')

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
      if (!scanResult.ok) {
        throw new Error(scanResult.message || 'PSD 扫描失败')
      }
      // 扫描已转为异步 Job；轮询等待 Photoshop 完成后查询工单。
      const completedJob = await pollUntilTerminal(scanResult.job.id)
      if (completedJob.status !== 'succeeded') {
        throw new Error(completedJob.errorMessage || `PSD 扫描未完成（状态：${completedJob.status}）。`)
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
      if (!result.ok) {
        throw new Error(result.message || '应用失败')
      }
      // 应用已转为异步 Job；轮询等待 Photoshop 完成后展示结果。
      const completedJob = await pollUntilTerminal(result.job.id)
      if (completedJob.status === 'succeeded') {
        setApplyResult({
          success: true,
          message: '工单应用完成。',
        })
      } else {
        setApplyResult({
          success: false,
          message: completedJob.errorMessage || `工单应用未完成（状态：${completedJob.status}）。`,
        })
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

        <PsdPanels
          activeTab={activeTab}
          workOrder={workOrder}
          scanError={scanError}
          workOrderDirty={workOrderDirty}
          saving={saving}
          saveMessage={saveMessage}
          onSaveWorkOrder={() => void saveWorkOrder()}
          onUpdateRecord={updateRecord}
          changedCount={changedCount}
          applying={applying}
          applyResult={applyResult}
          onApply={apply}
          outputGrant={outputGrant}
          targetLanguage={targetLanguage}
          onTargetLanguageChange={setTargetLanguage}
          customPrompt={customPrompt}
          onCustomPromptChange={setCustomPrompt}
        />
      </main>
    </div>
  )
}

async function pollUntilTerminal(jobId: string, timeoutMs = 300_000): Promise<JobRecord> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await getJob(jobId)
    if (!result.job) throw new Error('任务记录不存在或已被清理。')
    if (TERMINAL_STATUSES.has(result.job.status)) return result.job
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('PSD 任务等待超时；任务可能仍在后台执行，可在任务中心查看或取消。')
}
