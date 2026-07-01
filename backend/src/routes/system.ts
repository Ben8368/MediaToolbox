/**
 * routes/system — /api/system/* 基础端点（指标与关机）
 */
import type { FastifyInstance } from 'fastify'

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  // 轻量系统快照（前端右侧状态面板需要）
  app.get('/api/system/metrics', async (_req, reply) => {
    return reply.send({
      ok: true,
      runtime: { uptime: process.uptime(), version: process.version },
      system: {},
      network: {},
    })
  })

  app.get('/api/system/runtime', async (_req, reply) => {
    return reply.send({ ok: true, runtime: {}, system: {}, network: {} })
  })

  app.post('/api/system/shutdown', async (_req, reply) => {
    // 本地工具不实现真实关机
    return reply.send({ ok: false, message: '关机功能未启用' })
  })
}
