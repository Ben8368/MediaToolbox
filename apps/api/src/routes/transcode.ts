import type { FastifyInstance } from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type { JobRecord, OkResult } from '@mediatoolbox/contracts'
import type { TranscodePreset } from '@mediatoolbox/ffmpeg'

import type { ApiState } from '../state.js'
import { executeTranscode, abortTranscode } from '../transcode-executor.js'

export function registerTranscodeRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: { inputPath?: string; outputPath?: string; preset?: string; title?: string }; Reply: JobRecord }>(
    '/api/transcode/jobs',
    async (request) => {
      const { inputPath, outputPath, preset, title } = request.body
      if (!inputPath || !outputPath) {
        throw new Error('inputPath 和 outputPath 为必填项。')
      }
      const safePreset: TranscodePreset = preset === 'audio-mp3' || preset === 'copy' ? preset : 'mp4-h264-aac'
      const jobId = `transcode-${Date.now()}`
      const job = createJobRecord({
        id: jobId,
        kind: 'media.transcode',
        title: title || `转码任务：${inputPath.split(/[\\/]/).pop() ?? 'unknown'}`,
      })
      state.jobs.unshift(job)

      // 异步执行转码，不阻塞 HTTP 响应
      void executeTranscode(
        job,
        { inputPath, outputPath, preset: safePreset },
        state,
      )

      return job
    },
  )

  app.post<{ Params: { id: string }; Reply: OkResult }>(
    '/api/transcode/jobs/:id/cancel',
    async (request) => {
      const job = state.jobs.find((j) => j.id === request.params.id)
      if (job && job.kind === 'media.transcode' && job.status === 'running') {
        abortTranscode(job.id)
      }
      return { ok: true }
    },
  )
}
