import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { createJobRecord } from '@mediatoolbox/job-core'
import type { JobRecord, OkResult, TranscodeProbeResponse, TranscodeSourceInfo, TranscodeCommandPreviewResponse } from '@mediatoolbox/contracts'
import type { TranscodePreset, VideoEncodePreset } from '@mediatoolbox/ffmpeg'
import { probeMedia, analyzeSource, buildFfmpegArgs, buildTwoPassFfmpegArgs } from '@mediatoolbox/ffmpeg'

import { transcodeJobCreateSchema, transcodeProbeSchema, transcodePreviewCommandSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { executeTranscode, abortTranscode, updateTranscodeJob } from '../transcode-executor.js'
import { resolveInputPath, resolveOutputPath } from '../workspace-path.js'

export function registerTranscodeRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: { inputPath?: string; outputPath?: string; preset?: string; title?: string; inputGrantId?: string; outputGrantId?: string; videoCrf?: number; videoEncodePreset?: string; audioBitrate?: number; targetBitrateKbps?: number; enableVmaf?: boolean }; Reply: JobRecord }>(
    '/api/transcode/jobs',
    { schema: transcodeJobCreateSchema },
    async (request) => {
      const { inputPath, outputPath, preset, title, inputGrantId, outputGrantId, videoCrf, videoEncodePreset, audioBitrate, targetBitrateKbps, enableVmaf } = request.body

      const jobId = `transcode-${Date.now()}`
      const input = await resolveInputPath(state, { path: inputPath, grantId: inputGrantId, bindJobId: jobId })
      const output = await resolveOutputPath(state, {
        path: outputPath,
        grantId: outputGrantId,
        requireExportsDir: true,
        exportsErrorMessage: '转码输出必须位于工作区 Exports 目录内。',
        consumeGrant: true,
      })

      const VALID_PRESETS: TranscodePreset[] = ['mp4-h264-aac', 'mp4-h265-aac', 'mkv-h265-aac', 'audio-aac', 'audio-mp3', 'copy', 'remux']
      const safePreset: TranscodePreset = VALID_PRESETS.includes(preset as TranscodePreset) ? (preset as TranscodePreset) : 'mp4-h264-aac'
      const job = createJobRecord({
        id: jobId,
        kind: 'media.transcode',
        title: title || `转码任务：${path.basename(input.physicalPath)}`,
      })
      await state.db.jobs.create(job)

      void executeTranscode(
        job,
        {
          inputPath: input.physicalPath,
          outputPath: output.physicalPath,
          preset: safePreset,
          ...(videoCrf !== undefined ? { videoCrf } : {}),
          ...(videoEncodePreset ? { videoEncodePreset: videoEncodePreset as VideoEncodePreset } : {}),
          ...(audioBitrate !== undefined ? { audioBitrate } : {}),
          ...(targetBitrateKbps !== undefined ? { targetBitrateKbps } : {}),
          ...(enableVmaf !== undefined ? { enableVmaf } : {}),
        },
        state,
        output.virtualPath ?? `__grant:${outputGrantId}`,
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
        effectiveInputPath = (await resolveInputPath(state, { path: inputPath, grantId: inputGrantId })).physicalPath
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

  app.post<{
    Body: {
      inputPath?: string
      outputPath?: string
      preset?: string
      videoCrf?: number
      videoEncodePreset?: string
      audioBitrate?: number
      targetBitrateKbps?: number
    }
    Reply: TranscodeCommandPreviewResponse
  }>(
    '/api/transcode/preview-command',
    { schema: transcodePreviewCommandSchema },
    async (request) => {
      const { inputPath, outputPath, preset, videoCrf, videoEncodePreset, audioBitrate, targetBitrateKbps } = request.body

      const VALID_PRESETS: TranscodePreset[] = ['mp4-h264-aac', 'mp4-h265-aac', 'mkv-h265-aac', 'audio-aac', 'audio-mp3', 'copy', 'remux']
      const safePreset: TranscodePreset = VALID_PRESETS.includes(preset as TranscodePreset) ? (preset as TranscodePreset) : 'mp4-h265-aac'

      const previewRequest = {
        inputPath: inputPath?.trim() || 'input.mov',
        outputPath: outputPath?.trim() || 'output.mp4',
        preset: safePreset,
        ...(videoCrf !== undefined ? { videoCrf } : {}),
        ...(videoEncodePreset ? { videoEncodePreset: videoEncodePreset as VideoEncodePreset } : {}),
        ...(audioBitrate !== undefined ? { audioBitrate } : {}),
        ...(targetBitrateKbps !== undefined ? { targetBitrateKbps } : {}),
      }

      const twoPassEligible = targetBitrateKbps !== undefined
        && (safePreset === 'mp4-h264-aac' || safePreset === 'mp4-h265-aac' || safePreset === 'mkv-h265-aac')

      const args = twoPassEligible
        ? buildTwoPassFfmpegArgs(previewRequest, 2, `${previewRequest.outputPath}.ffmpeg2pass`)
        : buildFfmpegArgs(previewRequest)

      return { ok: true, args: ['ffmpeg', ...args] }
    },
  )
}
