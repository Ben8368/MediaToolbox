import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import type { WebComposerPresetId, WebComposerPresetState } from '@mediatoolbox/contracts'

import { clonePresetState, presetById, presets } from './presets'
import {
  isWebComposerPreviewMessage,
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewCaptureMessage,
  type WebComposerPreviewOutboundMessage,
} from './previewMessages'

type PreviewSnapshot = {
  presetId: WebComposerPresetId
  state: WebComposerPresetState
  width: number
  height: number
}

const initialPreset = presets[0]

function postToParent(message: WebComposerPreviewOutboundMessage, transfer: Transferable[] = []) {
  window.parent.postMessage(message, '*', transfer)
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('画布编码失败。')), type)
  })
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function waitForPreviewAssets(root: HTMLElement) {
  await document.fonts?.ready
  const videos = [...root.querySelectorAll('video')]
  await Promise.all(videos.map((video) => {
    if (video.readyState >= 2) return Promise.resolve()
    return new Promise<void>((resolve) => {
      const finish = () => resolve()
      video.addEventListener('loadeddata', finish, { once: true })
      video.addEventListener('error', finish, { once: true })
      window.setTimeout(finish, 3000)
    })
  }))
}

async function captureElement(root: HTMLElement, width: number, height: number) {
  await waitForPreviewAssets(root)
  return html2canvas(root, {
    backgroundColor: '#000000',
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale: 1,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  })
}

function getWebmMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

async function capturePng(root: HTMLElement, request: WebComposerPreviewCaptureMessage) {
  const canvas = await captureElement(root, request.settings.width, request.settings.height)
  const blob = await canvasToBlob(canvas, 'image/png')
  const buffer = await blob.arrayBuffer()
  postToParent({
    channel: WEB_COMPOSER_CHANNEL,
    type: 'capture-complete',
    requestId: request.requestId,
    kind: 'png',
    buffer,
    mimeType: 'image/png',
  }, [buffer])
}

async function captureWebm(root: HTMLElement, request: WebComposerPreviewCaptureMessage) {
  const mimeType = getWebmMimeType()
  if (!mimeType) throw new Error('当前桌面 Chromium 不支持 WebM 画布录制。')

  const { width, height, fps, durationSeconds } = request.settings
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (!context) throw new Error('无法创建视频输出画布。')

  const stream = output.captureStream(fps)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.min(24_000_000, Math.max(4_000_000, width * height * fps)) })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const finished = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('浏览器帧录制失败。'))
  })

  recorder.start(1000)
  const frameCount = Math.max(1, Math.round(durationSeconds * fps))
  for (let frame = 0; frame < frameCount; frame += 1) {
    const snapshot = await captureElement(root, width, height)
    context.clearRect(0, 0, width, height)
    context.drawImage(snapshot, 0, 0, width, height)
    postToParent({
      channel: WEB_COMPOSER_CHANNEL,
      type: 'capture-progress',
      requestId: request.requestId,
      current: frame + 1,
      total: frameCount,
    })
    await sleep(1000 / fps)
  }
  recorder.stop()
  await finished
  stream.getTracks().forEach((track) => track.stop())

  const buffer = await new Blob(chunks, { type: mimeType }).arrayBuffer()
  postToParent({
    channel: WEB_COMPOSER_CHANNEL,
    type: 'capture-complete',
    requestId: request.requestId,
    kind: 'webm',
    buffer,
    mimeType,
  }, [buffer])
}

export function WebComposerPreviewRuntime() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [snapshot, setSnapshot] = useState<PreviewSnapshot>({
    presetId: initialPreset.id,
    state: clonePresetState(initialPreset.defaults),
    width: 1920,
    height: 1080,
  })

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !isWebComposerPreviewMessage(event.data)) return
      if (event.data.type === 'update') {
        const message = event.data
        if (!presetById.has(message.presetId)) return
        setSnapshot({
          presetId: message.presetId,
          state: clonePresetState(message.state),
          width: message.width,
          height: message.height,
        })
        return
      }
      if (event.data.type === 'capture') {
        const request = event.data as WebComposerPreviewCaptureMessage
        const root = rootRef.current
        if (!root) return
        const capture = request.kind === 'png' ? capturePng(root, request) : captureWebm(root, request)
        void capture.catch((error) => {
          postToParent({
            channel: WEB_COMPOSER_CHANNEL,
            type: 'capture-error',
            requestId: request.requestId,
            message: error instanceof Error ? error.message : String(error),
          })
        })
      }
    }
    window.addEventListener('message', onMessage)
    postToParent({ channel: WEB_COMPOSER_CHANNEL, type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const preset = presetById.get(snapshot.presetId) ?? initialPreset
  const PresetComponent = preset.Component

  return (
    <div
      ref={rootRef}
      style={{ width: snapshot.width, height: snapshot.height, overflow: 'hidden', background: '#000' }}
      data-web-composer-preset={`${preset.id}@${preset.version}`}
    >
      <PresetComponent state={snapshot.state} />
    </div>
  )
}
