import {
  createPhotoshopCommandRunner,
  createPhotoshopPsdEngine,
  type PsdEngine,
  type PsdRenderInput,
  type PsdTemplateManifest,
} from '@mediatoolbox/psd-core'

export type PsdWorkerJob =
  | { type: 'inspect'; psdPath: string }
  | { type: 'render'; template: PsdTemplateManifest; input: PsdRenderInput }

export type PsdWorkerRunOptions = {
  engine?: PsdEngine
}

export type PsdWorkerResult =
  | { type: 'inspect'; manifest: PsdTemplateManifest }
  | { type: 'render'; outputPath: string }

export class PsdWorkerEngineNotConfiguredError extends Error {
  constructor() {
    super('PSD worker requires a configured PSD engine.')
    this.name = 'PsdWorkerEngineNotConfiguredError'
  }
}

export class PsdWorkerInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PsdWorkerInputError'
  }
}

export function describePsdWorker(manifest?: PsdTemplateManifest) {
  return {
    name: 'psd-worker',
    mode: process.env['MEDIATOOLBOX_PHOTOSHOP_COMMAND'] ? 'photoshop-adapter' : 'engine-adapter',
    ...(manifest
      ? {
          templateId: manifest.id,
          slotCount: manifest.slots.length,
        }
      : {}),
  }
}

export async function runPsdWorkerJob(job: PsdWorkerJob, options: PsdWorkerRunOptions = {}): Promise<PsdWorkerResult> {
  const engine = options.engine ?? createPsdEngineFromEnv()
  if (!engine) throw new PsdWorkerEngineNotConfiguredError()

  if (job.type === 'inspect') {
    const manifest = await engine.inspect(job.psdPath)
    return { type: 'inspect', manifest }
  }

  validateRenderInput(job.template, job.input)
  const result = await engine.render(job.template, job.input)
  return { type: 'render', outputPath: result.outputPath }
}

export function createPsdEngineFromEnv(env: NodeJS.ProcessEnv = process.env): PsdEngine | undefined {
  const command = env['MEDIATOOLBOX_PHOTOSHOP_COMMAND']?.trim()
  if (!command) return undefined
  const args = parseCommandArgs(env['MEDIATOOLBOX_PHOTOSHOP_ARGS'])
  const runnerOptions = {
    command,
    ...(args ? { args } : {}),
  }
  const engineOptions = {
    runScript: createPhotoshopCommandRunner(runnerOptions),
    ...(env['MEDIATOOLBOX_PSD_OUTPUT_DIR'] ? { outputDirectory: env['MEDIATOOLBOX_PSD_OUTPUT_DIR'] } : {}),
  }
  return createPhotoshopPsdEngine(engineOptions)
}

export function validateRenderInput(template: PsdTemplateManifest, input: PsdRenderInput): void {
  const missing = template.slots
    .filter((slot) => slot.required)
    .filter((slot) => input[slot.id] === undefined || input[slot.id] === '')
    .map((slot) => slot.id)

  if (missing.length) {
    throw new PsdWorkerInputError(`Missing required PSD slot input: ${missing.join(', ')}`)
  }
}

function parseCommandArgs(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined
  return value
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean)
}
