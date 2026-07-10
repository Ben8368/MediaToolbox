import type { TextLayerRecord } from '@mediatoolbox/contracts'

export type PsdRoundtripMode = 'quick' | 'full'

export type PrepareRoundtripRecordsOptions = {
  targetFontFamily?: string
}

export type PsdRoundtripLayerDiff = {
  key: string
  layerPath: string
  soPath: string
  originalText: string
  roundtripText: string
  originalFontPs: string
  roundtripFontPs: string
  textRestored: boolean
  fontRestored: boolean
  sizeDriftPct: number
  trackingDrift: number
  boundsDriftPx: number
  leadingDrift: number | null
}

export type PsdRoundtripReport = {
  totalLayers: number
  matchedLayers: number
  missingLayers: string[]
  layers: PsdRoundtripLayerDiff[]
  summary: {
    textRestorationRate: number
    fontRestorationRate: number
    avgSizeDriftPct: number
    avgTrackingDrift: number
    avgBoundsDriftPx: number
    avgLeadingDrift: number | null
    maxSizeDriftPct: number
    maxTrackingDrift: number
    maxBoundsDriftPx: number
  }
}

export type PsdRoundtripThresholds = {
  minTextRestorationRate?: number
  minFontRestorationRate?: number
  maxSizeDriftPct?: number
  maxTrackingDrift?: number
  maxBoundsDriftPx?: number
}

export type PsdRoundtripEvaluation = {
  ok: boolean
  failures: string[]
}

export const QUICK_ROUNDTRIP_THRESHOLDS: Required<PsdRoundtripThresholds> = {
  minTextRestorationRate: 1,
  minFontRestorationRate: 1,
  maxSizeDriftPct: 60,
  maxTrackingDrift: 260,
  maxBoundsDriftPx: 15,
}

export const FULL_ROUNDTRIP_THRESHOLDS: Required<PsdRoundtripThresholds> = {
  minTextRestorationRate: 1,
  minFontRestorationRate: 0.9,
  maxSizeDriftPct: 8,
  maxTrackingDrift: 20,
  maxBoundsDriftPx: 3,
}

export function mirrorText(text: string): string {
  if (!text) return text
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => Array.from(line).reverse().join(''))
    .join('\r')
}

export function prepareRoundtripRecords(
  records: TextLayerRecord[],
  options: PrepareRoundtripRecordsOptions = {},
): TextLayerRecord[] {
  return records.map((record) => ({
    ...record,
    enabled: true,
    newText: mirrorText(record.originalText),
    ...(options.targetFontFamily
      ? {
          newFontFamily: options.targetFontFamily,
          newFontStyle: '',
        }
      : {}),
  }))
}

export function textLayerComparisonKey(record: Pick<TextLayerRecord, 'layerPath' | 'soChain'>): string {
  const soPath = record.soChain.map((entry) => entry.layerPath).join(' > ')
  return soPath ? `${soPath} :: ${record.layerPath}` : record.layerPath
}

