import type { JobRecord } from '@mediatoolbox/contracts'
import type { JobExecutionRecord } from '@mediatoolbox/db'
import { transitionJob } from '@mediatoolbox/job-core'
import path from 'node:path'

import type { ApiState } from './state.js'
import { formatLogTime } from './utils.js'
import { grantIdFromMarker, normalizeWorkspacePath, resolvePathOrGrantMarker, revokeGrantsBoundToJob } from './workspace-path.js'
import { toPhysicalWorkspacePath } from './workspace-files.js'
import { scheduleDownload } from './download-executor.js'
import { scheduleTranscode } from './transcode-executor.js'
import { readDownloadExecution, readTranscodeExecution } from './job-execution-payload.js'

const interruptedStatuses = new Set(['queued', 'running', 'paused'])
export const INTERRUPTED_JOB_MESSAGE = 'API 重启导致任务中断，且任务不可安全恢复；请重新提交任务。'
export const RESUMED_JOB_MESSAGE = 'API 重启中断了上一次执行，任务已从持久化载荷恢复。'

export async function recoverInterruptedJobs(state: ApiState): Promise<number> {
  const jobs = await state.db.jobs.list()
  const interruptedJobs = jobs.filter((job) => interruptedStatuses.has(job.status))

  let recoveredCount = 0
  for (const job of interruptedJobs) {
    const execution = await state.db.jobs.findExecutionByJobId(job.id)
    const resumableJob = execution ? await prepareResumableJob(state, job, execution) : undefined
    if (resumableJob && restoreExecution(state, resumableJob, execution!)) {
      recoveredCount += 1
      await state.db.logs.create({
        level: 'NOTICE',
        module: 'jobs',
        time: formatLogTime(),
        user: 'api',
        event: '续跑中断任务',
        message: `任务 ${job.id}（${job.title}）已从持久化执行载荷恢复。`,
      })
      continue
    }

    if (await failInterruptedJob(state, job)) recoveredCount += 1
  }

  return recoveredCount
}

async function prepareResumableJob(
  state: ApiState,
  job: JobRecord,
  execution: JobExecutionRecord,
): Promise<JobRecord | undefined> {
  if (!await isExecutionCompatible(state, job, execution) || job.status === 'paused') return undefined
  if (job.status === 'queued') return job
  if (job.status !== 'running' || job.attempt >= job.maxAttempts) return undefined

  const queued = {
    ...transitionJob(job, 'queued'),
    nextAttemptAt: Math.floor(Date.now() / 1000),
    errorMessage: RESUMED_JOB_MESSAGE,
  }
  return await state.db.jobs.updateIfStatus(queued, 'running') ? queued : undefined
}

async function isExecutionCompatible(state: ApiState, job: JobRecord, execution: JobExecutionRecord): Promise<boolean> {
  if (job.kind === 'media.transcode') return validateTranscodeExecution(state, job, execution)
  if (job.kind === 'download.video' || job.kind === 'download.audio' || job.kind === 'download.subtitle') {
    return validateDownloadExecution(state, execution, job.id)
  }
  return false
}

function validateDownloadExecution(state: ApiState, execution: JobExecutionRecord, jobId: string): boolean {
  const download = readDownloadExecution(execution, jobId)
  if (!download) return false
  const params = download.task.params
  const outputDir = params['output_dir']
  if (typeof outputDir !== 'string') return false
  try {
    if (normalizeWorkspacePath(outputDir, state.workspaceRoot) !== outputDir) return false
    const rawUrls = Array.isArray(params['urls']) ? params['urls'] : [params['url']]
    const urls = rawUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    return urls.length > 0 && urls.every((value) => {
      const protocol = new URL(value).protocol
      return protocol === 'http:' || protocol === 'https:'
    })
  } catch {
    return false
  }
}

async function validateTranscodeExecution(state: ApiState, job: JobRecord, execution: JobExecutionRecord): Promise<boolean> {
  const transcode = readTranscodeExecution(execution)
  if (!transcode) return false
  try {
    const inputPath = await resolvePathOrGrantMarker(state, transcode.inputSource, 'file.read')
    if (!samePhysicalPath(inputPath, transcode.workerJob.inputPath)) return false

    const outputGrantId = grantIdFromMarker(transcode.outputVirtualPath)
    if (outputGrantId) {
      const grant = await state.db.pathGrants.findById(outputGrantId)
      return Boolean(
        grant
        && grant.kind === 'file.write'
        && grant.status === 'consumed'
        && grant.jobId === job.id
        && samePhysicalPath(grant.physicalPath, transcode.workerJob.outputPath),
      )
    }

    const virtualPath = normalizeWorkspacePath(transcode.outputVirtualPath, state.workspaceRoot)
    const exportsRoot = `${state.workspaceRoot}/Exports/`
    return virtualPath.startsWith(exportsRoot)
      && samePhysicalPath(toPhysicalWorkspacePath(state, virtualPath), transcode.workerJob.outputPath)
  } catch {
    return false
  }
}

function samePhysicalPath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left)
  const normalizedRight = path.resolve(right)
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight
}

function restoreExecution(state: ApiState, job: JobRecord, execution: JobExecutionRecord): boolean {
  const download = readDownloadExecution(execution, job.id)
  if (download) {
    const task = {
      ...download.task,
      status: 'pending' as const,
      stage: 'API 重启后恢复排队',
      updated_at: Math.floor(Date.now() / 1000),
      completed_at: null,
      error: null,
    }
    state.fetchTasks.unshift(task)
    scheduleDownload(task, state)
    return true
  }

  const transcode = readTranscodeExecution(execution)
  if (transcode) {
    scheduleTranscode(job, transcode.workerJob, state, transcode.outputVirtualPath)
    return true
  }
  return false
}

async function failInterruptedJob(state: ApiState, job: JobRecord): Promise<boolean> {
  const current = await state.db.jobs.findById(job.id)
  if (!current || !interruptedStatuses.has(current.status)) return false
  const failedJob = {
    ...transitionJob(current, 'failed'),
    errorMessage: INTERRUPTED_JOB_MESSAGE,
  }
  delete failedJob.nextAttemptAt
  const updated = await state.db.jobs.updateIfStatus(failedJob, current.status)
  if (!updated) return false

  await revokeGrantsBoundToJob(state, job.id)
  await state.db.logs.create({
    level: 'WARNING',
    module: 'jobs',
    time: formatLogTime(),
    user: 'api',
    event: '恢复中断任务',
    message: `任务 ${job.id}（${job.title}）因 API 重启被标记为失败。`,
  })
  return true
}
