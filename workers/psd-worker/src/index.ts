import { existsSync } from 'node:fs'

import type { WorkOrder } from '@mediatoolbox/contracts'
import {
  buildScanScript,
  parseScanOutput,
  buildApplyScript,
  parseApplyOutput,
  buildFontListScript,
  parseFontListOutput,
  createPhotoshopCommandRunner,
  PhotoshopPsdEngineError,
  type PhotoshopScriptRunner,
} from '@mediatoolbox/psd-core'

export type PsdWorkerJob =
  | { type: 'scan'; psdPath: string }
  | { type: 'apply'; workOrder: WorkOrder; outputPsdPath: string }
  | { type: 'list-fonts' }

export type PsdWorkerResult =
  | { type: 'scan'; documentWidth: number; documentHeight: number; documentResolution: number; records: WorkOrder['records'] }
  | { type: 'apply'; outputPath: string; appliedCount: number; skippedCount: number; results: Array<{ id: string; skipped?: boolean; converged?: boolean; error?: string }> }
  | { type: 'list-fonts'; fonts: Array<{ postScriptName: string; family: string; style: string }> }

export class PsdWorkerEngineNotConfiguredError extends Error {
  constructor() {
    super('PSD worker requires MEDIATOOLBOX_PHOTOSHOP_COMMAND to be set.')
    this.name = 'PsdWorkerEngineNotConfiguredError'
  }
}

export class PsdWorkerInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PsdWorkerInputError'
  }
}

export async function runPsdWorkerJob(job: PsdWorkerJob, runScript?: PhotoshopScriptRunner): Promise<PsdWorkerResult> {
  const runner = runScript ?? createRunnerFromEnv()
  if (!runner) throw new PsdWorkerEngineNotConfiguredError()

  if (job.type === 'scan') {
    const script = buildScanScript(job.psdPath)
    const output = await runner(script)
    const result = parseScanOutput(output)
    if (!result.ok) throw new PhotoshopPsdEngineError(result.message ?? 'Scan failed')
    return {
      type: 'scan',
      documentWidth: result.documentWidth ?? 0,
      documentHeight: result.documentHeight ?? 0,
      documentResolution: result.documentResolution ?? 72,
      records: result.records ?? [],
    }
  }

  if (job.type === 'apply') {
    const script = buildApplyScript({
      psdPath: job.workOrder.psdPath,
      outputPath: job.outputPsdPath,
      records: job.workOrder.records,
    })
    const output = await runner(script)
    const result = parseApplyOutput(output)
    if (!result.ok) throw new PhotoshopPsdEngineError(result.message ?? 'Apply failed')
    return {
      type: 'apply',
      outputPath: result.outputPath ?? job.outputPsdPath,
      appliedCount: result.appliedCount ?? 0,
      skippedCount: result.skippedCount ?? 0,
      results: result.results ?? [],
    }
  }

  if (job.type === 'list-fonts') {
    const script = buildFontListScript()
    const output = await runner(script)
    const result = parseFontListOutput(output)
    if (!result.ok) throw new PhotoshopPsdEngineError(result.message ?? 'Font list failed')
    return { type: 'list-fonts', fonts: result.fonts ?? [] }
  }

  throw new PsdWorkerInputError(`Unknown job type: ${(job as { type: string }).type}`)
}

function createRunnerFromEnv(env: NodeJS.ProcessEnv = process.env): PhotoshopScriptRunner | undefined {
  const command = env['MEDIATOOLBOX_PHOTOSHOP_COMMAND']?.trim() || autoDetectPhotoshop()
  if (!command) return undefined
  const rawArgs = env['MEDIATOOLBOX_PHOTOSHOP_ARGS']
  const args = rawArgs?.trim()
    ? rawArgs.split(' ').map((a) => a.trim()).filter(Boolean)
    : undefined
  return createPhotoshopCommandRunner({ command, ...(args ? { args } : {}) })
}

const PHOTOSHOP_YEARS = [2026, 2025, 2024, 2023, 2022, 2021]

function autoDetectPhotoshop(): string | undefined {
  const candidates: string[] =
    process.platform === 'win32'
      ? PHOTOSHOP_YEARS.flatMap((y) => [
          `C:\\Program Files\\Adobe\\Adobe Photoshop ${y}\\Photoshop.exe`,
          `C:\\Program Files (x86)\\Adobe\\Adobe Photoshop ${y}\\Photoshop.exe`,
        ])
      : PHOTOSHOP_YEARS.map(
          (y) => `/Applications/Adobe Photoshop ${y}/Adobe Photoshop ${y}.app/Contents/MacOS/Adobe Photoshop ${y}`,
        )
  return candidates.find((p) => existsSync(p))
}
