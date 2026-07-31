import type { FetchTaskRecord } from '@mediatoolbox/contracts'
import type { JobExecutionDraft, JobExecutionRecord } from '@mediatoolbox/db'
import type { TranscodeWorkerJob } from '@mediatoolbox/transcode-worker'

export const DOWNLOAD_EXECUTOR = 'download.v1'
export const TRANSCODE_EXECUTOR = 'transcode.v1'

export type DownloadExecutionPayload = {
  task: FetchTaskRecord
}

export type TranscodeExecutionPayload = {
  workerJob: TranscodeWorkerJob
  inputSource: string
  outputVirtualPath: string
}

export function downloadExecution(task: FetchTaskRecord): JobExecutionDraft {
  return { executor: DOWNLOAD_EXECUTOR, payload: { task } satisfies DownloadExecutionPayload }
}

export function transcodeExecution(
  workerJob: TranscodeWorkerJob,
  inputSource: string,
  outputVirtualPath: string,
): JobExecutionDraft {
  return {
    executor: TRANSCODE_EXECUTOR,
    payload: { workerJob, inputSource, outputVirtualPath } satisfies TranscodeExecutionPayload,
  }
}

export function readDownloadExecution(
  execution: JobExecutionRecord,
  jobId: string,
): DownloadExecutionPayload | undefined {
  if (execution.executor !== DOWNLOAD_EXECUTOR || !isRecord(execution.payload)) return undefined
  const task = execution.payload['task']
  if (!isRecord(task) || task['id'] !== jobId || task['task_id'] !== jobId) return undefined
  if (typeof task['title'] !== 'string' || typeof task['source_url'] !== 'string' || !isRecord(task['params'])) return undefined
  return { task: task as FetchTaskRecord }
}

export function readTranscodeExecution(
  execution: JobExecutionRecord,
): TranscodeExecutionPayload | undefined {
  if (execution.executor !== TRANSCODE_EXECUTOR || !isRecord(execution.payload)) return undefined
  const workerJob = execution.payload['workerJob']
  const inputSource = execution.payload['inputSource']
  const outputVirtualPath = execution.payload['outputVirtualPath']
  if (!isRecord(workerJob) || typeof inputSource !== 'string' || typeof outputVirtualPath !== 'string') return undefined
  if (typeof workerJob['inputPath'] !== 'string' || typeof workerJob['outputPath'] !== 'string' || typeof workerJob['preset'] !== 'string') return undefined
  return { workerJob: workerJob as TranscodeWorkerJob, inputSource, outputVirtualPath }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
