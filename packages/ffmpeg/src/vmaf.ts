import { spawn } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export type VmafRunOptions = {
  command?: string
  signal?: AbortSignal
}

export type VmafResult = {
  vmafScore: number
}

export function buildVmafArgs(referencePath: string, distortedPath: string, jsonLogPath: string): string[] {
  return [
    '-i', distortedPath,
    '-i', referencePath,
    '-lavfi', `libvmaf=log_path=${jsonLogPath}:log_fmt=json`,
    '-f', 'null', '-',
  ]
}

export function runVmafComparison(
  referencePath: string,
  distortedPath: string,
  options: VmafRunOptions = {},
): Promise<VmafResult> {
  const command = options.command ?? 'ffmpeg'
  const jsonLogPath = join(tmpdir(), `vmaf-${randomUUID()}.json`)
  const args = buildVmafArgs(referencePath, distortedPath, jsonLogPath)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', windowsHide: true })
    let stderr = ''

    const abort = () => child.kill()
    options.signal?.addEventListener('abort', abort, { once: true })

    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    child.once('error', (err) => {
      options.signal?.removeEventListener('abort', abort)
      reject(err)
    })

    child.once('close', async (code) => {
      options.signal?.removeEventListener('abort', abort)
      if (code !== 0) {
        reject(new Error(stderr.trim() || `VMAF 计算失败，退出码 ${code}`))
        return
      }
      try {
        const raw = await readFile(jsonLogPath, 'utf8')
        const parsed = JSON.parse(raw) as { pooled_metrics?: { vmaf?: { mean?: number } } }
        const vmafScore = parsed.pooled_metrics?.vmaf?.mean
        if (vmafScore === undefined) {
          reject(new Error('VMAF 输出中未找到分数。'))
          return
        }
        resolve({ vmafScore })
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      } finally {
        await unlink(jsonLogPath).catch(() => undefined)
      }
    })
  })
}
