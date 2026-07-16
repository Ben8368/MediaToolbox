import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { requireDesktopAuth } from '../desktop-auth.js'
import type { ApiState } from '../state.js'
import { addLog } from '../utils.js'

const TTL_MS: Record<string, number> = {
  'file.read': 3_600_000,
  'file.write': 1_800_000,
  'dir.read': 7_200_000,
}

const VALID_KINDS = new Set(['file.read', 'file.write', 'dir.read'])

function isAbsolutePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\\\')
}

export function registerPathGrantRoutes(app: FastifyInstance, state: ApiState): void {
  // POST /api/path-grants — 签发 grant（仅桌面端）
  app.post<{
    Body: {
      kind: string
      physicalPath: string
      displayName: string
      ttlMs?: number
      jobId?: string
    }
  }>('/api/path-grants', async (request, reply) => {
    if (!requireDesktopAuth(request, reply, 'x-mediatoolbox-desktop')) {
      return { ok: false, message: '仅桌面端可签发路径授权。' }
    }

    const { kind, physicalPath, displayName, ttlMs, jobId } = request.body ?? {}

    if (!kind || !VALID_KINDS.has(kind)) {
      reply.status(400)
      return { ok: false, message: `无效的授权类型：${kind}。` }
    }
    if (!physicalPath || !isAbsolutePath(physicalPath)) {
      reply.status(400)
      return { ok: false, message: '路径授权的 physicalPath 必须是绝对路径。' }
    }
    if (!displayName || typeof displayName !== 'string') {
      reply.status(400)
      return { ok: false, message: 'displayName 不能为空。' }
    }
    if (ttlMs !== undefined && (!Number.isFinite(ttlMs) || ttlMs <= 0)) {
      reply.status(400)
      return { ok: false, message: 'ttlMs 必须是正数。' }
    }

    const effectiveTtl = Math.min(ttlMs ?? TTL_MS[kind] ?? 3_600_000, 7_200_000)
    const now = Date.now()
    const grant = {
      id: randomUUID(),
      kind: kind as 'file.read' | 'file.write' | 'dir.read',
      status: 'active' as const,
      physicalPath,
      displayName,
      expiresAt: now + effectiveTtl,
      createdAt: now,
      updatedAt: now,
      ...(jobId ? { jobId } : {}),
    }

    await state.db.pathGrants.create(grant)
    addLog(state.db, 'INFO', 'path-grants', `签发 ${kind} grant：${displayName}`)

    const { physicalPath: _omit, ...grantInfo } = grant
    return { ok: true, grant: grantInfo }
  })

  // GET /api/path-grants/:id — 查询 grant
  app.get<{ Params: { id: string } }>('/api/path-grants/:id', async (request, reply) => {
    const { id } = request.params
    const grant = await state.db.pathGrants.findActiveById(id)
    if (!grant) {
      reply.status(404)
      return { ok: false, message: '路径授权不存在或已过期。' }
    }
    const { physicalPath: _omit, ...grantInfo } = grant
    return { ok: true, grant: grantInfo }
  })

  // DELETE /api/path-grants/:id — 吊销 grant
  app.delete<{ Params: { id: string } }>('/api/path-grants/:id', async (request, reply) => {
    const { id } = request.params
    const grant = await state.db.pathGrants.findById(id)
    if (!grant) {
      reply.status(404)
      return { ok: false, message: '路径授权不存在。' }
    }
    await state.db.pathGrants.update({ id, status: 'revoked', updatedAt: Date.now() })
    addLog(state.db, 'INFO', 'path-grants', `吊销 grant：${grant.displayName}`)
    return { ok: true }
  })
}
