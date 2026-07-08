import { timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

export const DESKTOP_AUTH_TOKEN_ENV = 'MEDIATOOLBOX_DESKTOP_AUTH_TOKEN'
export const DESKTOP_AUTH_TOKEN_HEADER = 'x-mediatoolbox-desktop-token'

export function requireDesktopAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  markerHeader: string,
): boolean {
  if (request.headers[markerHeader.toLowerCase()] !== 'desktop') {
    reply.status(403)
    return false
  }

  const expectedToken = process.env[DESKTOP_AUTH_TOKEN_ENV]?.trim()
  const providedToken = headerValue(request.headers[DESKTOP_AUTH_TOKEN_HEADER])
  if (!expectedToken || !providedToken || !constantTimeEquals(providedToken, expectedToken)) {
    reply.status(403)
    return false
  }

  return true
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function constantTimeEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}
