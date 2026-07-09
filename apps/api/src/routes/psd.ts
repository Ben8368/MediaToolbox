import type { FastifyInstance } from 'fastify'
import type { WorkOrder, WorkOrderScanResponse, WorkOrderGetResponse, WorkOrderApplyResponse, OkResult, FontsListResponse } from '@mediatoolbox/contracts'
import { runPsdWorkerJob, PsdWorkerEngineNotConfiguredError, PsdWorkerInputError } from '@mediatoolbox/psd-worker'

import { psdScanSchema, psdWorkOrderUpdateSchema } from '../schemas.js'
import type { ApiState } from '../state.js'
import { addLog } from '../utils.js'
import { normalizeWorkspacePath, resolveGrantPath } from '../workspace-path.js'
import { toPhysicalWorkspacePath } from '../workspace-files.js'

export function registerPsdRoutes(app: FastifyInstance, state: ApiState) {
  // POST /api/psd/scan — 扫描 PSD/PSB，创建工单
  app.post<{ Body: { psdPath?: string; inputGrantId?: string }; Reply: WorkOrderScanResponse }>(
    '/api/psd/scan',
    { schema: psdScanSchema },
    async (request, reply) => {
      const { psdPath, inputGrantId } = request.body
      let physicalPath: string
      try {
        if (inputGrantId) {
          physicalPath = await resolveGrantPath(inputGrantId, state.db, 'file.read')
        } else {
          const virtualPath = normalizeWorkspacePath(psdPath, state.workspaceRoot)
          physicalPath = toPhysicalWorkspacePath(state, virtualPath)
        }
      } catch (error) {
        reply.status(400)
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }

      try {
        const result = await runPsdWorkerJob({ type: 'scan', psdPath: physicalPath })
        if (result.type !== 'scan') {
          return { ok: false, message: 'Worker returned non-scan result' }
        }

        const workOrderId = `wo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const workOrder: WorkOrder = {
          id: workOrderId,
          psdPath: psdPath ?? physicalPath,
          psdFileName: physicalPath.split(/[\\/]/).pop() ?? 'unknown.psd',
          documentWidth: result.documentWidth,
          documentHeight: result.documentHeight,
          documentResolution: result.documentResolution,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          records: result.records,
        }

        await state.db.workOrders.create(workOrder)
        addLog(state.db, 'INFO', 'psd', `PSD 扫描完成：${workOrder.psdFileName}，${result.records.length} 个文字图层`)

        return { ok: true, workOrderId, recordCount: result.records.length }
      } catch (error) {
        if (error instanceof PsdWorkerEngineNotConfiguredError) {
          reply.status(503)
          return { ok: false, message: 'Photoshop 命令未配置，暂不能扫描 PSD。' }
        }
        if (error instanceof PsdWorkerInputError) {
          reply.status(400)
        }
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
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

  // POST /api/psd/workorders/:id/apply — 应用工单（运行自适应算法）
  app.post<{
    Params: { id: string }
    Body: { outputPath?: string; outputGrantId?: string }
    Reply: WorkOrderApplyResponse
  }>('/api/psd/workorders/:id/apply', async (request, reply) => {
    const workOrder = await state.db.workOrders.findById(request.params.id)
    if (!workOrder) {
      reply.status(404)
      return { ok: false, message: '工单不存在' }
    }

    const { outputPath, outputGrantId } = request.body
    let physicalOutputPath: string
    let virtualOutputPath: string

    try {
      if (outputGrantId) {
        physicalOutputPath = await resolveGrantPath(outputGrantId, state.db, 'file.write')
        virtualOutputPath = `__grant:${outputGrantId}`
      } else {
        const fileName = workOrder.psdFileName.replace(/\.[^.]+$/, '') + `_adapted_${Date.now()}.psd`
        virtualOutputPath = outputPath || `${state.workspaceRoot}/Exports/${fileName}`
        physicalOutputPath = toPhysicalWorkspacePath(state, virtualOutputPath)
      }
    } catch (error) {
      reply.status(400)
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }

    // 解析源 PSD 路径（虚拟 → 物理）
    let physicalPsdPath: string
    try {
      const virtualPsdPath = normalizeWorkspacePath(workOrder.psdPath, state.workspaceRoot)
      physicalPsdPath = toPhysicalWorkspacePath(state, virtualPsdPath)
    } catch (error) {
      reply.status(400)
      return { ok: false, message: `Invalid PSD path: ${error instanceof Error ? error.message : String(error)}` }
    }

    // 同步更新 workOrder 的 psdPath 为物理路径（worker 需要）
    const workOrderForApply: WorkOrder = { ...workOrder, psdPath: physicalPsdPath }

    try {
      const result = await runPsdWorkerJob({
        type: 'apply',
        workOrder: workOrderForApply,
        outputPsdPath: physicalOutputPath,
      })
      if (result.type !== 'apply') {
        return { ok: false, message: 'Worker returned non-apply result' }
      }

      addLog(state.db, 'INFO', 'psd', `工单应用完成：${workOrder.id}，应用 ${result.appliedCount} 个图层`)
      return {
        ok: true,
        outputPath: virtualOutputPath,
        appliedCount: result.appliedCount,
        skippedCount: result.skippedCount,
      }
    } catch (error) {
      if (error instanceof PsdWorkerEngineNotConfiguredError) {
        reply.status(503)
        return { ok: false, message: 'Photoshop 命令未配置，暂不能应用工单。' }
      }
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  // POST /api/psd/workorders/:id/translate — AI 翻译（占位，v1 返回 501）
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/psd/workorders/:id/translate',
    async (request, reply) => {
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
  app.get<{ Reply: FontsListResponse }>('/api/psd/fonts', async (request, reply) => {
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
