import Fastify from 'fastify'

import { registerBrowserNetworkRoutes } from './routes/browser-network.js'
import { registerCoreRoutes } from './routes/core.js'
import { registerAssetRoutes } from './routes/assets.js'
import { registerFetchRoutes } from './routes/fetch.js'
import { registerFilebrowserRoutes } from './routes/filebrowser.js'
import { registerJobRoutes } from './routes/jobs.js'
import { registerLogRoutes, hydrateNotificationState } from './routes/logs.js'
import { registerPsdRoutes } from './routes/psd.js'
import { registerSystemRoutes } from './routes/system.js'
import { registerTranscodeRoutes } from './routes/transcode.js'
import { createApiState } from './state.js'

type ApiErrorLike = {
  message?: string
  statusCode?: number
  validation?: unknown
}

function asApiErrorLike(error: unknown): ApiErrorLike {
  if (error && typeof error === 'object') return error as ApiErrorLike
  return { message: String(error || '') }
}

function statusCodeFromError(error: ApiErrorLike) {
  if (typeof error.statusCode === 'number' && error.statusCode >= 400) return error.statusCode
  if (error.validation) return 400
  return 500
}

function messageFromError(error: ApiErrorLike, statusCode: number) {
  if (error.validation) return '请求参数不符合 API 契约。'
  if (statusCode >= 500) return '本地 API 处理失败。'
  return error.message || '请求失败。'
}

export async function buildApiServer() {
  const app = Fastify({ logger: true })
  const state = createApiState()
  await hydrateNotificationState(state)

  app.setErrorHandler((error, _request, reply) => {
    const apiError = asApiErrorLike(error)
    const statusCode = statusCodeFromError(apiError)
    reply.status(statusCode).send({
      ok: false,
      message: messageFromError(apiError, statusCode),
    })
  })

  registerCoreRoutes(app)
  registerAssetRoutes(app, state)
  registerBrowserNetworkRoutes(app, state)
  registerFetchRoutes(app, state)
  registerFilebrowserRoutes(app, state)
  registerSystemRoutes(app, state)
  registerLogRoutes(app, state)
  registerJobRoutes(app, state)
  registerTranscodeRoutes(app, state)
  registerPsdRoutes(app, state)

  return app
}
