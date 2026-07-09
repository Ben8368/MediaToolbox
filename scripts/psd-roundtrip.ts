import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import type { WorkOrder } from '@mediatoolbox/contracts'
import {
  compareRoundtripRecords,
  evaluatePsdRoundtripReport,
  FULL_ROUNDTRIP_THRESHOLDS,
  prepareRoundtripRecords,
  QUICK_ROUNDTRIP_THRESHOLDS,
  type PsdRoundtripMode,
} from '@mediatoolbox/psd-core'
import {
  PsdWorkerEngineNotConfiguredError,
  runPsdWorkerJob,
} from '@mediatoolbox/psd-worker'

type CliOptions = {
  fixture: 'smoke' | 'baseline'
  mode: PsdRoundtripMode
  psdPath?: string
  outDir: string
  roundName: string
  targetFontFamily: string
  restoreFontFamily: string
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const repoRoot = process.cwd()
  const psdPath = path.resolve(repoRoot, options.psdPath ?? path.join('fixtures', 'psd', 'photoshop-workbench', `${options.fixture}.psd`))
  const runDir = path.resolve(repoRoot, options.outDir, options.roundName)
  await mkdir(runDir, { recursive: true })

  const stem = path.basename(psdPath, path.extname(psdPath))
  const mirrorPath = path.join(runDir, `${stem}-mirror.psd`)
  const restoredPath = path.join(runDir, `${stem}-mirror-mirror.psd`)
  const reportPath = path.join(runDir, 'comparison.json')

  console.log('=== MediaToolbox PSD Roundtrip ===')
  console.log(`PSD: ${psdPath}`)
  console.log(`Mode: ${options.mode}`)
  console.log(`Output: ${runDir}`)

  const startedAt = Date.now()

  try {
    const original = await scan(psdPath)
    console.log(`Step 1 scan: ${original.records.length} text layer(s)`)
    if (original.records.length === 0) throw new Error('No text layers found in PSD.')

    const step1Records = prepareRoundtripRecords(original.records, {
      ...(options.mode === 'full' ? { targetFontFamily: options.targetFontFamily } : {}),
    })
    const step1StartedAt = Date.now()
    const step1 = await apply(psdPath, original, step1Records, mirrorPath)
    const step1TimeS = elapsedSeconds(step1StartedAt)
    console.log(`Step 1 apply: ${step1.appliedCount} applied, ${step1.skippedCount} skipped (${step1TimeS}s)`)

    const mirrored = await scan(mirrorPath)
    console.log(`Step 2 scan: ${mirrored.records.length} text layer(s)`)

    const step2Records = prepareRoundtripRecords(mirrored.records, {
      ...(options.mode === 'full' ? { targetFontFamily: options.restoreFontFamily } : {}),
    })
    const step2StartedAt = Date.now()
    const step2 = await apply(mirrorPath, mirrored, step2Records, restoredPath)
    const step2TimeS = elapsedSeconds(step2StartedAt)
    console.log(`Step 2 apply: ${step2.appliedCount} applied, ${step2.skippedCount} skipped (${step2TimeS}s)`)

    const roundtrip = await scan(restoredPath)
    const report = compareRoundtripRecords(original.records, roundtrip.records)
    const thresholds = options.mode === 'full' ? FULL_ROUNDTRIP_THRESHOLDS : QUICK_ROUNDTRIP_THRESHOLDS
    const evaluation = evaluatePsdRoundtripReport(report, thresholds)
    const totalTimeS = elapsedSeconds(startedAt)

    await writeFile(reportPath, `${JSON.stringify({
      psdPath,
      mode: options.mode,
      output: { mirrorPath, restoredPath },
      timings: { step1TimeS, step2TimeS, totalTimeS },
      report,
      evaluation,
    }, null, 2)}\n`, 'utf8')

    printSummary(report, evaluation, reportPath, totalTimeS)
    if (!evaluation.ok) process.exitCode = 1
  } catch (error) {
    if (error instanceof PsdWorkerEngineNotConfiguredError) {
      console.error('Photoshop runner is not configured. Set MEDIATOOLBOX_PHOTOSHOP_COMMAND or install a supported Photoshop version.')
      process.exitCode = 2
      return
    }
    console.error('Error details:', error)
    throw error
  }
}

