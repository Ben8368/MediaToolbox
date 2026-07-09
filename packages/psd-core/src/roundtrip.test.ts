import { describe, expect, it } from 'vitest'
import type { TextLayerRecord } from '@mediatoolbox/contracts'

import {
  compareRoundtripRecords,
  evaluatePsdRoundtripReport,
  mirrorText,
  prepareRoundtripRecords,
  QUICK_ROUNDTRIP_THRESHOLDS,
  textLayerComparisonKey,
} from './index.js'

describe('PSD roundtrip helpers', () => {
  it('mirrors Photoshop text line by line', () => {
    expect(mirrorText('abc\r\ndef\rghi')).toBe('cba\rfed\rihg')
  })

  it('uses smart-object container paths when matching layers', () => {
    const direct = makeRecord({ layerPath: 'Title' })
    const smartObject = makeRecord({
      layerPath: 'Title',
      soChain: [{ fileRef: 'volatile.psb', layerPath: 'Mockup/Card' }],
    })

    expect(textLayerComparisonKey(direct)).toBe('Title')
    expect(textLayerComparisonKey(smartObject)).toBe('Mockup/Card :: Title')
  })

  it('prepares reversible mirror records and evaluates a restored scan', () => {
    const original = [
      makeRecord({ layerPath: 'Hero', originalText: 'Launch\rToday', boundsHPx: 120 }),
      makeRecord({
        layerPath: 'Caption',
        originalText: 'Smart',
        boundsHPx: 64,
        soChain: [{ fileRef: 'volatile.psb', layerPath: 'Phone/Screen' }],
      }),
    ]
    const mirrored = prepareRoundtripRecords(original)
    const restored = prepareRoundtripRecords(mirrored.map((record) => ({
      ...record,
      originalText: record.newText ?? record.originalText,
    })))

    expect(mirrored[0]?.newText).toBe('hcnuaL\ryadoT')
    expect(restored[0]?.newText).toBe(original[0]?.originalText)

    const roundtripScan = restored.map((record, index): TextLayerRecord => {
      const originalRecord = original[index]
      if (!originalRecord) throw new Error(`Missing original test record at index ${index}`)
      return {
        ...originalRecord,
        originalText: record.newText ?? record.originalText,
      }
    })
    const report = compareRoundtripRecords(original, roundtripScan)

    expect(report.summary.textRestorationRate).toBe(1)
    expect(report.summary.maxBoundsDriftPx).toBe(0)
    expect(evaluatePsdRoundtripReport(report, QUICK_ROUNDTRIP_THRESHOLDS)).toEqual({ ok: true, failures: [] })
  })
})

function makeRecord(overrides: Partial<TextLayerRecord> = {}): TextLayerRecord {
  return {
    id: overrides.id ?? overrides.layerPath ?? 'Layer',
    layerId: overrides.layerId ?? 1,
    layerPath: overrides.layerPath ?? 'Layer',
    soChain: overrides.soChain ?? [],
    enabled: overrides.enabled ?? true,
    originalText: overrides.originalText ?? 'Text',
    originalFontFamily: overrides.originalFontFamily ?? 'Noto Sans',
    originalFontStyle: overrides.originalFontStyle ?? 'Regular',
    originalFontPs: overrides.originalFontPs ?? 'NotoSans-Regular',
    originalSizePt: overrides.originalSizePt ?? 24,
    originalLeadingPt: overrides.originalLeadingPt ?? null,
    originalTrackingValue: overrides.originalTrackingValue ?? 0,
    boundsHPx: overrides.boundsHPx ?? 40,
    boundsWPx: overrides.boundsWPx ?? 160,
    fakesBold: overrides.fakesBold ?? false,
    ...overrides,
  }
}
