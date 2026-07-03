import type { RuntimeMetrics } from './types'
import { clampPercent, taskStatusClass, appTypeForTaskGroup } from './utils'

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

type TaskGroup = {
  type: string
  label: string
  tasks: NonNullable<RuntimeMetrics['tasks']>
  progress: number
  statusSummary: string
}

export function TaskGroupList({
  tasks,
  groupedTasks,
  expandedGroup,
  taskSummary,
  onExpand,
  onCollapse,
  onCancelTask,
}: {
  tasks: NonNullable<RuntimeMetrics['tasks']>
  groupedTasks: TaskGroup[]
  expandedGroup: TaskGroup | null
  taskSummary: RuntimeMetrics['task_summary']
  onExpand: (type: string) => void
  onCollapse: () => void
  onCancelTask: (taskId: string) => void
}) {
  return (
    <div className="rp-card">
      <div className="rp-card-head">
        <div className="rp-card-title">任务中心</div>
        <div className="rp-card-meta">
          {taskSummary?.active_downloads ?? tasks.length} 进行中
          {typeof taskSummary?.total_download_records === 'number' && ` / ${taskSummary.total_download_records} 记录`}
        </div>
      </div>
      <div className="rp-card-hint">右侧仅显示当前进行中的任务，历史记录请在下载应用中查看。</div>
      {expandedGroup ? (
        <div className="rp-task-group-detail">
          <button type="button" className="rp-back-btn" onClick={onCollapse}>
            <BackIcon />
            返回任务中心
          </button>
          <div className="rp-task-group-title">
            <strong>{expandedGroup.label}</strong>
            <small>{expandedGroup.tasks.length} 个任务</small>
          </div>
          {expandedGroup.tasks.map((task) => (
            <div key={task.id} className="rp-task-item" title={task.stage || task.status}>
              <div className="rp-task-head">
                <div className="rp-task-main">
                  <span className="rp-task-name">{task.source || task.name}</span>
                  <span className={`rp-task-status ${taskStatusClass(task.status)}`}>{task.status_label || task.status}</span>
                </div>
                <div className="rp-task-actions">
                  <button
                    type="button"
                    className="rp-task-btn rp-task-btn--stop"
                    title="停止任务"
                    disabled={!task.can_cancel}
                    onClick={() => onCancelTask(task.id)}
                  >
                    停止
                  </button>
                </div>
              </div>
              <div className="rp-task-sub">{task.stage || task.id}</div>
              <div className="rp-task-progress-row">
                <div className="rp-storage-bar"><div className="rp-storage-bar-fill" style={{ width: `${clampPercent(task.progress)}%` }} /></div>
                <span className="rp-storage-sizes">{Math.round(clampPercent(task.progress))}%</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        groupedTasks.map((group) => {
          const appType = appTypeForTaskGroup(group.type, group.label)
          const progress = clampPercent(group.progress)
          return (
            <button
              key={group.type}
              type="button"
              className="rp-task-group"
              onClick={() => onExpand(group.type)}
            >
              <div className="rp-task-group-head">
                <div className="rp-task-group-title">
                  <strong>{group.label}</strong>
                  <small>{group.statusSummary}</small>
                </div>
                <span className="rp-task-group-count">{group.tasks.length} 个</span>
              </div>
              <div className="rp-task-group-tools">
                <span className="rp-task-group-kind">{appType ? '查看任务详情' : '任务详情'}</span>
                <span className="rp-task-group-percent">{Math.round(progress)}%</span>
              </div>
              <div className="rp-task-progress-row">
                <div className="rp-storage-bar"><div className="rp-storage-bar-fill" style={{ width: `${progress}%` }} /></div>
              </div>
            </button>
          )
        })
      )}
      {!tasks.length && <div className="rp-empty">当前没有任务</div>}
    </div>
  )
}
