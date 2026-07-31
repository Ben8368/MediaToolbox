import type { FastifyInstance } from 'fastify'
import type { WorkOrder, WorkOrderGetResponse, OkResult, FontsListResponse, JobRecord } from '@mediatoolbox/contracts'
import { createJobId, createJobRecord } from '@mediatoolbox/job-core'
import { runPsdWorkerJob, PsdWorkerEngineNotConfiguredError } from '@mediatoolbox/psd-worker'

import { psdScanSchema, psdWorkOrderUpdateSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog } from '../utils.js'
import { resolveInputPath, resolveOutputPath, resolvePathOrGrantMarker, revokeGrantsBoundToJob } from '../workspace-path.js'
import { executePsdScan, executePsdApply } from '../psd-executor.js'

export function registerPsdRoutes(app: FastifyInstance, state: ApiState) {
  // POST /api/psd/scan — 扫描 PSD/PSB，创建工单（异步 Job）
  app.post<{ Body: { psdPath?: string; inputGrantId?: string }; Reply: { ok: true; job: JobRecord; workOrderId: string } | { ok: false; message: string } }>(
    '/api/psd/scan',
    { schema: psdScanSchema },
    async (request, reply) => {
      const { psdPath, inputGrantId } = request.body
      // 扫描 Job 与工单共享 ID，使重启恢复和授权生命周期能指向同一持久化实体。
      const workOrderId = createJobId('psd-scan')
      let physicalPath: string
      try {
        physicalPath = (await resolveInputPath(state, { path: psdPath, grantId: inputGrantId, bindJobId: workOrderId })).physicalPath
      } catch (error) {
        reply.status(400)
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }

      const job = createJobRecord({
        id: workOrderId,
        kind: 'psd.scan',
        title: `PSD 扫描：${physicalPath.split(/[\\/]/).pop() ?? 'unknown.psd'}`,
      })
      try {
        await state.db.jobs.create(job)
      } catch (error) {
        await revokeGrantsBoundToJob(state, workOrderId)
        throw error
      }

      void state.executors.run(job.id, async (signal) => {
        try {
          await executePsdScan(
            job,
            psdPath ?? physicalPath,
            physicalPath,
            workOrderId,
            inputGrantId,
            state,
            signal,
          )
        } catch (error) {
          addLog(state.db, 'ERROR', 'psd', `PSD 扫描执行器清理失败：${error instanceof Error ? error.message : String(error)}`)
        }
      })
        .catch((error) => addLog(state.db, 'ERROR', 'psd', `PSD 扫描执行器登记失败：${error instanceof Error ? error.message : String(error)}`))

      return { ok: true, job, workOrderId }
    },
  )

  // GET /api/psd/workorders/:id — 获取工单
  app.get<{ Params: { id: string }; Reply: WorkOrderGetResponse }>(
    '/api/psd/workorders/:id',
    async (request, reply) => {
      const workOrder = await state.db.workOrders.findById(request.params.id)
      if (!workOrder) {
        reply.status(404)
        return { ok: false, message: '工单不存在' }
      }
      return { ok: true, workOrder }
    },
  )

  // PUT /api/psd/workorders/:id — 更新工单（编辑 records）
  app.put<{ Params: { id: string }; Body: { workOrder?: WorkOrder }; Reply: OkResult }>(
    '/api/psd/workorders/:id',
    { schema: psdWorkOrderUpdateSchema },
    async (request, reply) => {
      const { workOrder } = request.body
      if (!workOrder) {
        reply.status(400)
        return { ok: false, message: 'Missing workOrder in request body' }
      }
      if (workOrder.id !== request.params.id) {
        reply.status(400)
        return { ok: false, message: 'Work order ID mismatch' }
      }

      const existing = await state.db.workOrders.findById(request.params.id)
      if (!existing) {
        reply.status(404)
        return { ok: false, message: '工单不存在' }
      }

      workOrder.updatedAt = Date.now()
      await state.db.workOrders.update(workOrder)
      addLog(state.db, 'INFO', 'psd', `工单已更新：${workOrder.id}`)
      return { ok: true }
    },
  )

  // POST /api/psd/workorders/:id/apply — 应用工单（异步 Job）
  app.post<{
    Params: { id: string }
    Body: { outputPath?: string; outputGrantId?: string }
    Reply: { ok: true; job: JobRecord } | { ok: false; message: string }
  }>('/api/psd/workorders/:id/apply', async (request, reply) => {
    const workOrder = await state.db.workOrders.findById(request.params.id)
    if (!workOrder) {
      reply.status(404)
      return { ok: false, message: '工单不存在' }
    }

    let physicalPsdPath: string
    try {
      physicalPsdPath = await resolvePathOrGrantMarker(state, workOrder.psdPath, 'file.read')
    } catch (error) {
      reply.status(400)
      return { ok: false, message: `Invalid PSD path: ${error instanceof Error ? error.message : String(error)}` }
    }

    const workOrderForApply: WorkOrder = { ...workOrder, psdPath: physicalPsdPath }
    const { outputPath, outputGrantId } = request.body

    const job = createJobRecord({
      id: createJobId('psd-apply'),
      kind: 'psd.apply',
      title: `PSD 应用：${workOrder.psdFileName}`,
    })
    await state.db.jobs.create(job)

    let physicalOutputPath: string
    try {
      const fileName = workOrder.psdFileName.replace(/\.[^.]+$/, '') + `_adapted_${Date.now()}.psd`
      const defaultOutputPath = `${state.workspaceRoot}/Exports/${fileName}`
      const output = await resolveOutputPath(state, {
        path: outputPath || defaultOutputPath,
        grantId: outputGrantId,
        consumeGrant: true,
        bindJobId: job.id,
      })
      physicalOutputPath = output.physicalPath
    } catch (error) {
      await state.db.jobs.delete(job.id)
      reply.status(400)
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }

    void state.executors.run(job.id, async (signal) => {
      try {
        await executePsdApply(job, workOrderForApply, physicalPsdPath, physicalOutputPath, state, signal)
      } catch (error) {
        addLog(state.db, 'ERROR', 'psd', `PSD 应用执行器清理失败：${error instanceof Error ? error.message : String(error)}`)
      } finally {
        await revokeGrantsBoundToJob(state, workOrder.id)
      }
    })
      .catch((error) => addLog(state.db, 'ERROR', 'psd', `PSD 应用执行器登记失败：${error instanceof Error ? error.message : String(error)}`))

    return { ok: true, job }
  })

  // POST /api/psd/workorders/:id/translate — AI 翻译（占位，v1 返回 501）
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/psd/workorders/:id/translate',
    async (_request, reply) => {
      reply.status(501)
      return { ok: false, message: 'AI 翻译功能尚未开放，敬请期待。' }
    },
  )

  // GET /api/psd/workorders — 列出所有工单
  app.get('/api/psd/workorders', async () => {
    const workOrders = await state.db.workOrders.list()
    return { ok: true, workOrders }
  })

  // GET /api/psd/fonts — 列出 Photoshop 可用字体
  app.get<{ Reply: FontsListResponse }>('/api/psd/fonts', async (_request, reply) => {
    try {
      const result = await runPsdWorkerJob({ type: 'list-fonts' })
      if (result.type !== 'list-fonts') {
        return { ok: false, message: 'Worker returned non-fonts result' }
      }
      return { ok: true, fonts: result.fonts }
    } catch (error) {
      if (error instanceof PsdWorkerEngineNotConfiguredError) {
        reply.status(503)
        return { ok: false, message: 'Photoshop 命令未配置，暂不能获取字体列表。' }
      }
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })
}
