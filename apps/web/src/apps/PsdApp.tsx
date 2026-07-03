import { useCallback, useState, type FormEvent } from 'react'

import { inspectPsdTemplate } from '@/api'
import type { PsdTemplateManifest } from '@/api/types'

export function PsdApp() {
  const [psdPath, setPsdPath] = useState('/Workspace/PSD/template.psd')
  const [manifest, setManifest] = useState<PsdTemplateManifest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inspect = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if (!psdPath.trim() || loading) return
    setLoading(true)
    setError('')
    setManifest(null)
    try {
      const result = await inspectPsdTemplate(psdPath.trim())
      if (!result.manifest) throw new Error(result.message || 'PSD 模板检查未返回 manifest')
      setManifest(result.manifest)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PSD 模板检查失败')
    } finally {
      setLoading(false)
    }
  }, [loading, psdPath])

  return (
    <div className="psd-app">
      <aside className="psd-sidebar">
        <button className="psd-nav psd-nav--active" type="button">
          <span className="psd-nav__icon">PSD</span>
          <span>模板检查</span>
          <small>{manifest?.slots.length ?? 0}</small>
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
      </main>
    </div>
  )
}
