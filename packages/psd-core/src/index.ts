export { buildScanScript, parseScanOutput } from './scanner.js'
export type { ScanScriptOutput } from './scanner.js'

export { buildAlgorithmFunctions } from './algorithm.js'

export { buildApplyScript, parseApplyOutput } from './applier.js'
export type { ApplyScriptInput, ApplyScriptOutput } from './applier.js'

export { buildFontListScript, parseFontListOutput } from './fonts.js'
export type { FontListOutput } from './fonts.js'

export {
  compareRoundtripRecords,
  evaluatePsdRoundtripReport,
  FULL_ROUNDTRIP_THRESHOLDS,
  mirrorText,
  prepareRoundtripRecords,
  QUICK_ROUNDTRIP_THRESHOLDS,
  textLayerComparisonKey,
} from './roundtrip.js'
export type {
  PrepareRoundtripRecordsOptions,
  PsdRoundtripEvaluation,
  PsdRoundtripLayerDiff,
  PsdRoundtripMode,
  PsdRoundtripReport,
  PsdRoundtripThresholds,
} from './roundtrip.js'

export type PhotoshopScriptRunner = (script: string) => Promise<string>

export type PhotoshopCommandRunnerOptions = {
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export class PhotoshopPsdEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoshopPsdEngineError'
  }
}

export function createPhotoshopCommandRunner(options: PhotoshopCommandRunnerOptions): PhotoshopScriptRunner {
  return async (script: string) => {
    const [{ spawn }, fs, os, path] = await Promise.all([
      import('node:child_process'),
      import('node:fs/promises'),
      import('node:os'),
      import('node:path'),
    ])
    const scriptPath = path.join(os.tmpdir(), `mediatoolbox-photoshop-${process.pid}-${Date.now()}.jsx`)
    await fs.writeFile(scriptPath, script, 'utf8')
    try {
      const args = options.args?.length
        ? options.args.map((arg) => (arg === '{script}' ? scriptPath : arg))
        : [scriptPath]
      return await new Promise<string>((resolve, reject) => {
        const child = spawn(options.command, args, {
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          windowsHide: true,
        })
        let stdout = ''
        let stderr = ''
        child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
        child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
        child.on('error', reject)
        child.on('exit', (code) => {
          if (code === 0) resolve(stdout || stderr)
          else reject(new PhotoshopPsdEngineError(`Photoshop command failed with exit code ${code}: ${stderr || stdout}`))
        })
      })
    } finally {
      await fs.unlink(scriptPath).catch(() => undefined)
    }
  }
}
