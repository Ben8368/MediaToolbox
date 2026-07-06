import fs from 'node:fs/promises'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { OkResult } from '@mediatoolbox/contracts'
import { PsdWorkerEngineNotConfiguredError, runPsdWorkerJob } from '@mediatoolbox/psd-worker'
import type { PsdRenderInput, PsdTemplateManifest } from '@mediatoolbox/psd-core'

import { psdInspectSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog } from '../utils.js'
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
      const physicalPath = toPhysicalPath(state, virtualPath)
      try {
        const result = await runPsdWorkerJob({ type: 'inspect', psdPath: physicalPath })
        if (result.type !== 'inspect') return { ok: false, message: 'PSD worker 返回了非检查结果。' }
        addLog(state.db, 'INFO', 'psd', `PSD 模板检查完成：${virtualPath}`)
        return { ok: true, manifest: { ...result.manifest, sourcePath: virtualPath } }
      } catch (error) {
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

    // Convert virtual sourcePath to physical
    if (template.sourcePath) {
      template.sourcePath = toPhysicalPath(state, template.sourcePath)
    }

    try {
      const result = await runPsdWorkerJob({ type: 'render', template, input })
      if (result.type !== 'render') {
        return { ok: false, message: 'PSD worker 返回了非渲染结果。' }
      }

      // Convert physical outputPath back to virtual workspace path
      const virtualOutput = result.outputPath.startsWith(state.physicalWorkspaceRoot)
        ? state.workspaceRoot + result.outputPath.slice(state.physicalWorkspaceRoot.length).replace(/\\/g, '/')
        : result.outputPath

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
      const physicalPsdPath = toPhysicalPath(state, manifest.sourcePath)
      const sidecarPath = `${physicalPsdPath}.manifest.json`
      try {
        await fs.writeFile(sidecarPath, JSON.stringify(manifest, null, 2), 'utf-8')
        addLog(state.db, 'INFO', 'psd', `PSD manifest 已保存：${manifest.sourcePath}`)
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
      const physicalPsdPath = toPhysicalPath(state, virtualPath)
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

function toPhysicalPath(state: ApiState, virtualPath: string): string {
  const relative = virtualPath === state.workspaceRoot ? '' : virtualPath.slice(state.workspaceRoot.length + 1)
  const resolved = path.resolve(state.physicalWorkspaceRoot, ...relative.split('/').filter(Boolean))
  const root = path.resolve(state.physicalWorkspaceRoot)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Physical PSD path escaped workspace root.')
  }
  return resolved
}
