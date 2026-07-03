import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

export function startLocalApi(config: DesktopShellConfig, env: NodeJS.ProcessEnv = process.env): DesktopApiProcess {
  const nodeBin = env.MEDIATOOLBOX_NODE_BIN?.trim() || 'node'
  const child = spawn(nodeBin, [path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
    cwd: path.join(rootDir, 'apps', 'api'),
    env: {
      ...process.env,
      HOST: config.host,
      PORT: String(config.apiPort),
    },
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
  let apiProcess: DesktopApiProcess | null = config.autoStartApi ? startLocalApi(config) : null

  electron.app.setName('MediaToolbox')
  electron.app.on('before-quit', () => {
    void stopLocalApi(apiProcess)
    apiProcess = null
  })

  await electron.app.whenReady()
  registerIpcHandlers(electron, config, () => apiProcess)
  createMainWindow(electron, config)
  createTray(electron)

  electron.app.on('activate', () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createMainWindow(electron, config)
  })
  electron.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') electron.app.quit()
  })
}

function createMainWindow(electron: ElectronModule, config: DesktopShellConfig) {
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
    },
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void electron.shell.openExternal(url)
    return { action: 'deny' }
  })
  void win.loadURL(config.webUrl)
  return win
}

function registerIpcHandlers(electron: ElectronModule, config: DesktopShellConfig, getApiProcess: () => DesktopApiProcess | null) {
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
}

function createTray(electron: ElectronModule) {
  const iconPath = path.join(rootDir, 'apps', 'web', 'public', 'static', 'app', 'icons', 'default', 'setting.png')
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
