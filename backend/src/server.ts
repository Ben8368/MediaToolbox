/**
 * server.ts — Fastify 入口
 * 启动顺序：initDownloader → 注册路由 → listen
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { initDownloader } from './services/downloader/index.js'
import { tasksRoutes } from './routes/tasks.js'
import { systemRoutes } from './routes/system.js'

const PORT = Number(process.env.PORT ?? 8080)
// 默认绑定到 loopback，避免后端 API 在未经 nginx 的情况下暴露给局域网；
// Docker 同容器部署（nginx → 127.0.0.1:8080）无需修改；
// 跨容器网络部署时通过 HOST=0.0.0.0 覆盖。
const HOST = process.env.HOST ?? '127.0.0.1'

async function main(): Promise<void> {
  const app = Fastify({ logger: { level: 'info' } })

  // CORS：
  //   生产 / Docker → 前端与后端同源（nginx 反代），后端 CORS 不必开，但允许覆盖
  //   开发 → CORS_ORIGIN 默认只放行 localhost:5173，绝不用 true（全开放）
  const corsOrigin = process.env.CORS_ORIGIN
    ?? (process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173')
  await app.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  // 内容类型解析
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    try {
      done(null, JSON.parse(body as string))
    } catch (err) {
      done(err as Error, undefined)
    }
  })

  // 注册下载 worker
  initDownloader()

  // 注册路由
  await app.register(tasksRoutes)
  await app.register(systemRoutes)

  // 健康检查
  app.get('/api/health', async () => ({ ok: true, ts: Date.now() }))

  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`MediaToolbox backend listening on http://${HOST}:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

void main()
