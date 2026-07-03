import { getErrorMessage } from '@/utils'

const DEFAULT_TIMEOUT_MS = 15_000

export class ApiRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL?.trim()
  return base ? base.replace(/\/$/, '') : ''
}

function buildUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${normalized}`
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `请求失败 (${response.status})`
  try {
    const contentType = response.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      const data = await response.json() as { message?: string; error?: string }
      return data.message || data.error || fallback
    }
    const text = await response.text()
    return text.trim() || fallback
  } catch {
    return fallback
  }
}

type ApiRequestInit = RequestInit & { timeoutMs?: number }

async function readSuccessPayload<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text.trim()) return undefined as T

  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiRequestError('服务返回了无法解析的数据', response.status)
  }
}

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers = new Headers(fetchInit.headers)
    if (fetchInit.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(buildUrl(path), {
      ...fetchInit,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new ApiRequestError(await readErrorMessage(response), response.status)
    }

    return await readSuccessPayload<T>(response)
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError('请求超时，请稍后重试')
    }
    if (err instanceof ApiRequestError) throw err
    throw new ApiRequestError(getErrorMessage(err) || '网络请求失败')
  } finally {
    window.clearTimeout(timer)
  }
}

export function apiUrl(path: string): string {
  return buildUrl(path)
}
