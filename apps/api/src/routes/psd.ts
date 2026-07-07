import fs from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import type { OkResult } from '@mediatoolbox/contracts'
import { PsdWorkerEngineNotConfiguredError, PsdWorkerInputError, runPsdWorkerJob, validateRenderInput } from '@mediatoolbox/psd-worker'
import type { PsdRenderInput, PsdTemplateManifest } from '@mediatoolbox/psd-core'

import { psdInspectSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog } from '../utils.js'
import { toPhysicalWorkspacePath, toVirtualWorkspacePath } from '../workspace-files.js'
import { normalizeWorkspacePath } from '../workspace-path.js'

type PsdInspectResponse = OkResult & {
  manifest?: PsdTemplateManifest
}

export function registerPsdRoutes(app: FastifyInstance, state: ApiState) {
  app.post<{ Body: { psdPath?: string }; Reply: PsdInspectResponse }>(
    '/api/psd/templates/inspect',
    { schema: psdInspectSchema },
    async (request, reply) => {
      const virtualPath = normalizeWorkspacePath(request.body.psdPath, state.workspaceRoot)
      const physicalPath = toPhysicalWorkspacePath(state, virtualPath)
      try {
        const result = await runPsdWorkerJob({ type: 'inspect', psdPath: physicalPath })
        if (result.type !== 'inspect') return { ok: false, message: 'PSD worker 返回了非检查结果。' }
        addLog(state.db, 'INFO', 'psd', `PSD 模板检查完成：${virtualPath}`)
        return { ok: true, manifest: { ...result.manifest, sourcePath: virtualPath } }
      } catch (error) {
        if (error instanceof PsdWorkerInputError) {
          reply.status(400)
          return { ok: false, message: error.message }
        }
        if (error instanceof PsdWorkerEngineNotConfiguredError) {
          reply.status(503)
          return { ok: false, message: 'Photoshop 命令未配置，暂不能检查 PSD 模板。' }
        }
        const message = error instanceof Error ? error.message : String(error)
        reply.status(400)
        return { ok: false, message }
      }
    },
  )

  app.post<{
    Body: { template?: PsdTemplateManifest; input?: PsdRenderInput }
    Reply: OkResult & { outputPath?: string }
  }>('/api/psd/render', async (request, reply) => {
    const { template, input } = request.body

    if (!template) {
      reply.status(400)
      return { ok: false, message: 'Missing template in request body' }
    }
    if (!input) {
      reply.status(400)
      return { ok: false, message: 'Missing input in request body' }
    }

    let payload: ResolvedRenderPayload
    try {
      payload = resolveRenderPayload(state, template, input)
    } catch (error) {
      reply.status(400)
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }

    try {
      const result = await runPsdWorkerJob({ type: 'render', template: payload.template, input: payload.input })
      if (result.type !== 'render') {
        return { ok: false, message: 'PSD worker 返回了非渲染结果。' }
      }

      // 输出路径由服务端在工作区内生成，回写虚拟路径供前端展示。
      const virtualOutput = safeVirtualWorkspacePath(state, result.outputPath) ?? payload.virtualOutput

      addLog(state.db, 'INFO', 'psd', `PSD 模板渲染完成：${template.name}`)
      return { ok: true, outputPath: virtualOutput }
    } catch (error) {
      if (error instanceof PsdWorkerEngineNotConfiguredError) {
        reply.status(503)
        return { ok: false, message: 'Photoshop 命令未配置，暂不能渲染 PSD 模板。' }
      }
      const message = error instanceof Error ? error.message : String(error)
      reply.status(400)
      return { ok: false, message }
    }
  })

  app.post<{ Body: { manifest?: PsdTemplateManifest }; Reply: OkResult }>(
    '/api/psd/manifests/save',
    async (request, reply) => {
      const { manifest } = request.body
      if (!manifest?.sourcePath) {
        reply.status(400)
        return { ok: false, message: 'Missing manifest.sourcePath in request body' }
      }
      const virtualPath = normalizeWorkspacePath(manifest.sourcePath, state.workspaceRoot)
      const physicalPsdPath = toPhysicalWorkspacePath(state, virtualPath)
      const sidecarPath = `${physicalPsdPath}.manifest.json`
      try {
        const persisted: PsdTemplateManifest = { ...manifest, sourcePath: virtualPath }
        await fs.writeFile(sidecarPath, JSON.stringify(persisted, null, 2), 'utf-8')
        addLog(state.db, 'INFO', 'psd', `PSD manifest 已保存：${virtualPath}`)
        return { ok: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        reply.status(400)
        return { ok: false, message }
      }
    },
  )

  app.get<{ Querystring: { psdPath?: string }; Reply: PsdInspectResponse }>(
    '/api/psd/manifests/load',
    async (request, reply) => {
      const virtualPath = normalizeWorkspacePath(request.query.psdPath, state.workspaceRoot)
      const physicalPsdPath = toPhysicalWorkspacePath(state, virtualPath)
      const sidecarPath = `${physicalPsdPath}.manifest.json`
      try {
        const raw = await fs.readFile(sidecarPath, 'utf-8')
        const manifest = JSON.parse(raw) as PsdTemplateManifest
        return { ok: true, manifest: { ...manifest, sourcePath: virtualPath } }
      } catch (error) {
        if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          reply.status(404)
          return { ok: false, message: '未找到已保存的 manifest。' }
        }
        const message = error instanceof Error ? error.message : String(error)
        reply.status(400)
        return { ok: false, message }
      }
    },
  )
}

export type ResolvedRenderPayload = {
  template: PsdTemplateManifest
  input: PsdRenderInput
  virtualOutput: string
}

// 收口渲染入参：源路径必须落在工作区内，输出路径完全由服务端生成，
// 客户端传入的 `__` 保留键（如 __outputPath / __psdPath）一律剥离，杜绝工作区逃逸。
export function resolveRenderPayload(
  state: ApiState,
  template: PsdTemplateManifest,
  input: PsdRenderInput,
): ResolvedRenderPayload {
  if (!template.sourcePath) {
    throw new Error('Missing template.sourcePath in request body')
  }
  const virtualSource = normalizeWorkspacePath(template.sourcePath, state.workspaceRoot)
  const physicalSource = toPhysicalWorkspacePath(state, virtualSource)

  const safeInput: PsdRenderInput = {}
  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith('__')) continue
    safeInput[key] = value
  }
  validateRenderInput(template, safeInput)

  const virtualOutput = `${state.workspaceRoot}/Exports/${safeFileStem(template.id)}-${Date.now()}.png`
  const physicalOutput = toPhysicalWorkspacePath(state, virtualOutput)
  safeInput.__outputPath = physicalOutput

  return {
    template: { ...template, sourcePath: physicalSource },
    input: safeInput,
    virtualOutput,
  }
}

function safeFileStem(id: string): string {
  const stem = id.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return stem || 'render'
}

function safeVirtualWorkspacePath(state: ApiState, physicalPath: string): string | null {
  try {
    return toVirtualWorkspacePath(state, physicalPath)
  } catch {
    return null
  }
}
