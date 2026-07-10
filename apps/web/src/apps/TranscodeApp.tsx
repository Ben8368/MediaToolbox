import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { cancelJob, listJobs, submitTranscodeJob, probeTranscodeSource } from '@/api'
import type { JobRecord, TranscodeJobDraft, TranscodeSourceInfo } from '@/api/types'
import { requestReadGrant } from '@/api/real/pathGrants'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'

const PRESETS: Array<{ value: NonNullable<TranscodeJobDraft['preset']>; label: string }> = [
  { value: 'mp4-h265-aac', label: 'MP4 H.265 / AAC（推荐）' },
  { value: 'mp4-h264-aac', label: 'MP4 H.264 / AAC' },
  { value: 'mkv-h265-aac', label: 'MKV H.265 / AAC（保留字幕）' },
  { value: 'remux', label: 'Remux（仅转封装）' },
  { value: 'audio-aac', label: 'AAC 音频' },
  { value: 'audio-mp3', label: 'MP3 音频' },
  { value: 'copy', label: '流复制' },
]

const STATUS_LABELS: Record<JobRecord['status'], string> = {
  queued: '排队',
  running: '运行中',
  paused: '暂停',
  succeeded: '完成',
  failed: '失败',
  retrying: '重试',
  canceled: '取消',
}

const TERMINAL_STATUSES = new Set<JobRecord['status']>(['succeeded', 'failed', 'canceled'])

export function TranscodeApp() {
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('/Workspace/Exports/output.mp4')
  const [preset, setPreset] = useState<NonNullable<TranscodeJobDraft['preset']>>('mp4-h265-aac')
  const [title, setTitle] = useState('')
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inputGrantId, setInputGrantId] = useState<string | null>(null)
  const [inputGrantLabel, setInputGrantLabel] = useState<string>('')
  const [videoCrf, setVideoCrf] = useState(20)
  const [videoEncodePreset, setVideoEncodePreset] = useState<NonNullable<TranscodeJobDraft['videoEncodePreset']>>('slow')
  const [audioBitrate, setAudioBitrate] = useState(192)
  const [sourceInfo, setSourceInfo] = useState<TranscodeSourceInfo | null>(null)
  const [probing, setProbing] = useState(false)

  const transcodeJobs = useMemo(
    () => jobs.filter((job) => job.kind === 'media.transcode'),
    [jobs],
  )

  const refreshJobs = useCallback(async () => {
    try {
      const result = await listJobs()
      setJobs(result.jobs ?? [])
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '任务列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useVisibilityPolling(refreshJobs, 2000)

  useEffect(() => {
    if (!inputPath.trim() && !inputGrantId) {
      setSourceInfo(null)
      return
    }

    const draft = inputGrantId ? { inputGrantId } : { inputPath: inputPath.trim() }
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
    }, inputGrantId ? 0 : 600)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [inputPath, inputGrantId])

  const importExternal = useCallback(async () => {
    const grant = await requestReadGrant()
    if (!grant) return
    setInputGrantId(grant.id)
    setInputGrantLabel(grant.displayName)
    setInputPath(`[外部文件] ${grant.displayName}`)
  }, [])

  const submit = useCallback(async (event: FormEvent) => {
    event.preventDefault()
    if ((!inputPath.trim() && !inputGrantId) || !outputPath.trim() || submitting) return
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const isReencode = preset !== 'copy' && preset !== 'remux'
      const job = await submitTranscodeJob({
        outputPath: outputPath.trim(),
        preset,
        ...(inputGrantId ? { inputGrantId } : { inputPath: inputPath.trim() }),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(isReencode ? { videoCrf, videoEncodePreset, audioBitrate } : {}),
      })
      setNotice(`已创建：${job.title}`)
      await refreshJobs()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '转码任务提交失败')
    } finally {
      setSubmitting(false)
    }
  }, [inputPath, outputPath, preset, refreshJobs, submitting, title, inputGrantId, videoCrf, videoEncodePreset, audioBitrate])

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
      <aside className="transcode-sidebar">
        <button className="transcode-nav transcode-nav--active" type="button">
          <span className="transcode-nav__icon">TC</span>
          <span>转码</span>
          <small>{transcodeJobs.length}</small>
        </button>
      </aside>

      <main className="transcode-panel">
        <form className="transcode-form" onSubmit={submit}>
          <label className="mt-field">
            <span>输入路径</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                value={inputPath}
                onChange={(event) => {
                  setInputPath(event.target.value)
                  if (inputGrantId) { setInputGrantId(null); setInputGrantLabel('') }
                }}
                placeholder="/Workspace/Downloads/source.mov"
                readOnly={!!inputGrantId}
                style={{ flex: 1 }}
              />
              {inputGrantId && (
                <button
                  type="button"
                  className="mt-btn"
                  onClick={() => { setInputGrantId(null); setInputGrantLabel(''); setInputPath('') }}
                  title="清除外部文件授权"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                className="mt-btn"
                onClick={() => void importExternal()}
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
              {PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
            </>
          )}
          <label className="mt-field">
            <span>任务名</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="可选" />
          </label>
          <button className="mt-btn mt-btn--primary transcode-submit" type="submit" disabled={(!inputPath.trim() && !inputGrantId) || !outputPath.trim() || submitting}>
            {submitting ? '提交中' : '开始转码'}
          </button>
        </form>

        {(error || notice) && (
          <div className={`transcode-message ${error ? 'transcode-message--error' : ''}`}>
            {error || notice}
          </div>
        )}

        <section className="transcode-jobs">
          <div className="transcode-jobs__header">
            <strong>转码队列</strong>
            <button className="mt-btn" type="button" onClick={() => void refreshJobs()} disabled={loading}>刷新</button>
          </div>

          <div className="transcode-table">
            <div className="transcode-row transcode-row--head">
              <span>任务</span>
              <span>状态</span>
              <span>进度</span>
              <span>操作</span>
            </div>
            {loading && <div className="transcode-empty">正在加载任务</div>}
            {!loading && transcodeJobs.length === 0 && <div className="transcode-empty">暂无转码任务</div>}
            {transcodeJobs.map((job) => (
              <div className="transcode-row" key={job.id}>
                <span>
                  <strong>{job.title}</strong>
                  {job.errorMessage && <small>{job.errorMessage}</small>}
                </span>
                <span><i className={`transcode-status transcode-status--${job.status}`} />{STATUS_LABELS[job.status]}</span>
                <span>{formatProgress(job)}</span>
                <span>
                  <button className="mt-btn" type="button" disabled={TERMINAL_STATUSES.has(job.status)} onClick={() => void cancel(job.id)}>
                    取消
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function formatProgress(job: JobRecord): string {
  if (!job.progress) return '-'
  const value = job.progress.total > 0
    ? Math.round((job.progress.current / job.progress.total) * 100)
    : job.progress.current
  if (job.progress.unit === 'percent') return `${Math.min(100, Math.max(0, value))}%`
  return `${job.progress.current}/${job.progress.total} ${job.progress.unit}`
}
