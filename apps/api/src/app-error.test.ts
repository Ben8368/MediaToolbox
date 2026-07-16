import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'

import { buildApiServer } from './app.js'

const servers: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
})

describe('API error responses', () => {
  it('maps an incomplete request body to a user-readable message', async () => {
    const server = await buildApiServer()
    servers.push(server)

    const response = await server.inject({
      method: 'POST',
      url: '/api/filebrowser/upload',
      headers: {
        'content-length': '20',
        'content-type': 'application/json',
      },
      payload: '{}',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      ok: false,
      message: '请求数据传输不完整，请重试。',
    })
  })
})
