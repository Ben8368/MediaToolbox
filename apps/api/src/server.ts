import { buildApiServer } from './app.js'

const port = Number(process.env.PORT ?? 3701)
const host = normalizeLoopbackHost(process.env.HOST)

async function main() {
  const app = await buildApiServer()

  try {
    await app.listen({ host, port })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void main()

function normalizeLoopbackHost(host: string | undefined): string {
  const candidate = host?.trim() || '127.0.0.1'
  return isLoopbackHost(candidate) ? candidate : '127.0.0.1'
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}
