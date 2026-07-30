import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { cancelJob, listJobs, submitTranscodeJob, probeTranscodeSource, previewTranscodeCommand } from '@/api'
import type { JobRecord, TranscodeJobDraft, TranscodeSourceInfo } from '@/api/types'
import { formatEstimatedSize, TRANSCODE_PRESETS, TRANSCODE_PRESET_EXTENSIONS } from '@/apps/transcode/helpers'
import { TranscodeJobSections } from '@/apps/transcode/TranscodeJobSections'
import { ResizableAppSidebar } from '@/components/ResizableAppSidebar'
import { useExternalReadGrant } from '@/hooks/useExternalPathGrant'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'

export function TranscodeApp() {
  const inputGrant = useExternalReadGrant('')
  const [outputPath, setOutputPath] = useState('/Workspace/Exports/output.mp4')
  const [preset, setPreset] = useState<NonNullable<TranscodeJobDraft['preset']>>('mp4-h265-aac')
  const [title, setTitle] = useState('')
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [videoCrf, setVideoCrf] = useState(20)
  const [videoEncodePreset, setVideoEncodePreset] = useState<NonNullable<TranscodeJobDraft['videoEncodePreset']>>('slow')
  const [audioBitrate, setAudioBitrate] = useState(192)
  const [sourceInfo, setSourceInfo] = useState<TranscodeSourceInfo | null>(null)
  const [probing, setProbing] = useState(false)
  const [useTargetBitrate, setUseTargetBitrate] = useState(false)
  const [targetBitrateKbps, setTargetBitrateKbps] = useState(8000)
  const [enableVmaf, setEnableVmaf] = useState(false)
  const [commandPreview, setCommandPreview] = useState<string[] | null>(null)
  const [batchPaths, setBatchPaths] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchResult, setBatchResult] = useState('')

  const transcodeJobs = useMemo(
    () => jobs.filter((job) => job.kind === 'media.transcode'),
    [jobs],
  )

  const refreshJobs = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await listJobs(signal)
      if (signal?.aborted) return
      setJobs(result.jobs ?? [])
      setError('')
    } catch (err: unknown) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : '任务列表加载失败')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useVisibilityPolling(refreshJobs, 2000)

  useEffect(() => {
    if (!inputGrant.displayPath.trim() && !inputGrant.grantId) {
      setSourceInfo(null)
      return
    }

    const draft = inputGrant.grantId ? { inputGrantId: inputGrant.grantId } : { inputPath: inputGrant.displayPath.trim() }
    let cancelled = false
    const timer = setTimeout(async () => {
      setProbing(true)
      try {
        const result = await probeTranscodeSource(draft)
        if (cancelled) return
        if (result.ok && result.source) {
          setSourceInfo(result.source)
          setVideoCrf(result.source.recommendedCrf)
          setVideoEncodePreset(result.source.recommendedEncodePreset as NonNullable<TranscodeJobDraft['videoEncodePreset']>)
          setAudioBitrate(result.source.recommendedAudioBitrate)
          if (result.source.recommendedPreset) {
            setPreset(result.source.recommendedPreset as NonNullable<TranscodeJobDraft['preset']>)
          }
        } else {
          setSourceInfo(null)
        }
      } catch {
        if (!cancelled) setSourceInfo(null)
      } finally {
        if (!cancelled) setProbing(false)
      }
    }, inputGrant.grantId ? 0 : 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [inputGrant.displayPath, inputGrant.grantId])

  useEffect(() => {
    if (preset === 'copy' || preset === 'remux') {
      setCommandPreview(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const result = await previewTranscodeCommand({
          ...(inputGrant.displayPath.trim() ? { inputPath: inputGrant.displayPath.trim() } : {}),
          ...(outputPath.trim() ? { outputPath: outputPath.trim() } : {}),
          preset,
          videoCrf,
          videoEncodePreset,
          audioBitrate,
          ...(useTargetBitrate ? { targetBitrateKbps } : {}),
        })
        if (!cancelled) setCommandPreview(result.ok ? (result.args ?? null) : null)
      } catch {
        if (!cancelled) setCommandPreview(null)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [preset, videoCrf, videoEncodePreset, audioBitrate, useTargetBitrate, targetBitrateKbps, inputGrant.displayPath, outputPath])

  const submit = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if ((!inputGrant.displayPath.trim() && !inputGrant.grantId) || !outputPath.trim() || submitting) return
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const isReencode = preset !== 'copy' && preset !== 'remux'
      const job = await submitTranscodeJob({
        outputPath: outputPath.trim(),
        preset,
        ...(inputGrant.grantId ? { inputGrantId: inputGrant.grantId } : { inputPath: inputGrant.displayPath.trim() }),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(isReencode ? { videoCrf, videoEncodePreset, audioBitrate } : {}),
        ...(isReencode && useTargetBitrate ? { targetBitrateKbps } : {}),
        ...(isReencode && enableVmaf ? { enableVmaf } : {}),
      })
      setNotice(`已创建：${job.title}`)
      await refreshJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '转码任务提交失败')
    } finally {
      setSubmitting(false)
    }
  }, [inputGrant.displayPath, outputPath, preset, refreshJobs, submitting, title, inputGrant.grantId, videoCrf, videoEncodePreset, audioBitrate, useTargetBitrate, targetBitrateKbps, enableVmaf])

  const submitBatch = useCallback(async () => {
    const paths = batchPaths.split('\n').map((p) => p.trim()).filter(Boolean)
    if (paths.length === 0 || batchSubmitting) return
    setBatchSubmitting(true)
    setBatchResult('')
    let succeeded = 0
    const isReencode = preset !== 'copy' && preset !== 'remux'
    for (const path of paths) {
      try {
        const fileName = path.split('/').pop() ?? 'output'
        const baseName = fileName.replace(/\.[^.]+$/, '')
        const ext = TRANSCODE_PRESET_EXTENSIONS[preset]
        const outPath = `/Workspace/Exports/${baseName}.${ext}`
        await submitTranscodeJob({
          inputPath: path,
          outputPath: outPath,
          preset,
          ...(isReencode ? { videoCrf, videoEncodePreset, audioBitrate } : {}),
          ...(isReencode && useTargetBitrate ? { targetBitrateKbps } : {}),
          ...(isReencode && enableVmaf ? { enableVmaf } : {}),
        })
        succeeded += 1
      } catch {
      }
    }
    setBatchResult(`已提交 ${succeeded}/${paths.length} 个批量任务`)
    setBatchSubmitting(false)
    await refreshJobs()
  }, [batchPaths, batchSubmitting, preset, videoCrf, videoEncodePreset, audioBitrate, useTargetBitrate, targetBitrateKbps, enableVmaf, refreshJobs])

  const cancel = useCallback(async (jobId: string) => {
    setError('')
    setNotice('')
    try {
      await cancelJob(jobId)
      await refreshJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '取消任务失败')
    }
  }, [refreshJobs])

  return (
    <div className="transcode-app">
      <ResizableAppSidebar className="transcode-sidebar" storageKey="transcode">
        <button className="transcode-nav transcode-nav--active" type="button">
          <span className="transcode-nav__icon">TC</span>
          <span>转码</span>
          <small>{transcodeJobs.length}</small>
        </button>
      </ResizableAppSidebar>

      <main className="transcode-panel">
        <form className="transcode-form" onSubmit={submit}>
          <label className="mt-field">
            <span>输入路径</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                value={inputGrant.displayPath}
                onChange={(event) => {
                  inputGrant.setDisplayPath(event.target.value)
                  if (inputGrant.grantId) inputGrant.clearGrant()
                }}
                placeholder="/Workspace/Downloads/source.mov"
                readOnly={!!inputGrant.grantId}
                style={{ flex: 1 }}
              />
              {inputGrant.grantId && (
                <button
                  type="button"
                  className="mt-btn"
                  onClick={inputGrant.clearGrant}
                  title="清除外部文件授权"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                className="mt-btn"
                onClick={() => void inputGrant.importExternal()}
                title="从外部导入文件（需要桌面版）"
              >
                从外部导入
              </button>
            </div>
          </label>
          {(probing || sourceInfo) && (
            <div className="transcode-source-info">
              {probing && <span className="transcode-source-info__probing">分析中...</span>}
              {!probing && sourceInfo && (
                <>
                  <div className="transcode-source-info__meta">
                    {sourceInfo.videoCodec && (
                      <span>{sourceInfo.videoCodec.toUpperCase()}{sourceInfo.width && sourceInfo.height ? ` ${sourceInfo.width}×${sourceInfo.height}` : ''}{sourceInfo.fps ? ` / ${sourceInfo.fps} fps` : ''}</span>
                    )}
                    {sourceInfo.audioCodec && <span>{sourceInfo.audioCodec.toUpperCase()}</span>}
                    {sourceInfo.bitrateKbps && <span>{sourceInfo.bitrateKbps} kbps</span>}
                  </div>
                  {sourceInfo.notes.length > 0 && (
                    <ul className="transcode-source-info__notes">
                      {sourceInfo.notes.map((note, i) => <li key={i}>{note}</li>)}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
          <label className="mt-field">
            <span>输出路径</span>
            <input value={outputPath} onChange={(event) => setOutputPath(event.target.value)} placeholder="/Workspace/Exports/output.mp4" />
          </label>
          <label className="mt-field">
            <span>预设</span>
            <select value={preset} onChange={(event) => setPreset(event.target.value as NonNullable<TranscodeJobDraft['preset']>)}>
              {TRANSCODE_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          {preset !== 'copy' && preset !== 'remux' && (
            <>
              <label className="mt-field">
                <span>视频质量 CRF（越低越好，推荐 18–24）</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="range"
                    min={0}
                    max={51}
                    value={videoCrf}
                    onChange={(e) => setVideoCrf(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '28px', textAlign: 'right' }}>{videoCrf}</span>
                </div>
              </label>
              <label className="mt-field">
                <span>编码速度</span>
                <select value={videoEncodePreset} onChange={(e) => setVideoEncodePreset(e.target.value as NonNullable<TranscodeJobDraft['videoEncodePreset']>)}>
                  <option value="fast">快速（体积较大）</option>
                  <option value="slow">均衡（推荐）</option>
                  <option value="veryslow">最优（速度最慢）</option>
                </select>
              </label>
              {preset !== 'audio-mp3' && (
                <label className="mt-field">
                  <span>音频码率（kbps）</span>
                  <select value={audioBitrate} onChange={(e) => setAudioBitrate(Number(e.target.value))}>
                    <option value={128}>128</option>
                    <option value={192}>192（推荐）</option>
                    <option value={256}>256</option>
                    <option value={320}>320</option>
                  </select>
                </label>
              )}
              <label className="mt-field">
                <span>
                  <input type="checkbox" checked={useTargetBitrate} onChange={(e) => setUseTargetBitrate(e.target.checked)} />
                  {' '}使用目标码率（2-pass，优先于 CRF）
                </span>
              </label>
              {useTargetBitrate && (
                <label className="mt-field">
                  <span>目标码率（kbps）</span>
                  <input type="number" min={500} max={100000} value={targetBitrateKbps} onChange={(e) => setTargetBitrateKbps(Number(e.target.value))} />
                </label>
              )}
              <label className="mt-field">
                <span>
                  <input type="checkbox" checked={enableVmaf} onChange={(e) => setEnableVmaf(e.target.checked)} />
                  {' '}转码后验证画质（VMAF，耗时较长）
                </span>
              </label>
              {sourceInfo && sourceInfo.durationSeconds && (
                <div className="transcode-estimate">
                  预估输出体积：{formatEstimatedSize(sourceInfo, videoCrf, useTargetBitrate ? targetBitrateKbps : undefined, audioBitrate)}
                </div>
              )}
              {commandPreview && (
                <div className="transcode-command-preview">
                  <code>{commandPreview.join(' ')}</code>
                </div>
              )}
            </>
          )}
          <label className="mt-field">
            <span>任务名</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="可选" />
          </label>
          <button className="mt-btn mt-btn--primary transcode-submit" type="submit" disabled={(!inputGrant.displayPath.trim() && !inputGrant.grantId) || !outputPath.trim() || submitting}>
            {submitting ? '提交中' : '开始转码'}
          </button>
        </form>

        {(error || notice) && (
          <div className={`transcode-message ${error ? 'transcode-message--error' : ''}`}>
            {error || notice}
          </div>
        )}

        <TranscodeJobSections
          jobs={transcodeJobs}
          loading={loading}
          onRefresh={() => void refreshJobs()}
          onCancel={(jobId) => void cancel(jobId)}
          batchPaths={batchPaths}
          onBatchPathsChange={setBatchPaths}
          batchSubmitting={batchSubmitting}
          batchResult={batchResult}
          onSubmitBatch={() => void submitBatch()}
        />
      </main>
    </div>
  )
}
