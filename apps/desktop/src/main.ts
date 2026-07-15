import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { registerBrowserViewIpcHandlers } from './browserViews.js'

type ElectronModule = typeof import('electron')
type DesktopRuntimeMode = 'development' | 'production'

export type DesktopShellConfig = {
  mode: DesktopRuntimeMode
  webUrl: string
  apiUrl: string
  host: string
  apiPort: number
  autoStartApi: boolean
  desktopAuthToken: string
}

export type PublicDesktopShellConfig = Omit<DesktopShellConfig, 'desktopAuthToken'>

export type DesktopApiProcess = {
  child: ChildProcess
  url: string
}

export type DesktopRuntimePaths = {
  rootDir: string
  resourcesPath: string
  electronExecutable: string
  appPath?: string
  userDataPath?: string
}

export type DesktopApiLaunchCommand = {
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
let trayRef: import('electron').Tray | null = null
const DEFAULT_APP_ICON = path.join('static', 'app', 'icons', 'default', 'setting.png')

export function createDesktopShellConfig(env: NodeJS.ProcessEnv): DesktopShellConfig {
  const mode = env.NODE_ENV === 'production' ? 'production' : 'development'
  const host = normalizeLoopbackHost(env.HOST)
  const apiPort = Number(env.PORT ?? env.API_PORT ?? 3701)
  const apiUrl = env.MEDIATOOLBOX_API_URL ?? `http://${host}:${apiPort}`

  return {
    mode,
    host,
    apiPort,
    apiUrl,
    webUrl: env.MEDIATOOLBOX_WEB_URL ?? (mode === 'production' ? apiUrl : 'http://127.0.0.1:5173'),
    autoStartApi: env.MEDIATOOLBOX_DESKTOP_START_API === 'true' || (mode === 'production' && env.MEDIATOOLBOX_DESKTOP_START_API !== 'false'),
    desktopAuthToken: env.MEDIATOOLBOX_DESKTOP_AUTH_TOKEN?.trim() || createDesktopAuthToken(),
  }
}

export function isElectronRuntime() {
  return Boolean(process.versions.electron)
}

/** 仅供已打包应用的 CI 烟测使用；常规用户启动绝不进入该路径。 */
export function isPackagedSmokeMode(env: NodeJS.ProcessEnv): boolean {
  return env.MEDIATOOLBOX_PACKAGED_SMOKE === '1'
}

export function toPublicDesktopShellConfig(config: DesktopShellConfig): PublicDesktopShellConfig {
  const { desktopAuthToken: _desktopAuthToken, ...publicConfig } = config
  return publicConfig
}

function createDesktopAuthToken(): string {
  return randomBytes(32).toString('base64url')
}

function normalizeLoopbackHost(host: string | undefined): string {
  const candidate = host?.trim() || '127.0.0.1'
  return isLoopbackHost(candidate) ? candidate : '127.0.0.1'
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
}

export function createDesktopRuntimePaths(electron?: ElectronModule): DesktopRuntimePaths {
  return {
    rootDir,
    resourcesPath: process.resourcesPath ?? rootDir,
    electronExecutable: process.execPath,
    ...(electron ? { appPath: electron.app.getAppPath(), userDataPath: electron.app.getPath('userData') } : {}),
  }
}

export function createLocalApiLaunchCommand(
  config: DesktopShellConfig,
  env: NodeJS.ProcessEnv = process.env,
  paths: DesktopRuntimePaths = createDesktopRuntimePaths(),
): DesktopApiLaunchCommand {
  const explicitNodeBin = env.MEDIATOOLBOX_NODE_BIN?.trim()
  const baseEnv: NodeJS.ProcessEnv = {
    ...env,
    HOST: config.host,
    PORT: String(config.apiPort),
    MEDIATOOLBOX_DESKTOP_AUTH_TOKEN: config.desktopAuthToken,
  }

  if (config.mode === 'production') {
    const apiDir = path.join(paths.resourcesPath, 'api')
    const command = explicitNodeBin || paths.electronExecutable
    const userDataPath = paths.userDataPath ?? path.join(paths.resourcesPath, 'user-data')
    const nodePath = [
      paths.appPath ? path.join(paths.appPath, 'node_modules') : undefined,
      env.NODE_PATH,
    ].filter(Boolean).join(path.delimiter)
    const runtimeEnv: NodeJS.ProcessEnv = {
      ...baseEnv,
      NODE_ENV: 'production',
      MEDIATOOLBOX_WORKSPACE_DIR: env.MEDIATOOLBOX_WORKSPACE_DIR ?? path.join(userDataPath, 'workspace'),
      MEDIATOOLBOX_DB_PATH: env.MEDIATOOLBOX_DB_PATH ?? path.join(userDataPath, 'mediatoolbox.db'),
      MEDIATOOLBOX_RENDERER_DIR: path.join(paths.resourcesPath, 'renderer'),
      ...(nodePath ? { NODE_PATH: nodePath } : {}),
    }
    if (!explicitNodeBin) runtimeEnv.ELECTRON_RUN_AS_NODE = '1'
    return {
      command,
      args: [path.join(apiDir, 'server.cjs')],
      cwd: apiDir,
      env: runtimeEnv,
    }
  }

  return {
    command: explicitNodeBin || 'node',
    args: [path.join(paths.rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'],
    cwd: path.join(paths.rootDir, 'apps', 'api'),
    env: baseEnv,
  }
}

export function resolveRendererResourcePath(relativePath: string, packaged: boolean, resourcesPath = process.resourcesPath, workspaceRoot = rootDir): string {
  return packaged
    ? path.join(resourcesPath, 'renderer', relativePath)
    : path.join(workspaceRoot, 'apps', 'web', 'public', relativePath)
}

export function resolveAppIconPath(packaged: boolean, resourcesPath = process.resourcesPath, workspaceRoot = rootDir): string {
  return resolveRendererResourcePath(DEFAULT_APP_ICON, packaged, resourcesPath, workspaceRoot)
}

export function isAllowedExternalUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function startLocalApi(
  config: DesktopShellConfig,
  env: NodeJS.ProcessEnv = process.env,
  paths: DesktopRuntimePaths = createDesktopRuntimePaths(),
): DesktopApiProcess {
  const launch = createLocalApiLaunchCommand(config, env, paths)
  const child = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout?.on('data', (chunk: Buffer) => {
    console.log(`[api] ${chunk.toString().trimEnd()}`)
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    console.error(`[api] ${chunk.toString().trimEnd()}`)
  })

  return { child, url: config.apiUrl }
}

export async function stopLocalApi(apiProcess: DesktopApiProcess | null): Promise<void> {
  if (!apiProcess?.child.pid || apiProcess.child.exitCode !== null || apiProcess.child.signalCode !== null) return

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      apiProcess.child.kill('SIGKILL')
      resolve()
    }, 3000)
    apiProcess.child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    apiProcess.child.kill('SIGTERM')
  })
}

