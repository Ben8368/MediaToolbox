import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const desktopDist = path.join(rootDir, 'apps', 'desktop', 'dist')
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mediatoolbox-packaged-smoke-'))
const marker = 'MEDIATOOLBOX_PACKAGED_SMOKE_OK'

function directoryNames(prefix: string): string[] {
  return fs.readdirSync(desktopDist, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(desktopDist, entry.name))
}

function findPackagedExecutable(): string {
  if (process.platform === 'win32') {
    const unpacked = path.join(desktopDist, 'win-unpacked')
    const executable = fs.readdirSync(unpacked, { withFileTypes: true }).find((entry) => entry.isFile() && entry.name.endsWith('.exe'))
    if (executable) return path.join(unpacked, executable.name)
  }

  if (process.platform === 'darwin') {
    for (const directory of directoryNames('mac')) {
      const appBundle = fs.readdirSync(directory, { withFileTypes: true }).find((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
      if (!appBundle) continue
      const binaryDirectory = path.join(directory, appBundle.name, 'Contents', 'MacOS')
      const binary = fs.readdirSync(binaryDirectory, { withFileTypes: true }).find((entry) => entry.isFile())
      if (binary) return path.join(binaryDirectory, binary.name)
    }
  }

  if (process.platform === 'linux') {
    const unpacked = path.join(desktopDist, 'linux-unpacked')
    const executable = fs.readdirSync(unpacked, { withFileTypes: true })
      .find((entry) => entry.isFile() && entry.name !== 'chrome-sandbox' && (fs.statSync(path.join(unpacked, entry.name)).mode & 0o111) !== 0)
    if (executable) return path.join(unpacked, executable.name)
  }

  throw new Error(`未找到 ${process.platform} 目录包可执行文件：${desktopDist}`)
}

async function run(): Promise<void> {
  const executable = findPackagedExecutable()
  const command = process.platform === 'linux' ? 'xvfb-run' : executable
  const args = process.platform === 'linux' ? ['--auto-servernum', executable] : []
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    MEDIATOOLBOX_PACKAGED_SMOKE: '1',
    MEDIATOOLBOX_DESKTOP_START_API: 'true',
    MEDIATOOLBOX_WORKSPACE_DIR: path.join(smokeRoot, 'workspace'),
    MEDIATOOLBOX_DB_PATH: path.join(smokeRoot, 'mediatoolbox.db'),
    PORT: '38901',
  }

  await new Promise<void>((resolve, reject) => {
    let completed = false
    let passed = false
    const child = spawn(command, args, { cwd: path.dirname(executable), env: environment, windowsHide: true })
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error('目录包 renderer 烟测超时。'))
    }, 35_000)
    const finish = (error?: Error) => {
      if (completed) return
      completed = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve()
    }
    const report = (chunk: Buffer, writer: (message: string) => void) => {
      const message = chunk.toString()
      writer(message.trimEnd())
      if (message.includes(marker)) passed = true
    }

    child.stdout.on('data', (chunk: Buffer) => report(chunk, console.log))
    child.stderr.on('data', (chunk: Buffer) => report(chunk, console.error))
    child.once('error', (error) => finish(error))
    child.once('exit', (code) => {
      if (!completed && passed && code === 0) finish()
      else if (!completed) finish(new Error(`目录包在通过烟测前退出，退出码：${code ?? 'signal'}`))
    })
  })
  console.log('Packaged Electron renderer smoke passed.')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => {
  fs.rmSync(smokeRoot, { recursive: true, force: true })
})
