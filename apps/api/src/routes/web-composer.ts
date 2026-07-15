import type { FastifyInstance } from 'fastify'
import { createJobId, createJobRecord } from '@mediatoolbox/job-core'
import {
  getWebComposerPresetReference,
  type JobRecord,
  type WebComposerPresetId,
} from '@mediatoolbox/contracts'

import type { ApiState } from '../state.js'
import { toPhysicalWorkspacePath } from '../workspace-files.js'
import { executeWebComposerCapture } from '../web-composer-executor.js'

const PNG_LIMIT = 50 * 1024 * 1024
const WEBM_LIMIT = 200 * 1024 * 1024

type ExportQuery = {
  presetId?: string
  presetVersion?: string
  width?: string
  height?: string
  fps?: string
  durationSeconds?: string
}

function badRequest(message: string): never {
  const error = new Error(message)
  ;(error as Error & { statusCode?: number }).statusCode = 400
  throw error
}

function parseInteger(value: string | undefined, name: string, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    badRequest(`${name} 必须是 ${min} 到 ${max} 之间的整数。`)
  }
  return parsed
}

function parseMetadata(query: ExportQuery, video: boolean) {
  const presetVersion = parseInteger(query.presetVersion, 'presetVersion', 1, Number.MAX_SAFE_INTEGER)
  const presetReference = getWebComposerPresetReference(query.presetId, presetVersion)
  if (!presetReference) badRequest('未知或不受支持的网页合成预设版本。')
  const width = parseInteger(query.width, 'width', 320, 3840)
  const height = parseInteger(query.height, 'height', 320, 3840)
  if (width * height > 8_294_400) badRequest('输出画布不能超过 4K 像素总量。')
  return {
    ...presetReference,
    width,
    height,
    ...(video ? {
      fps: parseInteger(query.fps, 'fps', 1, 30),
      durationSeconds: parseInteger(query.durationSeconds, 'durationSeconds', 1, 15),
    } : {}),
  }
}

function isPng(buffer: Buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
}

function isWebm(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3
}

function outputName(presetId: WebComposerPresetId, extension: 'png' | 'mp4') {
  return `web-composer-${presetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
}

export function registerWebComposerRoutes(app: FastifyInstance, state: ApiState) {
  if (!app.hasContentTypeParser('application/octet-stream')) {
    app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_request, body, done) => done(null, body))
  }

  app.post<{ Querystring: ExportQuery; Body: Buffer; Reply: JobRecord }>(
    '/api/web-composer/exports/png',
    { bodyLimit: PNG_LIMIT },
    async (request) => {
      const metadata = parseMetadata(request.query, false)
      if (!Buffer.isBuffer(request.body) || !isPng(request.body)) badRequest('PNG 捕获数据格式不正确。')
      const filename = outputName(metadata.presetId, 'png')
      const virtualOutputPath = `${state.workspaceRoot}/Exports/${filename}`
      const job = createJobRecord({
        id: createJobId('web-image'),
        kind: 'web.render.image',
        title: `网页合成 PNG：${metadata.presetId}`,
      })
      await state.db.jobs.create(job)
      void executeWebComposerCapture(job, {
        kind: 'png',
        capture: request.body,
        virtualOutputPath,
        physicalOutputPath: toPhysicalWorkspacePath(state, virtualOutputPath),
      }, state)
      return job
    },
  )

  app.post<{ Querystring: ExportQuery; Body: Buffer; Reply: JobRecord }>(
    '/api/web-composer/exports/video',
    { bodyLimit: WEBM_LIMIT },
    async (request) => {
      const metadata = parseMetadata(request.query, true)
      if (!Buffer.isBuffer(request.body) || !isWebm(request.body)) badRequest('WebM 捕获数据格式不正确。')
      if (metadata.fps === undefined || metadata.durationSeconds === undefined) badRequest('视频导出参数不完整。')
      const filename = outputName(metadata.presetId, 'mp4')
      const virtualOutputPath = `${state.workspaceRoot}/Exports/${filename}`
      const physicalOutputPath = toPhysicalWorkspacePath(state, virtualOutputPath)
      const job = createJobRecord({
        id: createJobId('web-video'),
        kind: 'web.render.video',
        title: `网页合成 MP4：${metadata.presetId}`,
      })
      await state.db.jobs.create(job)
      void executeWebComposerCapture(job, {
        kind: 'webm',
        capture: request.body,
        virtualOutputPath,
        physicalOutputPath,
        physicalInputPath: `${physicalOutputPath}.capture.webm`,
        fps: metadata.fps,
        durationSeconds: metadata.durationSeconds,
      }, state)
      return job
    },
  )
}
