import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest, apiUrl, ApiRequestError } from '@/api/http'

beforeEach(() => {
  vi.stubGlobal('window', {
    setTimeout,
    clearTimeout,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('apiUrl', () => {
  it('uses same-origin /api paths when no base URL is configured', () => {
    expect(apiUrl('/api/fetch/tasks')).toBe('/api/fetch/tasks')
  })

  it('trims the configured API base URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8080/')

    expect(apiUrl('/api/fetch/tasks')).toBe('http://127.0.0.1:8080/api/fetch/tasks')
  })
})

describe('apiRequest', () => {
  it('sends JSON requests and parses JSON responses', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiRequest<{ ok: boolean }>('/api/example', {
      method: 'POST',
      body: JSON.stringify({ name: 'demo' }),
    })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/example', expect.objectContaining({ method: 'POST' }))
    const [, init] = fetchMock.mock.calls[0]
    if (!init) throw new Error('fetch init was not captured')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('leaves FormData content type unset so fetch can add the multipart boundary', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    }))
    vi.stubGlobal('fetch', fetchMock)
    const form = new FormData()
    form.append('directory', '/Workspace')
    form.append('file', new Blob(['logo-bytes'], { type: 'image/png' }), 'logo.png')

    await apiRequest('/api/filebrowser/upload', {
      method: 'POST',
      body: form,
    })

    const [, init] = fetchMock.mock.calls[0]
    if (!init) throw new Error('fetch init was not captured')
    expect(new Headers(init.headers).has('Content-Type')).toBe(false)
    expect(init.body).toBe(form)
  })

  it('returns undefined for empty successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })))

    await expect(apiRequest('/api/empty')).resolves.toBeUndefined()
  })

  it('preserves text error messages from the backend', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('后端不可用', { status: 503 })))

    await expect(apiRequest('/api/fail')).rejects.toMatchObject({
      message: '后端不可用',
      status: 503,
    })
  })

  it('reports malformed success payloads as API request errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))

    await expect(apiRequest('/api/bad-json')).rejects.toBeInstanceOf(ApiRequestError)
    await expect(apiRequest('/api/bad-json')).rejects.toMatchObject({
      message: '服务返回了无法解析的数据',
      status: 200,
    })
  })

  it('forwards caller cancellation to fetch', async () => {
    const requestSignals: AbortSignal[] = []
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (_input, init) => {
      const requestSignal = init?.signal
      if (requestSignal) requestSignals.push(requestSignal)
      return await new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    }))
    const controller = new AbortController()

    const request = apiRequest('/api/cancellable', { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toMatchObject({ message: '请求已取消' })
    expect(requestSignals[0]?.aborted).toBe(true)
  })
})
