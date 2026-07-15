import type { BrowserNetworkHttpMethod } from '@mediatoolbox/contracts'

import {
  emitBrowserNetworkEvent,
  createBrowserNetworkId,
  patchBrowserNetworkJson,
  postBrowserNetworkJson,
  type BrowserNetworkOptions,
  type BrowserNetworkRequestEvent,
} from './browserNetworkShared.js'

type BrowserSession = import('electron').Session

export type BrowserNetworkRequestDraft = {
  url: string
  method?: BrowserNetworkHttpMethod
  headers?: Record<string, string>
  body?: string
}

export type BrowserNetworkRequestResult = {
  id: string
  url: string
  method: BrowserNetworkHttpMethod
  status: number
  headers: Record<string, string>
  body: string
  truncated: boolean
}

export async function requestBrowserNetworkUrl(
  options: BrowserNetworkOptions,
  session: BrowserSession,
  sessionId: string,
  draft: BrowserNetworkRequestDraft,
): Promise<BrowserNetworkRequestResult> {
  const url = normalizeRequestUrl(draft.url)
  const method = normalizeRequestMethod(draft.method)
  const headers = sanitizeRequestHeaders(draft.headers ?? {})
  const id = createBrowserNetworkId('browser-request')
  const started = {
    id,
    url,
    method,
    view_id: options.viewId,
    session_id: sessionId,
    request_headers: headers,
    request_bytes: method !== 'GET' && method !== 'HEAD' && draft.body !== undefined
      ? Buffer.byteLength(draft.body, 'utf8')
      : 0,
  }

  emitRequestEvent(options, { id, viewId: options.viewId, sessionId, url, method, status: 'running', responseBytes: 0 })
  void postBrowserNetworkJson(options.apiUrl, '/api/browser-network/requests', started, options.desktopAuthToken)

  try {
    const requestInit: RequestInit = {
      method,
      headers,
    }
    if (method !== 'GET' && method !== 'HEAD' && draft.body !== undefined) {
      requestInit.body = draft.body
    }
    const response = await session.fetch(url, requestInit)
    const bodyBuffer = Buffer.from(await response.arrayBuffer())
    const limit = 1024 * 1024
    const body = bodyBuffer.subarray(0, limit).toString('utf8')
    const responseHeaders = sanitizeResponseHeaders(response.headers)
    const update = {
      status: 'succeeded',
      response_status: response.status,
      response_headers: responseHeaders,
      response_bytes: bodyBuffer.byteLength,
    }
    emitRequestEvent(options, {
      id,
      viewId: options.viewId,
      sessionId,
      url,
      method,
      status: 'succeeded',
      responseStatus: response.status,
      responseBytes: bodyBuffer.byteLength,
    })
    void patchBrowserNetworkJson(options.apiUrl, `/api/browser-network/requests/${encodeURIComponent(id)}`, update, options.desktopAuthToken)
    return {
      id,
      url,
      method,
      status: response.status,
      headers: responseHeaders,
      body,
      truncated: bodyBuffer.byteLength > limit,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Browser Network request failed.'
    emitRequestEvent(options, {
      id,
      viewId: options.viewId,
      sessionId,
      url,
      method,
      status: 'failed',
      responseBytes: 0,
      error: message,
    })
    void patchBrowserNetworkJson(options.apiUrl, `/api/browser-network/requests/${encodeURIComponent(id)}`, {
      status: 'failed',
      response_bytes: 0,
      error: message,
    }, options.desktopAuthToken)
    throw error
  }
}

function emitRequestEvent(options: BrowserNetworkOptions, request: BrowserNetworkRequestEvent): void {
  emitBrowserNetworkEvent(options.hostWindow, { type: 'request', request })
}

function normalizeRequestUrl(raw: string): string {
  const url = new URL(raw.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Browser Network requests only support http and https URLs.')
  }
  return url.href
}

function normalizeRequestMethod(method: BrowserNetworkHttpMethod | undefined): BrowserNetworkHttpMethod {
  const normalized = (method ?? 'GET').toUpperCase()
  if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(normalized)) {
    return normalized as BrowserNetworkHttpMethod
  }
  throw new Error('Unsupported Browser Network request method.')
}

function sanitizeRequestHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  const blocked = new Set(['cookie', 'host', 'origin', 'referer', 'user-agent'])
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase()
    if (blocked.has(normalized) || normalized.startsWith('sec-') || normalized.startsWith('proxy-')) continue
    if (typeof value === 'string') result[name] = value
  }
  return result
}

function sanitizeResponseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, name) => {
    if (name.toLowerCase() === 'set-cookie') return
    result[name] = value
  })
  return result
}