async function scan(psdPath: string) {
  const result = await runPsdWorkerJob({ type: 'scan', psdPath })
  if (result.type !== 'scan') throw new Error('PSD worker returned a non-scan result.')
  return result
}

async function apply(
  sourcePsdPath: string,
  scanned: Awaited<ReturnType<typeof scan>>,
  records: WorkOrder['records'],
  outputPsdPath: string,
) {
  const workOrder: WorkOrder = {
    id: `roundtrip-${Date.now()}`,
    psdPath: sourcePsdPath,
    psdFileName: path.basename(sourcePsdPath),
    documentWidth: scanned.documentWidth,
    documentHeight: scanned.documentHeight,
    documentResolution: scanned.documentResolution,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    records,
  }
  const result = await runPsdWorkerJob({ type: 'apply', workOrder, outputPsdPath })
  if (result.type !== 'apply') throw new Error('PSD worker returned a non-apply result.')
  return result
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    fixture: 'smoke',
    mode: 'quick',
    outDir: '.tmp/psd-roundtrip',
    roundName: timestampRoundName(),
    targetFontFamily: 'Byte Sans',
    restoreFontFamily: 'Noto Sans',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const value = args[i + 1]
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
    if (!value) throw new Error(`Missing value for ${arg}`)
    if (arg === '--fixture') {
      if (value !== 'smoke' && value !== 'baseline') throw new Error('--fixture must be smoke or baseline')
      options.fixture = value
      i++
    } else if (arg === '--mode') {
      if (value !== 'quick' && value !== 'full') throw new Error('--mode must be quick or full')
      options.mode = value
      i++
    } else if (arg === '--psd') {
      options.psdPath = value
      i++
    } else if (arg === '--out-dir') {
      options.outDir = value
      i++
    } else if (arg === '--round') {
      options.roundName = value
      i++
    } else if (arg === '--target-font') {
      options.targetFontFamily = value
      i++
    } else if (arg === '--restore-font') {
      options.restoreFontFamily = value
      i++
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function printSummary(
  report: ReturnType<typeof compareRoundtripRecords>,
  evaluation: ReturnType<typeof evaluatePsdRoundtripReport>,
  reportPath: string,
  totalTimeS: number,
) {
  console.log('')
  console.log('=== Comparison Summary ===')
  console.log(`Total layers: ${report.totalLayers}`)
  console.log(`Matched: ${report.matchedLayers}`)
  console.log(`Missing: ${report.missingLayers.length}`)
  console.log(`Text restored: ${formatRate(report.summary.textRestorationRate)}`)
  console.log(`Font restored: ${formatRate(report.summary.fontRestorationRate)}`)
  console.log(`Max size drift: ${report.summary.maxSizeDriftPct}%`)
  console.log(`Max tracking drift: ${report.summary.maxTrackingDrift}`)
  console.log(`Max bounds drift: ${report.summary.maxBoundsDriftPx}px`)
  console.log(`Total time: ${totalTimeS}s`)
  console.log(`Report: ${reportPath}`)
  console.log(`Result: ${evaluation.ok ? 'PASS' : 'FAIL'}`)
  for (const failure of evaluation.failures) console.log(`- ${failure}`)
}

function printHelp() {
  console.log(`Usage:
  npm run psd:roundtrip -- --fixture smoke --mode quick
  npm run psd:roundtrip -- --fixture baseline --mode full --round round1

Options:
  --fixture smoke|baseline   Use a checked-in PSD fixture. Defaults to smoke.
  --psd <path>               Use a custom PSD path instead of a fixture.
  --mode quick|full          quick mirrors text only; full also swaps fonts.
  --out-dir <path>           Output directory. Defaults to .tmp/psd-roundtrip.
  --round <name>             Stable run directory name.
  --target-font <family>     Full-mode step 1 font family. Defaults to Byte Sans.
  --restore-font <family>    Full-mode step 2 font family. Defaults to Noto Sans.`)
}

function elapsedSeconds(startedAt: number): number {
  return Math.round((Date.now() - startedAt) / 100) / 10
}

function timestampRoundName(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
}

function formatRate(value: number): string {
  return `${Math.round(value * 10000) / 100}%`
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
