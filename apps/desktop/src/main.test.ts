import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  createDesktopShellConfig,
  createLocalApiLaunchCommand,
  isAllowedExternalUrl,
  isPackagedSmokeMode,
  resolveAppIconPath,
  toPublicDesktopShellConfig,
  type DesktopRuntimePaths,
} from './main.js'

const runtimePaths: DesktopRuntimePaths = {
  rootDir: path.resolve('/repo/MediaToolbox'),
  resourcesPath: path.resolve('/Applications/MediaToolbox.app/Contents/Resources'),
  electronExecutable: path.resolve('/Applications/MediaToolbox.app/Contents/MacOS/MediaToolbox'),
  appPath: path.resolve('/Applications/MediaToolbox.app/Contents/Resources/app.asar'),
  userDataPath: path.resolve('/Users/ben/Library/Application Support/MediaToolbox'),
}

describe('desktop local API launch command', () => {
  it('starts the development API through tsx from the api workspace', () => {
    const config = createDesktopShellConfig({ HOST: '127.0.0.1', API_PORT: '4701', MEDIATOOLBOX_DESKTOP_START_API: 'true' })
    const launch = createLocalApiLaunchCommand(config, {}, runtimePaths)

    expect(launch.command).toBe('node')
    expect(launch.args).toEqual([path.join(runtimePaths.rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'])
    expect(launch.cwd).toBe(path.join(runtimePaths.rootDir, 'apps', 'api'))
    expect(launch.env.HOST).toBe('127.0.0.1')
    expect(launch.env.PORT).toBe('4701')
    expect(launch.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN).toBe(config.desktopAuthToken)
  })

  it('starts the packaged API bundle through Electron run-as-node', () => {
    const config = { ...createDesktopShellConfig({}), mode: 'production' as const }
    const launch = createLocalApiLaunchCommand(config, {}, runtimePaths)

    expect(launch.command).toBe(runtimePaths.electronExecutable)
    expect(launch.args).toEqual([path.join(runtimePaths.resourcesPath, 'api', 'server.cjs')])
    expect(launch.cwd).toBe(path.join(runtimePaths.resourcesPath, 'api'))
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe('1')
    expect(launch.env.NODE_ENV).toBe('production')
    expect(launch.env.MEDIATOOLBOX_WORKSPACE_DIR).toBe(path.join(runtimePaths.userDataPath!, 'workspace'))
    expect(launch.env.MEDIATOOLBOX_DB_PATH).toBe(path.join(runtimePaths.userDataPath!, 'mediatoolbox.db'))
    expect(launch.env.MEDIATOOLBOX_RENDERER_DIR).toBe(path.join(runtimePaths.resourcesPath, 'renderer'))
    expect(launch.env.NODE_PATH).toBe(path.join(runtimePaths.appPath!, 'node_modules'))
    expect(launch.env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN).toBe(config.desktopAuthToken)
  })

  it('uses the local API origin for the packaged renderer', () => {
    expect(createDesktopShellConfig({ NODE_ENV: 'production', API_PORT: '4701' }).webUrl).toBe('http://127.0.0.1:4701')
  })

  it('uses an explicit node binary without Electron run-as-node', () => {
    const config = { ...createDesktopShellConfig({}), mode: 'production' as const }
    const launch = createLocalApiLaunchCommand(config, { MEDIATOOLBOX_NODE_BIN: '/opt/node/bin/node' }, runtimePaths)

    expect(launch.command).toBe('/opt/node/bin/node')
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it('resolves app icons from renderer resources in development and packaged modes', () => {
    expect(resolveAppIconPath(false, runtimePaths.resourcesPath, runtimePaths.rootDir)).toBe(
      path.join(runtimePaths.rootDir, 'apps', 'web', 'public', 'static', 'app', 'icons', 'default', 'setting.png'),
    )
    expect(resolveAppIconPath(true, runtimePaths.resourcesPath, runtimePaths.rootDir)).toBe(
      path.join(runtimePaths.resourcesPath, 'renderer', 'static', 'app', 'icons', 'default', 'setting.png'),
    )
  })

  it('keeps desktop auth token out of the renderer-facing config', () => {
    const config = createDesktopShellConfig({ MEDIATOOLBOX_DESKTOP_AUTH_TOKEN: 'secret' })

    expect(config.desktopAuthToken).toBe('secret')
    expect(toPublicDesktopShellConfig(config)).not.toHaveProperty('desktopAuthToken')
  })

  it('only allows http and https URLs to open externally', () => {
    expect(isAllowedExternalUrl('https://example.com')).toBe(true)
    expect(isAllowedExternalUrl('http://127.0.0.1:5173')).toBe(true)
    expect(isAllowedExternalUrl('file:///C:/secret.txt')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('only enables the packaged smoke flow through its explicit CI flag', () => {
    expect(isPackagedSmokeMode({})).toBe(false)
    expect(isPackagedSmokeMode({ MEDIATOOLBOX_PACKAGED_SMOKE: '0' })).toBe(false)
    expect(isPackagedSmokeMode({ MEDIATOOLBOX_PACKAGED_SMOKE: '1' })).toBe(true)
  })
})
