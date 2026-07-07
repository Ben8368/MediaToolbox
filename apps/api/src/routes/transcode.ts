import type { FastifyInstance } from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type { JobRecord, OkResult } from '@mediatoolbox/contracts'
import type { TranscodePreset } from '@mediatoolbox/ffmpeg'

import { transcodeJobCreateSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { executeTranscode, abortTranscode, updateTranscodeJob } from '../transcode-executor.js'
import { resolveGrantPath, normalizeWorkspacePath, WorkspacePathError } from '../workspace-path.js'

export function registerTranscodeRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: { inputPath?: string; outputPath?: string; preset?: string; title?: string; inputGrantId?: string }; Reply: JobRecord }>(
    '/api/transcode/jobs',
    { schema: transcodeJobCreateSchema },
    async (request) => {
      const { inputPath, outputPath, preset, title, inputGrantId } = request.body

      let effectiveInputPath: string
      if (inputGrantId) {
        // grant 模式：resolveGrantPath 返回物理路径，直接传给 worker
        effectiveInputPath = await resolveGrantPath(inputGrantId, state.db, 'file.read')
      } else {
        effectiveInputPath = normalizeWorkspacePath(inputPath, state.workspaceRoot)
      }

      const normalizedOutputPath = normalizeWorkspacePath(outputPath, state.workspaceRoot)
      const exportsRoot = `${state.workspaceRoot}/Exports`
      if (normalizedOutputPath === exportsRoot || !normalizedOutputPath.startsWith(`${exportsRoot}/`)) {
        throw new WorkspacePathError('转码输出必须位于工作区 Exports 目录内。')
      }
      const safePreset: TranscodePreset = preset === 'audio-mp3' || preset === 'copy' ? preset : 'mp4-h264-aac'
      const jobId = `transcode-${Date.now()}`
      const job = createJobRecord({
        id: jobId,
        kind: 'media.transcode',
        title: title || `转码任务：${effectiveInputPath.split('/').pop() ?? 'unknown'}`,
      })
      await state.db.jobs.create(job)

      // 异步执行转码，不阻塞 HTTP 响应
      void executeTranscode(
        job,
        { inputPath: effectiveInputPath, outputPath: normalizedOutputPath, preset: safePreset },
        state,
      )

      return job
    },
  )

  app.post<{ Params: { id: string }; Reply: OkResult }>(
    '/api/transcode/jobs/:id/cancel',
    async (request) => {
      const job = await state.db.jobs.findById(request.params.id)
      if (job && job.kind === 'media.transcode' && (job.status === 'queued' || job.status === 'running')) {
        abortTranscode(job.id)
        await updateTranscodeJob(state, job.id, 'canceled')
      }
      return { ok: true }
    },
  )
}