export function compareRoundtripRecords(original: TextLayerRecord[], roundtrip: TextLayerRecord[]): PsdRoundtripReport {
  const roundtripByKey = new Map(roundtrip.map((record) => [textLayerComparisonKey(record), record]))
  const layers: PsdRoundtripLayerDiff[] = []
  const missingLayers: string[] = []

  for (const originalRecord of original) {
    const key = textLayerComparisonKey(originalRecord)
    const roundtripRecord = roundtripByKey.get(key)
    if (!roundtripRecord) {
      missingLayers.push(key)
      continue
    }

    const leadingDrift = originalRecord.originalLeadingPt === null || roundtripRecord.originalLeadingPt === null
      ? null
      : round2(Math.abs(roundtripRecord.originalLeadingPt - originalRecord.originalLeadingPt))

    layers.push({
      key,
      layerPath: originalRecord.layerPath,
      soPath: originalRecord.soChain.map((entry) => entry.layerPath).join(' > '),
      originalText: originalRecord.originalText,
      roundtripText: roundtripRecord.originalText,
      originalFontPs: originalRecord.originalFontPs,
      roundtripFontPs: roundtripRecord.originalFontPs,
      textRestored: normalizePhotoshopText(originalRecord.originalText).trim() === normalizePhotoshopText(roundtripRecord.originalText).trim(),
      fontRestored: originalRecord.originalFontPs === roundtripRecord.originalFontPs,
      sizeDriftPct: round2(Math.abs(roundtripRecord.originalSizePt - originalRecord.originalSizePt) / Math.max(originalRecord.originalSizePt, 0.1) * 100),
      trackingDrift: round2(Math.abs(roundtripRecord.originalTrackingValue - originalRecord.originalTrackingValue)),
      boundsDriftPx: round2(Math.abs(roundtripRecord.boundsHPx - originalRecord.boundsHPx)),
      leadingDrift,
    })
  }

  return {
    totalLayers: original.length,
    matchedLayers: layers.length,
    missingLayers,
    layers,
    summary: {
      textRestorationRate: ratio(layers.filter((layer) => layer.textRestored).length, layers.length),
      fontRestorationRate: ratio(layers.filter((layer) => layer.fontRestored).length, layers.length),
      avgSizeDriftPct: average(layers.map((layer) => layer.sizeDriftPct)),
      avgTrackingDrift: average(layers.map((layer) => layer.trackingDrift)),
      avgBoundsDriftPx: average(layers.map((layer) => layer.boundsDriftPx)),
      avgLeadingDrift: averageNullable(layers.map((layer) => layer.leadingDrift)),
      maxSizeDriftPct: max(layers.map((layer) => layer.sizeDriftPct)),
      maxTrackingDrift: max(layers.map((layer) => layer.trackingDrift)),
      maxBoundsDriftPx: max(layers.map((layer) => layer.boundsDriftPx)),
    },
  }
}

export function evaluatePsdRoundtripReport(
  report: PsdRoundtripReport,
  thresholds: PsdRoundtripThresholds,
): PsdRoundtripEvaluation {
  const failures: string[] = []

  if (report.missingLayers.length > 0) {
    failures.push(`missing ${report.missingLayers.length} layer(s) after roundtrip`)
  }
  if (thresholds.minTextRestorationRate !== undefined && report.summary.textRestorationRate < thresholds.minTextRestorationRate) {
    failures.push(`text restoration rate ${formatRate(report.summary.textRestorationRate)} < ${formatRate(thresholds.minTextRestorationRate)}`)
  }
  if (thresholds.minFontRestorationRate !== undefined && report.summary.fontRestorationRate < thresholds.minFontRestorationRate) {
    failures.push(`font restoration rate ${formatRate(report.summary.fontRestorationRate)} < ${formatRate(thresholds.minFontRestorationRate)}`)
  }
  if (thresholds.maxSizeDriftPct !== undefined && report.summary.maxSizeDriftPct > thresholds.maxSizeDriftPct) {
    failures.push(`max size drift ${report.summary.maxSizeDriftPct}% > ${thresholds.maxSizeDriftPct}%`)
  }
  if (thresholds.maxTrackingDrift !== undefined && report.summary.maxTrackingDrift > thresholds.maxTrackingDrift) {
    failures.push(`max tracking drift ${report.summary.maxTrackingDrift} > ${thresholds.maxTrackingDrift}`)
  }
  if (thresholds.maxBoundsDriftPx !== undefined && report.summary.maxBoundsDriftPx > thresholds.maxBoundsDriftPx) {
    failures.push(`max bounds drift ${report.summary.maxBoundsDriftPx}px > ${thresholds.maxBoundsDriftPx}px`)
  }

  return { ok: failures.length === 0, failures }
}

function normalizePhotoshopText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round4(numerator / denominator)
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : round2(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function averageNullable(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value !== null)
  return numericValues.length === 0 ? null : average(numericValues)
}

function max(values: number[]): number {
  return values.length === 0 ? 0 : round2(Math.max(...values))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function formatRate(value: number): string {
  return `${Math.round(value * 10000) / 100}%`
}
