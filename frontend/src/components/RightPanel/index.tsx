import { useEffect, useMemo, useState } from 'react'
import { cancelTask, getSystemMetrics } from '@/api'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'
import { getErrorMessage } from '@/utils'

import { DualLineChart } from './DualLineChart'
import { GaugeSvg } from './GaugeSvg'
import { TaskGroupList } from './TaskGroupList'
import { EMPTY_METRICS, type RuntimeMetrics } from './types'
import {
  clampPercent,
  formatUptime,
  frontendModeLabel,
  normalizeServices,
  serviceName,
  serviceTitle,
  summarizeGroupStatuses,
} from './utils'

export function RightPanel() {
  const [metrics, setMetrics] = useState<RuntimeMetrics>(EMPTY_METRICS)
  const [netUpData, setNetUpData] = useState<number[]>(Array.from({ length: 40 }, () => 0))
  const [netDownData, setNetDownData] = useState<number[]>(Array.from({ length: 40 }, () => 0))
  const [error, setError] = useState('')
  const [expandedTaskType, setExpandedTaskType] = useState<string | null>(null)
  const [servicesExpanded, setServicesExpanded] = useState(false)

  async function refresh() {
    try {
      const data = await getSystemMetrics()
      setMetrics(data)
      setError('')
      setNetUpData((items) => [...items.slice(1), Number(data.network?.upload_bytes_per_sec || 0)])
      setNetDownData((items) => [...items.slice(1), Number(data.network?.download_bytes_per_sec || 0)])
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '监控数据读取失败')
    }
  }

  async function handleTaskAction(taskId: string) {
    try {
      await cancelTask(taskId)
      await refresh()
    } catch (err: unknown) {
      setError(getErrorMessage(err) || '任务操作失败')
    }
  }

  useVisibilityPolling(refresh, 1000)

  const system = metrics.system || EMPTY_METRICS.system!
  const network = metrics.network || EMPTY_METRICS.network!
  const services = useMemo(() => normalizeServices(metrics.services || []), [metrics.services])
  const tasks = metrics.tasks || []
  const taskSummary = metrics.task_summary
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, { type: string; label: string; tasks: NonNullable<RuntimeMetrics['tasks']>; progress: number; statusSummary: string }>()
    tasks.forEach((task) => {
      const key = task.type || 'unknown'
      if (!groups.has(key)) {
        groups.set(key, { type: key, label: task.name || key, tasks: [], progress: 0, statusSummary: '' })
      }
      groups.get(key)!.tasks.push(task)
    })
    return Array.from(groups.values()).map((group) => {
      const progress = group.tasks.reduce((sum, task) => sum + clampPercent(task.progress), 0) / Math.max(group.tasks.length, 1)
      return {
        ...group,
        progress,
        statusSummary: summarizeGroupStatuses(group.tasks),
      }
    })
  }, [tasks])
  const expandedGroup = groupedTasks.find((group) => group.type === expandedTaskType) || null

  return (
    <div className="fnos-right-panel">
      <div className="rp-card">
        <div className="rp-card-head rp-runtime-head">
          <div className="rp-card-title">运行状态</div>
        </div>
        <div className="rp-gauges">
          <GaugeSvg value={system.cpu_percent || 0} color="#7CB3FF" label="CPU" />
          <GaugeSvg value={system.memory_percent || 0} color="#7CB3FF" label="内存" />
          <GaugeSvg
            value={system.gpu_percent || 0}
            color={system.gpu_available ? '#7CB3FF' : '#64748b'}
            label="GPU"
            title={system.gpu_detail}
            available={system.gpu_available !== false}
          />
        </div>
        <div className="rp-uptime">
          <span>本次运行 <span>{formatUptime(metrics.runtime?.uptime_seconds || 0)}</span></span>
          {frontendModeLabel(metrics.log_mode) && <span className="rp-runtime-mode">{frontendModeLabel(metrics.log_mode)}</span>}
        </div>
        {error && <div className="rp-error">{error}</div>}
      </div>

      <div className="rp-card">
        <div className="rp-card-title">网络</div>
        <div className="rp-net">
          <div className="rp-net-row">
            <span className="rp-net-up">↑ {network.upload?.text || '0 B/s'}</span>
            <span className="rp-net-down">↓ {network.download?.text || '0 B/s'}</span>
          </div>
          <div className="rp-net-chart">
            <DualLineChart dataUp={netUpData} dataDown={netDownData} />
          </div>
        </div>
      </div>

      <div className="rp-card">
        <button
          type="button"
          className="rp-card-head rp-service-toggle"
          aria-expanded={servicesExpanded}
          onClick={() => setServicesExpanded((expanded) => !expanded)}
        >
          <div className="rp-card-title">服务状态</div>
          <span className={`rp-service-chevron ${servicesExpanded ? 'rp-service-chevron--open' : ''}`}>›</span>
        </button>
        {servicesExpanded && (
          <div className="rp-service-list">
            {services.map((service) => (
              <div key={service.id} className="rp-service-item" title={serviceTitle(service)}>
                <span className={`rp-service-dot ${service.online ? 'rp-service-dot--online' : ''}`} />
                <span className="rp-service-name">{serviceName(service)}</span>
              </div>
            ))}
            {!services.length && <div className="rp-empty">暂无服务状态</div>}
          </div>
        )}
      </div>

      <TaskGroupList
        tasks={tasks}
        groupedTasks={groupedTasks}
        expandedGroup={expandedGroup}
        taskSummary={taskSummary}
        onExpand={setExpandedTaskType}
        onCollapse={() => setExpandedTaskType(null)}
        onCancelTask={handleTaskAction}
      />
    </div>
  )
}