export async function runDesktopShell(config = createDesktopShellConfig(process.env)) {
  if (!isElectronRuntime()) {
    console.log(toPublicDesktopShellConfig(createDesktopShellConfig(process.env)))
    return
  }

  const electron = await import('electron')

  if (electron.app.isPackaged) {
    config = {
      ...config,
      mode: 'production',
      autoStartApi: process.env.MEDIATOOLBOX_DESKTOP_START_API !== 'false',
    }
  }

  electron.app.setName('MediaToolbox')
  await electron.app.whenReady()

  const runtimePaths = createDesktopRuntimePaths(electron)
  const runtimeEnv = createLocalApiLaunchCommand(config, process.env, runtimePaths).env
  let apiProcess: DesktopApiProcess | null = config.autoStartApi ? startLocalApi(config, runtimeEnv, runtimePaths) : null

  electron.app.on('before-quit', () => {
    void stopLocalApi(apiProcess)
    apiProcess = null
  })

  if (apiProcess) await waitForApi(config.apiUrl)
  const mainWindow = createMainWindow(electron, config)
  registerIpcHandlers(electron, config, () => apiProcess, mainWindow, runtimeEnv, runtimePaths)
  createTray(electron)
  if (isPackagedSmokeMode(process.env)) void runPackagedSmoke(electron, mainWindow)

  electron.app.on('activate', () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow(electron, config)
  })
  electron.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') electron.app.quit()
  })
}

