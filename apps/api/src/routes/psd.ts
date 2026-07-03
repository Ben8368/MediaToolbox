import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import type { OkResult } from '@mediatoolbox/contracts'
import { PsdWorkerEngineNotConfiguredError, runPsdWorkerJob } from '@mediatoolbox/psd-worker'
import type { PsdTemplateManifest } from '@mediatoolbox/psd-core'

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
