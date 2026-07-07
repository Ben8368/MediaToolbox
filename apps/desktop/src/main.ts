import { spawn, type ChildProcess } from 'node:child_process'
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
}

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

export function createDesktopShellConfig(env: NodeJS.ProcessEnv): DesktopShellConfig {
  const mode = env.NODE_ENV === 'production' ? 'production' : 'development'
  const host = env.HOST ?? '127.0.0.1'
  const apiPort = Number(env.PORT ?? env.API_PORT ?? 3701)
  const apiUrl = env.MEDIATOOLBOX_API_URL ?? `http://${host}:${apiPort}`

  return {
    mode,
    host,
    apiPort,
    apiUrl,
    webUrl: env.MEDIATOOLBOX_WEB_URL ?? 'http://127.0.0.1:5173',
    autoStartApi: env.MEDIATOOLBOX_DESKTOP_START_API === 'true' || (mode === 'production' && env.MEDIATOOLBOX_DESKTOP_START_API !== 'false'),
  }
}

export function isElectronRuntime() {
  return Boolean(process.versions.electron)
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
    console.log(createDesktopShellConfig(process.env))
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

  const mainWindow = createMainWindow(electron, config)
  registerIpcHandlers(electron, config, () => apiProcess, mainWindow, runtimeEnv, runtimePaths)
  createTray(electron)

  electron.app.on('activate', () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow(electron, config)
  })
  electron.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') electron.app.quit()
  })
}

function createMainWindow(electron: ElectronModule, config: DesktopShellConfig) {
  const preloadPath = electron.app.isPackaged
    ? path.join(electron.app.getAppPath(), 'src', 'preload.cjs')
    : path.join(rootDir, 'apps', 'desktop', 'src', 'preload.cjs')

  const rendererUrl = electron.app.isPackaged
    ? pathToFileURL(path.join(process.resourcesPath, 'renderer', 'index.html')).toString()
    : config.webUrl

  const win = new electron.BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'MediaToolbox',
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
    void electron.shell.openExternal(url)
    return { action: 'deny' }
  })
  void win.loadURL(rendererUrl)
  return win
}

function registerIpcHandlers(
  electron: ElectronModule,
  config: DesktopShellConfig,
  getApiProcess: () => DesktopApiProcess | null,
  mainWindow: import('electron').BrowserWindow,
  runtimeEnv: NodeJS.ProcessEnv,
  runtimePaths: DesktopRuntimePaths,
) {
  electron.ipcMain.handle('mediatoolbox:get-config', () => config)
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
  })
}

function createTray(electron: ElectronModule) {
  const iconPath = electron.app.isPackaged
    ? path.join(process.resourcesPath, 'renderer', 'static', 'app', 'icons', 'default', 'setting.png')
    : path.join(rootDir, 'apps', 'web', 'public', 'static', 'app', 'icons', 'default', 'setting.png')
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
