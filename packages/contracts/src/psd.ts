import type { OkResult } from './core.js'

export type SoChainEntry = {
  fileRef: string
  layerPath: string
}

export type TextLayerRecord = {
  id: string
  layerId: number
  layerPath: string
  soChain: SoChainEntry[]
  enabled: boolean
  originalText: string
  originalFontFamily: string
  originalFontStyle: string
  originalFontPs: string
  originalSizePt: number
  originalLeadingPt: number | null
  originalTrackingValue: number
  boundsHPx: number
  boundsWPx: number
  fakesBold: boolean
  newText?: string
  newFontFamily?: string
  newFontStyle?: string
  targetLanguage?: string
  translationPrompt?: string
}

export type WorkOrder = {
  id: string
  psdPath: string
  psdFileName: string
  documentWidth: number
  documentHeight: number
  documentResolution: number
  createdAt: number
  updatedAt: number
  records: TextLayerRecord[]
}

export type TranslationLanguage = 'ja' | 'zh' | 'pt' | 'en' | 'ko' | 'fr' | 'de' | 'es'

export type WorkOrderScanResponse = OkResult & {
  workOrderId?: string
  recordCount?: number
}

export type WorkOrderGetResponse = OkResult & {
  workOrder?: WorkOrder
}

export type WorkOrderApplyResponse = OkResult & {
  outputPath?: string
  appliedCount?: number
  skippedCount?: number
}

export type WorkOrderTranslateResponse = OkResult & {
  updatedRecords?: TextLayerRecord[]
}

export type FontEntry = {
  postScriptName: string
  family: string
  style: string
}

export type FontsListResponse = OkResult & {
  fonts?: FontEntry[]
}
