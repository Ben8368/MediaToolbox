/**
 * ytdlp — yt-dlp 子进程封装
 * 解析 stdout 进度行，支持取消（kill 子进程）。
 * 跨平台：通过 PATH 查找 yt-dlp 二进制（Win: yt-dlp.exe，其他: yt-dlp）。
 */
import { execa } from 'execa'

// ─── 进度回调 ──────────────────────────────────────────────────────────────

export interface ProgressInfo {
  percent: number    // 0–100
  stage: string      // 'downloading' | 'transcoding' | 'merging' | 'converting'
  raw: string        // 原始行，供调试
}

export type ProgressCallback = (info: ProgressInfo) => void

// ─── 进度行解析 ────────────────────────────────────────────────────────────

// [download]  73.4% of ~  45.23MiB at    3.21MiB/s ETA 00:08
const DOWNLOAD_RE = /\[download\]\s+([\d.]+)%/
// [VideoConvertor] Converting ...
const TRANSCODE_RE = /\[VideoConvertor\]/i
// [Merger] Merging ...
const MERGER_RE = /\[Merger\]/i
// [ExtractAudio] or [ffmpeg]
const FFMPEG_RE = /\[ffmpeg\]|\[ExtractAudio\]/i

function parseLine(line: string): ProgressInfo | null {
  const dl = DOWNLOAD_RE.exec(line)
  if (dl) {
    return { percent: parseFloat(dl[1]), stage: 'downloading', raw: line }
  }
  if (TRANSCODE_RE.test(line)) {
    return { percent: 100, stage: 'transcoding', raw: line }
  }
  if (MERGER_RE.test(line)) {
    return { percent: 100, stage: 'merging', raw: line }
  }
  if (FFMPEG_RE.test(line)) {
    return { percent: 100, stage: 'converting', raw: line }
  }
  return null
}

// ─── 运行接口 ──────────────────────────────────────────────────────────────

export interface RunResult {
  stdout: string
  stderr: string
}

export interface RunHandle {
  /** 等待完成，resolve 或 reject */
  promise: Promise<RunResult>
  /** 取消：向子进程发 SIGTERM */
  cancel: () => void
}

const YTDLP_BIN = process.env.YTDLP_BIN ?? 'yt-dlp'

/**
 * 启动 yt-dlp，返回句柄。
 * @param args        buildYtdlpArgs() 返回的参数数组（不含 URL）
 * @param url         目标 URL
 * @param timeoutMs   超时毫秒数（默认 6 小时），超时后自动 SIGTERM
 * @param onProgress  进度回调（可选）
 */
export function runYtdlp(
  args: string[],
  url: string,
  timeoutMs: number,
  onProgress?: ProgressCallback,
): RunHandle {
  const allArgs = [...args, '--', url]

  let child: ReturnType<typeof execa> | null = null
  let cancelled = false
  let timedOut = false
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  const doCancel = (reason: 'cancelled' | 'timeout') => {
    if (reason === 'timeout') timedOut = true
    else cancelled = true
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }
    child?.kill('SIGTERM')
  }

  const promise = new Promise<RunResult>((resolve, reject) => {
    child = execa(YTDLP_BIN, allArgs, {
      // 不使用 shell，参数已是数组，跨平台安全
      shell: false,
      // 拆行给 onProgress 逐行处理
      lines: true,
    })

    // 启动超时定时器
    timeoutHandle = setTimeout(() => {
      timeoutHandle = null
      doCancel('timeout')
    }, timeoutMs)

    const stdoutLines: string[] = []
    const stderrLines: string[] = []

    child.stdout?.on('data', (chunk: string | string[]) => {
      const lines = Array.isArray(chunk) ? chunk : [chunk]
      for (const line of lines) {
        stdoutLines.push(line)
        if (onProgress) {
          const info = parseLine(line)
          if (info) onProgress(info)
        }
      }
    })

    child.stderr?.on('data', (chunk: string | string[]) => {
      const lines = Array.isArray(chunk) ? chunk : [chunk]
      stderrLines.push(...lines)
    })

    child.then(() => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
      resolve({ stdout: stdoutLines.join('\n'), stderr: stderrLines.join('\n') })
    }).catch((err: unknown) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
        timeoutHandle = null
      }
      if (timedOut) {
        reject(new Error('timeout'))
      } else if (cancelled) {
        reject(new Error('cancelled'))
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'stderr' in err
              ? String((err as { stderr: unknown }).stderr)
              : String(err)
        reject(new Error(msg))
      }
    })
  })

  return {
    promise,
    cancel: () => doCancel('cancelled'),
  }
}
