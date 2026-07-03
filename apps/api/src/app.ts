import Fastify from 'fastify'
import type { HealthResponse } from '@mediatoolbox/contracts'

export function buildApiServer() {
  const app = Fastify({
    logger: true,
  })

  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    ok: true,
    service: 'mediatoolbox-api',
    version: '0.1.0',
  }))

  app.get('/api/apps', async () => ({
    apps: [
      { id: 'file-manager', title: '文件管理', kind: 'core' },
      { id: 'download', title: '下载', kind: 'workbench' },
      { id: 'ps', title: 'PS', kind: 'workbench' },
      { id: 'transcode', title: '转码', kind: 'workbench' },
    ],
  }))

  return app
}
