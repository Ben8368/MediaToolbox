import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDevProcessSpecs, normalizeProcessEnv } from './index.js'

describe('process manager specs', () => {
  it('builds API and web development process specs', () => {
    const rootDir = path.resolve('C:/MediaToolbox')
    const specs = createDevProcessSpecs({
      rootDir,
      apiPort: 4701,
      webPort: 5174,
      supervisorShutdownUrl: 'http://127.0.0.1:4900/shutdown?token=abc',
    })

    expect(specs).toHaveLength(2)
    expect(specs[0]).toMatchObject({
      name: 'api',
      cwd: path.join(rootDir, 'apps', 'api'),
      env: expect.objectContaining({
        PORT: '4701',
        MEDIATOOLBOX_SUPERVISOR_SHUTDOWN_URL: 'http://127.0.0.1:4900/shutdown?token=abc',
      }),
    })
    expect(specs[1]).toMatchObject({
      name: 'web',
      cwd: path.join(rootDir, 'apps', 'web'),
      env: expect.objectContaining({ PORT: '4701' }),
    })
    expect(specs[1]?.args).toEqual(expect.arrayContaining(['--port', '5174', '--strictPort']))
  })

  it('keeps only one process environment entry per case-insensitive key', () => {
    const env = normalizeProcessEnv({ Path: 'A', PATH: 'B', HOME: 'C' })

    expect(env.Path).toBe('A')
    expect(env.PATH).toBeUndefined()
    expect(env.HOME).toBe('C')
  })
})
