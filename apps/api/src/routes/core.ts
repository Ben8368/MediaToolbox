import type { FastifyInstance } from 'fastify'
import type { AppsResponse, HealthResponse } from '@mediatoolbox/contracts'

export function registerCoreRoutes(app: FastifyInstance) {
  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    ok: true,
    service: 'mediatoolbox-api',
    version: '0.1.0',
  }))

  app.get<{ Reply: AppsResponse }>('/api/apps', async () => ({
    apps: [
      { id: 'file-manager', title: '文件管理', kind: 'core' },
      { id: 'download', title: '下载', kind: 'workbench' },
      { id: 'transcode', title: '转码', kind: 'workbench' },
      { id: 'ps', title: 'PS', kind: 'workbench' },
      { id: 'settings', title: '设置', kind: 'system' },
      { id: 'logs', title: '日志', kind: 'system' },
    ],
  }))
}
