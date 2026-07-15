import fs from 'node:fs'
import path from 'node:path'

import type { FastifyInstance } from 'fastify'

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

/**
 * 仅在 Electron 打包态启用：renderer 与本地 API 共用 loopback origin，
 * 避免 file:// 下 BrowserRouter、/api 与绝对静态资源路径彼此脱节。
 */
export function registerRendererRoutes(app: FastifyInstance, rendererRoot: string | undefined): void {
  if (!rendererRoot) return

  const root = path.resolve(rendererRoot)
  const indexPath = path.join(root, 'index.html')
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Electron renderer bundle is missing: ${indexPath}`)
  }

  app.get<{ Params: { '*': string } }>('/*', async (request, reply) => {
    const requestedPath = request.params['*'] ?? ''
    const filePath = resolveRendererPath(root, requestedPath)

    if (requestedPath === 'api' || requestedPath.startsWith('api/')) {
      reply.status(404)
      return { ok: false, message: 'API 端点不存在。' }
    }

    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return reply
        .type(MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream')
        .header('cache-control', requestedPath.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
        .send(fs.createReadStream(filePath))
    }

    if (path.extname(requestedPath)) {
      reply.status(404)
      return { ok: false, message: 'Renderer 静态资源不存在。' }
    }

    return reply.type(MIME_TYPES['.html'] ?? 'text/html; charset=utf-8').header('cache-control', 'no-cache').send(fs.createReadStream(indexPath))
  })
}

function resolveRendererPath(root: string, requestedPath: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(requestedPath)
  } catch {
    return undefined
  }
  const relative = decoded.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!relative || relative.split('/').some((segment) => segment === '.' || segment === '..')) return undefined

  const resolved = path.resolve(root, relative)
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : undefined
}
