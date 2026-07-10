import type { FastifyInstance } from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type { JobRecord, OkResult, TranscodeProbeResponse, TranscodeSourceInfo } from '@mediatoolbox/contracts'
import type { TranscodePreset, VideoEncodePreset } from '@mediatoolbox/ffmpeg'
import { probeMedia, analyzeSource } from '@mediatoolbox/ffmpeg'

import { transcodeJobCreateSchema, transcodeProbeSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { executeTranscode, abortTranscode, updateTranscodeJob } from '../transcode-executor.js'
import { normalizeWorkspacePath, WorkspacePathError, resolveGrantPath } from '../workspace-path.js'

export function registerTranscodeRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: { inputPath?: string; outputPath?: string; preset?: string; title?: string; inputGrantId?: string; outputGrantId?: string; videoCrf?: number; videoEncodePreset?: string; audioBitrate?: number }; Reply: JobRecord }>(
    '/api/transcode/jobs',
    { schema: transcodeJobCreateSchema },
    async (request) => {
      const { inputPath, outputPath, preset, title, inputGrantId, outputGrantId, videoCrf, videoEncodePreset, audioBitrate } = request.body

      let effectiveInputPath: string
      if (inputGrantId) {
        effectiveInputPath = await resolveGrantPath(inputGrantId, state.db, 'file.read')
      } else {
        effectiveInputPath = normalizeWorkspacePath(inputPath, state.workspaceRoot)
      }

      let effectiveOutputPath: string
      if (outputGrantId) {
        // grant 模式：resolveGrantPath 返回物理路径
        effectiveOutputPath = await resolveGrantPath(outputGrantId, state.db, 'file.write')
      } else {
        const normalizedOutputPath = normalizeWorkspacePath(outputPath, state.workspaceRoot)
        const exportsRoot = `${state.workspaceRoot}/Exports`
        if (normalizedOutputPath === exportsRoot || !normalizedOutputPath.startsWith(`${exportsRoot}/`)) {
          throw new WorkspacePathError('转码输出必须位于工作区 Exports 目录内。')
        }
        effectiveOutputPath = normalizedOutputPath
      }

      const VALID_PRESETS: TranscodePreset[] = ['mp4-h264-aac', 'mp4-h265-aac', 'mkv-h265-aac', 'audio-aac', 'audio-mp3', 'copy', 'remux']
      const safePreset: TranscodePreset = VALID_PRESETS.includes(preset as TranscodePreset) ? (preset as TranscodePreset) : 'mp4-h264-aac'
      const jobId = `transcode-${Date.now()}`
      const job = createJobRecord({
        id: jobId,
        kind: 'media.transcode',
        title: title || `转码任务：${effectiveInputPath.split('/').pop() ?? 'unknown'}`,
      })
      await state.db.jobs.create(job)

      void executeTranscode(
        job,
        {
          inputPath: effectiveInputPath,
          outputPath: effectiveOutputPath,
          preset: safePreset,
          ...(videoCrf !== undefined ? { videoCrf } : {}),
          ...(videoEncodePreset ? { videoEncodePreset: videoEncodePreset as VideoEncodePreset } : {}),
          ...(audioBitrate !== undefined ? { audioBitrate } : {}),
        },
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

  app.post<{ Body: { inputPath?: string; inputGrantId?: string }; Reply: TranscodeProbeResponse }>(
    '/api/transcode/probe',
    { schema: transcodeProbeSchema },
    async (request) => {
      const { inputPath, inputGrantId } = request.body

      let effectiveInputPath: string
      try {
        if (inputGrantId) {
          effectiveInputPath = await resolveGrantPath(inputGrantId, state.db, 'file.read')
        } else {
          effectiveInputPath = normalizeWorkspacePath(inputPath, state.workspaceRoot)
        }
      } catch {
        return { ok: false }
      }

      try {
        const probeResult = await probeMedia(effectiveInputPath)
        const analysis = analyzeSource(probeResult)

        const videoStream = probeResult.streams.find((s) => s.codec_type === 'video')
        const source: TranscodeSourceInfo = {
          ...(analysis.sourceVideoCodec !== undefined ? { videoCodec: analysis.sourceVideoCodec } : {}),
          ...(analysis.sourceAudioCodec !== undefined ? { audioCodec: analysis.sourceAudioCodec } : {}),
          ...(videoStream?.width !== undefined ? { width: videoStream.width } : {}),
          ...(videoStream?.height !== undefined ? { height: videoStream.height } : {}),
          ...(videoStream?.r_frame_rate !== undefined ? { fps: videoStream.r_frame_rate } : {}),
          ...(analysis.sourceBitrateKbps !== undefined ? { bitrateKbps: analysis.sourceBitrateKbps } : {}),
          ...(probeResult.format.duration !== undefined ? { durationSeconds: Number(probeResult.format.duration) } : {}),
          isAlreadyHevc: analysis.isAlreadyHevc,
          suggestRemux: analysis.suggestRemux,
          recommendedPreset: analysis.recommendedPreset,
          recommendedCrf: analysis.recommendedCrf,
          recommendedEncodePreset: analysis.recommendedEncodePreset,
          recommendedAudioBitrate: analysis.recommendedAudioBitrate,
          notes: analysis.notes,
        }
        return { ok: true, source }
      } catch {
        return { ok: false }
      }
    },
  )
}
