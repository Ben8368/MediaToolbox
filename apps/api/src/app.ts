import Fastify from 'fastify'

import { registerBrowserNetworkRoutes } from './routes/browser-network.js'
import { registerCoreRoutes } from './routes/core.js'
import { registerAssetRoutes } from './routes/assets.js'
import { registerFetchRoutes } from './routes/fetch.js'
import { registerFilebrowserRoutes } from './routes/filebrowser.js'
import { registerJobRoutes } from './routes/jobs.js'
import { registerLogRoutes, hydrateNotificationState } from './routes/logs.js'
import { registerPsdRoutes } from './routes/psd.js'
import { registerPathGrantRoutes } from './routes/path-grants.js'
import { registerSystemRoutes } from './routes/system.js'
import { registerTranscodeRoutes } from './routes/transcode.js'
import { registerFontsRoutes } from './routes/fonts.js'
import { registerWebComposerRoutes } from './routes/web-composer.js'
import { registerRendererRoutes } from './renderer-routes.js'
import { recoverInterruptedJobs } from './job-recovery.js'
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

export type ApiServerOptions = {
  rendererRoot?: string
}

export async function buildApiServer(options: ApiServerOptions = {}) {
  const app = Fastify({
    logger: true,
    // 不剥离未知字段：调用方必须收到可读 4xx，不能把可见设置静默吞掉。
    ajv: { customOptions: { removeAdditional: false } },
  })
  const state = createApiState()
  await recoverInterruptedJobs(state)
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
  registerFontsRoutes(app)
  registerPsdRoutes(app, state)
  registerPathGrantRoutes(app, state)
  registerWebComposerRoutes(app, state)
  registerRendererRoutes(app, options.rendererRoot ?? process.env['MEDIATOOLBOX_RENDERER_DIR'])

  return app
}