async function runPackagedSmoke(electron: ElectronModule, window: import('electron').BrowserWindow): Promise<void> {
  try {
    await waitForRendererLoad(window.webContents)
    const result = await window.webContents.executeJavaScript(`
      Promise.all(['/api/health', '/static/app/icons/default/setting.png', '/static/web-composer/videos/vaultshield-hero.mp4'].map(async (pathname) => {
        const response = await fetch(pathname, { method: 'HEAD' })
        return [pathname, response.ok]
      })).then((checks) => Object.fromEntries(checks))
    `) as Record<string, boolean>
    const failed = Object.entries(result).filter(([, ok]) => !ok).map(([pathname]) => pathname)
    if (failed.length > 0) throw new Error(`目录包资源不可用：${failed.join(', ')}`)
    console.log('MEDIATOOLBOX_PACKAGED_SMOKE_OK')
  } catch (error) {
    console.error('MEDIATOOLBOX_PACKAGED_SMOKE_FAILED', error)
    process.exitCode = 1
  } finally {
    electron.app.quit()
  }
}

function waitForRendererLoad(webContents: import('electron').WebContents, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Renderer 加载超时。')), timeoutMs)
    webContents.once('did-finish-load', () => {
      clearTimeout(timer)
      resolve()
    })
    webContents.once('did-fail-load', (_event, _errorCode, errorDescription) => {
      clearTimeout(timer)
      reject(new Error(`Renderer 加载失败：${String(errorDescription)}`))
    })
  })
}

function createMainWindow(electron: ElectronModule, config: DesktopShellConfig) {
  const preloadPath = electron.app.isPackaged
    ? path.join(electron.app.getAppPath(), 'src', 'preload.cjs')
    : path.join(rootDir, 'apps', 'desktop', 'src', 'preload.cjs')

  const rendererUrl = electron.app.isPackaged ? config.apiUrl : config.webUrl

  const win = new electron.BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'MediaToolbox',
    icon: resolveAppIconPath(electron.app.isPackaged),
    show: false,
    backgroundColor: '#101317',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void electron.shell.openExternal(url)
    return { action: 'deny' }
  })
  void win.loadURL(rendererUrl)
  return win
}

async function waitForApi(apiUrl: string, timeoutMs = 10_000): Promise<void> {
  const healthUrl = new URL('/api/health', apiUrl).toString()
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const detail = lastError instanceof Error ? `：${lastError.message}` : ''
  throw new Error(`本地 API 启动超时${detail}`)
}

function registerIpcHandlers(
  electron: ElectronModule,
  config: DesktopShellConfig,
  getApiProcess: () => DesktopApiProcess | null,
  mainWindow: import('electron').BrowserWindow,
  runtimeEnv: NodeJS.ProcessEnv,
  runtimePaths: DesktopRuntimePaths,
) {
  electron.ipcMain.handle('mediatoolbox:get-config', () => toPublicDesktopShellConfig(config))
  electron.ipcMain.handle('mediatoolbox:get-api-status', () => {
    const apiProcess = getApiProcess()
    return {
      url: config.apiUrl,
      managed: Boolean(apiProcess),
      running: Boolean(apiProcess && apiProcess.child.exitCode === null && apiProcess.child.signalCode === null),
    }
  })
  electron.ipcMain.handle('mediatoolbox:shutdown', async () => {
    await stopLocalApi(getApiProcess())
    electron.app.quit()
    return { ok: true }
  })
  registerBrowserViewIpcHandlers(electron, mainWindow, {
    apiUrl: config.apiUrl,
    rootDir: runtimePaths.rootDir,
    env: runtimeEnv,
    desktopAuthToken: config.desktopAuthToken,
  })
}

function createTray(electron: ElectronModule) {
  const iconPath = resolveAppIconPath(electron.app.isPackaged)
  const image = electron.nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) return

  trayRef = new electron.Tray(image)
  trayRef.setToolTip('MediaToolbox')
  trayRef.setContextMenu(electron.Menu.buildFromTemplate([
    { label: 'Show MediaToolbox', click: () => electron.BrowserWindow.getAllWindows()[0]?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => electron.app.quit() },
  ]))
}

function isDirectRun() {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
}

if (isDirectRun()) {
  void runDesktopShell()
}
