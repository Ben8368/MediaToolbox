import { useCallback, useState, type FormEvent } from 'react'

import { inspectPsdTemplate, loadPsdManifest, renderPsdTemplate, savePsdManifest } from '@/api'
import type { PsdTemplateManifest } from '@/api/types'

type ActiveTab = 'inspect' | 'editor' | 'batch'
type TemplateSlotKind = 'text' | 'image' | 'smart-object' | 'shape' | 'canvas'

export function PsdApp() {
  const [psdPath, setPsdPath] = useState('/Workspace/PSD/template.psd')
  const [manifest, setManifest] = useState<PsdTemplateManifest | null>(null)
  const [editableManifest, setEditableManifest] = useState<PsdTemplateManifest | null>(null)
  const [manifestDirty, setManifestDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('inspect')

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ success: boolean; text: string } | null>(null)

  const [batchInputs, setBatchInputs] = useState<Record<string, string>>({})
  const [rendering, setRendering] = useState(false)
  const [renderResult, setRenderResult] = useState<{ success: boolean; message: string; outputPath?: string } | null>(null)

  const inspect = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if (!psdPath.trim() || loading) return
    const trimmedPath = psdPath.trim()
    setLoading(true)
    setError('')
    setManifest(null)
    setEditableManifest(null)
    setManifestDirty(false)
    setRenderResult(null)
    setSaveMessage(null)
    try {
      const loaded = await loadPsdManifest(trimmedPath).catch(() => null)
      const result = loaded?.manifest ? loaded : await inspectPsdTemplate(trimmedPath)
      if (!result.manifest) throw new Error(result.message || 'PSD 模板检查未返回 manifest')
      setManifest(result.manifest)
      setEditableManifest(JSON.parse(JSON.stringify(result.manifest)))
      setActiveTab('editor')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PSD 模板检查失败')
    } finally {
      setLoading(false)
    }
  }, [loading, psdPath])

  const saveManifest = useCallback(async () => {
    if (!editableManifest || saving) return
    setSaving(true)
    setSaveMessage(null)
    try {
      const snapshot = JSON.parse(JSON.stringify(editableManifest)) as PsdTemplateManifest
      const result = await savePsdManifest(snapshot)
      if (result.ok) {
        setManifest(snapshot)
        setManifestDirty(false)
        setSaveMessage({ success: true, text: 'Manifest 已保存' })
      } else {
        setSaveMessage({ success: false, text: result.message || '保存失败' })
      }
    } catch (err: unknown) {
      setSaveMessage({ success: false, text: err instanceof Error ? err.message : '保存失败' })
    } finally {
      setSaving(false)
    }
  }, [editableManifest, saving])

  const updateSlot = useCallback(
    (index: number, field: string, value: unknown) => {
      if (!editableManifest) return
      const slots = editableManifest.slots.map((s, i) => (i === index ? { ...s, [field]: value } : s))
      setEditableManifest({ ...editableManifest, slots })
      setManifestDirty(true)
    },
    [editableManifest],
  )

  const submitRender = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!manifest || rendering) return
      setRendering(true)
      setRenderResult(null)
      try {
        const result = await renderPsdTemplate(manifest, batchInputs)
        if (result.ok && result.outputPath) {
          setRenderResult({ success: true, message: '渲染成功', outputPath: result.outputPath })
        } else {
          setRenderResult({ success: false, message: result.message || '渲染失败' })
        }
      } catch (err: unknown) {
        setRenderResult({ success: false, message: err instanceof Error ? err.message : '渲染失败' })
      } finally {
        setRendering(false)
      }
    },
    [manifest, batchInputs, rendering],
  )

  const textSlots = manifest?.slots.filter((s) => s.kind === 'text') ?? []

  return (
    <div className="psd-app">
      <aside className="psd-sidebar">
        <button
          className={`psd-nav${activeTab === 'inspect' ? ' psd-nav--active' : ''}`}
          type="button"
          onClick={() => setActiveTab('inspect')}
        >
          <span className="psd-nav__icon">PSD</span>
          <span>模板检查</span>
          <small>{manifest?.slots.length ?? 0}</small>
        </button>
        <button
          className={`psd-nav${activeTab === 'editor' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!manifest}
          onClick={() => setActiveTab('editor')}
        >
          <span className="psd-nav__icon">✎</span>
          <span>Manifest 编辑</span>
          {manifestDirty && <small>●</small>}
        </button>
        <button
          className={`psd-nav${activeTab === 'batch' ? ' psd-nav--active' : ''}`}
          type="button"
          disabled={!manifest}
          onClick={() => setActiveTab('batch')}
        >
          <span className="psd-nav__icon">▶</span>
          <span>批量渲染</span>
          <small>{textSlots.length}</small>
        </button>
      </aside>

      <main className="psd-panel">
        <form className="psd-form" onSubmit={inspect}>
          <label className="mt-field">
            <span>PSD 路径</span>
            <input value={psdPath} onChange={(event) => setPsdPath(event.target.value)} placeholder="/Workspace/PSD/template.psd" />
          </label>
          <button className="mt-btn mt-btn--primary" type="submit" disabled={!psdPath.trim() || loading}>
            {loading ? '检查中' : '检查模板'}
          </button>
        </form>

        {error && <div className="psd-message psd-message--error">{error}</div>}

        {activeTab === 'inspect' && (
          <section className="psd-result">
            {!manifest && !error && <div className="psd-empty">选择工作区内 PSD 后检查图层 slot。</div>}
            {manifest && (
              <>
                <div className="psd-summary">
                  <strong>{manifest.name}</strong>
                  <span>{manifest.document.width} x {manifest.document.height}px · {manifest.slots.length} slots</span>
                </div>
                <div className="psd-slot-table">
                  <div className="psd-slot-row psd-slot-row--head">
                    <span>Slot</span>
                    <span>类型</span>
                    <span>图层路径</span>
                  </div>
                  {manifest.slots.map((slot) => (
                    <div className="psd-slot-row" key={slot.id}>
                      <span>{slot.label}</span>
                      <span>{slot.kind}</span>
                      <span>{slot.layerPath.join(' / ')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'editor' && editableManifest && (
          <section className="psd-result psd-editor">
            <div className="psd-editor-header">
              <strong>{editableManifest.name}</strong>
              <button
                className="mt-btn mt-btn--primary"
                type="button"
                disabled={!manifestDirty || saving}
                onClick={saveManifest}
              >
                {saving ? '保存中...' : '保存 Manifest'}
              </button>
            </div>
            {saveMessage && (
              <div className={`psd-message psd-message--${saveMessage.success ? 'ok' : 'error'}`}>{saveMessage.text}</div>
            )}
            <div className="psd-slot-table">
              <div className="psd-slot-row psd-slot-row--head">
                <span>Label</span>
                <span>类型</span>
                <span>必填</span>
              </div>
              {editableManifest.slots.map((slot, index) => (
                <div className="psd-slot-row psd-slot-row--edit" key={slot.id}>
                  <input
                    className="psd-slot-input"
                    value={slot.label}
                    onChange={(e) => updateSlot(index, 'label', e.target.value)}
                  />
                  <select
                    className="psd-slot-select"
                    value={slot.kind}
                    onChange={(e) => updateSlot(index, 'kind', e.target.value as TemplateSlotKind)}
                  >
                    <option value="text">text</option>
                    <option value="image">image</option>
                    <option value="smart-object">smart-object</option>
                    <option value="shape">shape</option>
                    <option value="canvas">canvas</option>
                  </select>
                  <input
                    type="checkbox"
                    checked={slot.required ?? false}
                    onChange={(e) => updateSlot(index, 'required', e.target.checked)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'batch' && manifest && (
          <section className="psd-result">
            {textSlots.length === 0 ? (
              <div className="psd-empty">当前模板无可编辑的文字 slot。</div>
            ) : (
              <form className="psd-batch-form" onSubmit={submitRender}>
                <h3 className="psd-batch-title">填写 Slot 值</h3>
                {textSlots.map((slot) => (
                  <label className="mt-field" key={slot.id}>
                    <span>
                      {slot.label}
                      {slot.required && <span className="psd-required"> *</span>}
                    </span>
                    <input
                      value={batchInputs[slot.id] ?? ''}
                      onChange={(e) => setBatchInputs({ ...batchInputs, [slot.id]: e.target.value })}
                      placeholder={`输入 ${slot.label} 的值`}
                      required={slot.required ?? false}
                    />
                  </label>
                ))}
                <button className="mt-btn mt-btn--primary" type="submit" disabled={rendering}>
                  {rendering ? '渲染中...' : '开始渲染'}
                </button>
              </form>
            )}
            {renderResult && (
              <div className={`psd-message psd-message--${renderResult.success ? 'ok' : 'error'}`}>
                <strong>{renderResult.message}</strong>
                {renderResult.outputPath && <p>输出：{renderResult.outputPath}</p>}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
