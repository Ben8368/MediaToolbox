import type { JobRecord } from '@/api/types'

const STATUS_LABELS: Record<JobRecord['status'], string> = {
  queued: '排队',
  running: '运行中',
  paused: '暂停',
  succeeded: '完成',
  failed: '失败',
  canceled: '取消',
}

const TERMINAL_STATUSES = new Set<JobRecord['status']>(['succeeded', 'failed', 'canceled'])

type TranscodeJobSectionsProps = {
  jobs: JobRecord[]
  loading: boolean
  onRefresh: () => void
  onCancel: (jobId: string) => void
  batchPaths: string
  onBatchPathsChange: (paths: string) => void
  batchSubmitting: boolean
  batchResult: string
  onSubmitBatch: () => void
}

export function TranscodeJobSections(props: TranscodeJobSectionsProps) {
  const {
    jobs, loading, onRefresh, onCancel, batchPaths, onBatchPathsChange,
    batchSubmitting, batchResult, onSubmitBatch,
  } = props

  return (
    <>
      <section className="transcode-jobs">
        <div className="transcode-jobs__header">
          <strong>转码队列</strong>
          <button className="mt-btn" type="button" onClick={onRefresh} disabled={loading}>刷新</button>
        </div>

        <div className="transcode-table">
          <div className="transcode-row transcode-row--head">
            <span>任务</span><span>状态</span><span>进度</span><span>操作</span>
          </div>
          {loading && <div className="transcode-empty">正在加载任务</div>}
          {!loading && jobs.length === 0 && <div className="transcode-empty">暂无转码任务</div>}
          {jobs.map((job) => (
            <div className="transcode-row" key={job.id}>
              <span><strong>{job.title}</strong>{job.errorMessage && <small>{job.errorMessage}</small>}</span>
              <span><i className={`transcode-status transcode-status--${job.status}`} />{STATUS_LABELS[job.status]}</span>
              <span>{formatProgress(job)}</span>
              <span>
                <button className="mt-btn" type="button" disabled={TERMINAL_STATUSES.has(job.status)} onClick={() => onCancel(job.id)}>取消</button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="transcode-batch">
        <div className="transcode-jobs__header"><strong>批量转码（使用当前预设与质量设置）</strong></div>
        <label className="mt-field">
          <span>批量输入路径（每行一个工作区路径）</span>
          <textarea value={batchPaths} onChange={(event) => onBatchPathsChange(event.target.value)} placeholder={'/Workspace/Downloads/a.mov\n/Workspace/Downloads/b.mov'} rows={4} />
        </label>
        <button className="mt-btn mt-btn--primary" type="button" onClick={onSubmitBatch} disabled={!batchPaths.trim() || batchSubmitting}>
          {batchSubmitting ? '提交中' : '批量提交'}
        </button>
        {batchResult && <div className="transcode-message">{batchResult}</div>}
      </section>
    </>
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
