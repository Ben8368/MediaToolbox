import type { Rectangle } from 'electron'

export function normalizeBrowserUrl(raw: string): string | null {
  let input = raw.trim()
  if (!input) return null
  if (input === 'about:blank') return input

  const scheme = input.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https') return null
  if (!scheme) {
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(input)
    input = `${isLocal ? 'http' : 'https'}://${input}`
  }

  try {
    const url = new URL(input)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function isNavigationAbortError(error: unknown) {
  if (!error) return false
  const maybeError = error as { code?: unknown; errno?: unknown; message?: unknown }
  return maybeError.code === -3
    || maybeError.errno === -3
    || (typeof maybeError.message === 'string' && maybeError.message.includes('ERR_ABORTED'))
}

export function getStringField(payload: unknown, field: string): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : undefined
}

export function getBooleanField(payload: unknown, field: string): boolean | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>)[field]
  return typeof value === 'boolean' ? value : undefined
}

export function getSessionScopeField(payload: unknown): 'default' | 'isolated' | undefined {
  const value = getStringField(payload, 'sessionScope')
  return value === 'default' || value === 'isolated' ? value : undefined
}

export function getRequestMethodField(payload: unknown): 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | undefined {
  const value = getStringField(payload, 'method')?.toUpperCase()
  return value === 'GET' || value === 'POST' || value === 'PUT' || value === 'PATCH' || value === 'DELETE' || value === 'HEAD' || value === 'OPTIONS'
    ? value
    : undefined
}

export function getStringMapField(payload: unknown, field: string): Record<string, string> | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>)[field]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string') result[key] = item
  }
  return result
}

export function getBoundsField(payload: unknown): Rectangle | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const value = (payload as Record<string, unknown>).bounds
  if (!value || typeof value !== 'object') return undefined
  const bounds = value as Record<string, unknown>
  const x = getFiniteNumber(bounds.x)
  const y = getFiniteNumber(bounds.y)
  const width = getFiniteNumber(bounds.width)
  const height = getFiniteNumber(bounds.height)
  if (x === undefined || y === undefined || width === undefined || height === undefined) return undefined
  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  }
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
