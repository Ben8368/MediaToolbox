/**
 * photoshop/executor — Photoshop 命令行调用封装
 * 通过 child_process 执行 ExtendScript (.jsx) 脚本
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export interface PSExecutorOptions {
  scriptPath: string
  params: Record<string, unknown>
  timeoutMs?: number
}

export interface PSExecutorHandle {
  promise: Promise<PSExecutorResult>
  cancel: () => void
}

export interface PSExecutorResult {
  stdout: string
  stderr: string
  exitCode: number
}

// Photoshop 可执行文件路径（优先从环境变量读取）
const PS_EXECUTABLE = process.env.PS_EXECUTABLE ?? 'C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe'

/**
 * 执行 Photoshop ExtendScript 脚本
 * @param options 执行选项
 * @returns 句柄，包含 promise 和 cancel 函数
 */
export function runPhotoshopScript(options: PSExecutorOptions): PSExecutorHandle {
  const { scriptPath, params, timeoutMs = 10 * 60 * 1000 } = options

  // 校验脚本文件存在
  const absScriptPath = resolve(scriptPath)
  if (!existsSync(absScriptPath)) {
    const error = new Error(`脚本文件不存在: ${absScriptPath}`)
    return {
      promise: Promise.reject(error),
      cancel: () => {},
    }
  }

  // 校验 Photoshop 可执行文件
  if (!existsSync(PS_EXECUTABLE)) {
    const error = new Error(`Photoshop 可执行文件不存在: ${PS_EXECUTABLE}，请设置环境变量 PS_EXECUTABLE`)
    return {
      promise: Promise.reject(error),
      cancel: () => {},
    }
  }

  let cancelled = false
  let timeoutHandle: NodeJS.Timeout | null = null

  const promise = new Promise<PSExecutorResult>((resolve, reject) => {
    // Photoshop 命令行参数:
    // -r <script> 执行脚本
    // 通过环境变量传递 JSON 参数（避免命令行注入）
    const proc = spawn(PS_EXECUTABLE, ['-r', absScriptPath], {
      env: {
        ...process.env,
        PS_SCRIPT_PARAMS: JSON.stringify(params),
      },
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })

    proc.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })

    proc.on('error', (err) => {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      reject(err)
    })

    proc.on('close', (code) => {
      if (timeoutHandle) clearTimeout(timeoutHandle)

      if (cancelled) {
        reject(new Error('cancelled'))
        return
      }

      resolve({
        stdout,
        stderr,
        exitCode: code ?? -1,
      })
    })

    // 超时控制
    timeoutHandle = setTimeout(() => {
      proc.kill('SIGTERM')
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
      }, 5000)
      reject(new Error('timeout'))
    }, timeoutMs)

    // cancel 函数
    const cancel = () => {
      cancelled = true
      proc.kill('SIGTERM')
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
      }, 5000)
    }

    // 将 cancel 函数附加到 promise 上（通过闭包返回）
    promise.cancel = cancel
  }) as Promise<PSExecutorResult> & { cancel?: () => void }

  return {
    promise,
    cancel: promise.cancel ?? (() => {}),
  }
}
