import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { WebComposerExportSettings, WebComposerPresetId } from '@mediatoolbox/contracts'

import { cancelJob, fetchAssets, getJob, submitWebComposerPng, submitWebComposerVideo } from '@/api'
import {
  isWebComposerPreviewMessage,
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewCaptureMessage,
} from './previewMessages'

type PendingCapture = {
  requestId: string
  resolve: (result: { buffer: ArrayBuffer; mimeType: string }) => void
  reject: (error: Error) => void
  timer: number
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function useWebComposerExport(iframeRef: RefObject<HTMLIFrameElement>) {
  const pendingRef = useRef<PendingCapture | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('选择预设后可编辑文案、素材与颜色。')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !isWebComposerPreviewMessage(event.data)) return
      if (event.data.type === 'ready') {
        setReady(true)
        return
      }
      if (event.data.type === 'update' || event.data.type === 'capture') return
      const pending = pendingRef.current
      if (!pending || event.data.requestId !== pending.requestId) return
      if (event.data.type === 'capture-progress') {
        setStatus(`正在捕获网页帧 ${event.data.current}/${event.data.total}…`)
      } else if (event.data.type === 'capture-error') {
        window.clearTimeout(pending.timer)
        pendingRef.current = null
        pending.reject(new Error(event.data.message))
      } else if (event.data.type === 'capture-complete') {
        window.clearTimeout(pending.timer)
        pendingRef.current = null
        pending.resolve({ buffer: event.data.buffer, mimeType: event.data.mimeType })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeRef])

  const requestCapture = useCallback((kind: 'png' | 'webm', settings: WebComposerExportSettings) => {
    if (!ready || !iframeRef.current?.contentWindow) return Promise.reject(new Error('预设画布尚未准备完成。'))
    if (pendingRef.current) return Promise.reject(new Error('已有捕获任务正在执行。'))
    const requestId = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return new Promise<{ buffer: ArrayBuffer; mimeType: string }>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pendingRef.current = null
        reject(new Error('画面捕获超时，请减少时长、帧率或输出尺寸后重试。'))
      }, Math.max(120_000, settings.durationSeconds * 15_000))
      pendingRef.current = { requestId, resolve, reject, timer }
      const message: WebComposerPreviewCaptureMessage = {
        channel: WEB_COMPOSER_CHANNEL,
        type: 'capture',
        requestId,
        kind,
        settings,
      }
      iframeRef.current?.contentWindow?.postMessage(message, '*')
    })
  }, [iframeRef, ready])

  const waitForJob = useCallback(async (jobId: string) => {
    for (let attempt = 0; attempt < 480; attempt += 1) {
      const response = await getJob(jobId)
      const job = response.job
      if (!job) throw new Error('导出任务不存在。')
      if (job.progress) setStatus(`正在生成文件：${Math.round(job.progress.current)}%`)
      if (job.status === 'succeeded') return job
      if (job.status === 'failed') throw new Error(job.errorMessage || '导出任务失败。')
      if (job.status === 'canceled') throw new Error('导出任务已取消。')
      await sleep(500)
    }
    throw new Error('导出任务等待超时。')
  }, [])

  const exportComposition = useCallback(async (
    kind: 'png' | 'webm',
    presetId: WebComposerPresetId,
    settings: WebComposerExportSettings,
  ) => {
    if (busy) return
    setBusy(true)
    setActiveJobId(null)
    setStatus(kind === 'png' ? '正在捕获 PNG…' : '正在捕获视频帧…')
    try {
      const capture = await requestCapture(kind, settings)
      setStatus('捕获完成，正在提交统一导出任务…')
      const metadata = {
        presetId,
        presetVersion: 1 as const,
        width: settings.width,
        height: settings.height,
        ...(kind === 'webm' ? { fps: settings.fps, durationSeconds: settings.durationSeconds } : {}),
      }
      const job = kind === 'png'
        ? await submitWebComposerPng(capture.buffer, metadata)
        : await submitWebComposerVideo(capture.buffer, metadata)
      setActiveJobId(job.id)
      await waitForJob(job.id)
      const assets = await fetchAssets()
      const asset = assets.assets.find((item) => item.id === `asset-${job.id}`)
      setStatus(asset ? `导出完成：${asset.path}` : '导出完成，结果已写入工作区 Exports。')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '导出失败。')
    } finally {
      setActiveJobId(null)
      setBusy(false)
    }
  }, [busy, requestCapture, waitForJob])

  const cancel = useCallback(async () => {
    if (!activeJobId) return
    await cancelJob(activeJobId)
    setStatus('正在取消导出任务…')
  }, [activeJobId])

  return { ready, busy, status, activeJobId, exportComposition, cancel }
}
