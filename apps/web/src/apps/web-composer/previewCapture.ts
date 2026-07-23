import html2canvas from 'html2canvas'

import {
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewCaptureMessage,
  type WebComposerPreviewOutboundMessage,
} from './previewMessages'
import { recordPreviewFrames } from './previewRecording'

type WithoutSession<T> = T extends { sessionId: string } ? Omit<T, 'sessionId'> : never
type WebComposerPreviewOutboundPayload = WithoutSession<WebComposerPreviewOutboundMessage>

export type WebComposerPostToParent = (
  message: WebComposerPreviewOutboundPayload,
  transfer?: Transferable[],
) => void

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('画布编码失败。')), type)
  })
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

type PreviewImage = Pick<
  HTMLImageElement,
  | 'addEventListener'
  | 'alt'
  | 'complete'
  | 'currentSrc'
  | 'decode'
  | 'naturalHeight'
  | 'naturalWidth'
  | 'removeEventListener'
  | 'src'
>

const PREVIEW_IMAGE_LOAD_TIMEOUT_MS = 15_000
const PREVIEW_VIDEO_LOAD_TIMEOUT_MS = 15_000

function previewImageLabel(image: PreviewImage) {
  return image.alt.trim() || image.currentSrc.trim() || image.src.trim() || '未命名图片'
}

function assertPreviewImageReady(image: PreviewImage) {
  if (image.naturalWidth > 0 && image.naturalHeight > 0) return
  throw new Error(`图片“${previewImageLabel(image)}”加载失败，请重新选择素材后再导出。`)
}

async function decodePreviewImage(image: PreviewImage) {
  if (typeof image.decode !== 'function') return
  await image.decode().catch(() => undefined)
}

export async function waitForPreviewImage(image: PreviewImage) {
  if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      let settled = false
      let timer: ReturnType<typeof globalThis.setTimeout> | undefined
      const cleanup = () => {
        image.removeEventListener('load', onLoad)
        image.removeEventListener('error', onError)
        if (timer !== undefined) globalThis.clearTimeout(timer)
      }
      const finish = (callback: () => void) => {
        if (settled) return
        settled = true
        cleanup()
        callback()
      }
      const onLoad = () => finish(resolve)
      const onError = () => finish(() => reject(
        new Error(`图片“${previewImageLabel(image)}”加载失败，请重新选择素材后再导出。`),
      ))

      image.addEventListener('load', onLoad, { once: true })
      image.addEventListener('error', onError, { once: true })
      timer = globalThis.setTimeout(() => finish(() => reject(
        new Error(`等待图片“${previewImageLabel(image)}”加载超时，请稍后重试。`),
      )), PREVIEW_IMAGE_LOAD_TIMEOUT_MS)

      // Avoid missing a load/error transition that completed between the
      // initial `complete` check and listener registration.
      if (image.complete) {
        queueMicrotask(image.naturalWidth > 0 && image.naturalHeight > 0 ? onLoad : onError)
      }
    })
    await decodePreviewImage(image)
  }
  assertPreviewImageReady(image)
}

export async function waitForPreviewImages(root: Pick<HTMLElement, 'querySelectorAll'>) {
  await Promise.all([...root.querySelectorAll<HTMLImageElement>('img')].map(waitForPreviewImage))
}

export function waitForPreviewVideo(video: HTMLVideoElement) {
  if (video.readyState >= 2) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined
    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('error', onError)
      if (timer !== undefined) globalThis.clearTimeout(timer)
    }
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const label = video.currentSrc || video.src || '未命名视频'
    const onLoadedData = () => finish(resolve)
    const onError = () => finish(() => reject(
      new Error(`视频“${label}”加载失败，请重新选择素材后再导出。`),
    ))

    video.addEventListener('loadeddata', onLoadedData, { once: true })
    video.addEventListener('error', onError, { once: true })
    timer = globalThis.setTimeout(() => finish(() => reject(
      new Error(`等待视频“${label}”加载超时，请稍后重试。`),
    )), PREVIEW_VIDEO_LOAD_TIMEOUT_MS)

    // Avoid missing a transition that completed between the initial check
    // and listener registration.
    if (video.readyState >= 2) queueMicrotask(onLoadedData)
  })
}
async function waitForPreviewAssets(root: HTMLElement) {
  await document.fonts?.ready
  await waitForPreviewImages(root)
  await Promise.all([...root.querySelectorAll('video')].map(waitForPreviewVideo))
  // Capture the settled composition rather than the first frame of Framer
  // Motion's reveal sequence. Infinite decorative CSS animations intentionally
  // keep running and must not hold up an export.
  const animations = root.getAnimations({ subtree: true })
    .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
  await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
  // Framer Motion can schedule its first animation one frame after the DOM
  // update, outside the initial getAnimations() snapshot above.
  await sleep(1_000)
}

type ObjectFit = 'contain' | 'cover'

export function objectFitRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: ObjectFit,
) {
  const scale = fit === 'contain'
    ? Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height }
}

type BackgroundMedia = HTMLImageElement | HTMLVideoElement

function isBackgroundMedia(element: Element | null): element is BackgroundMedia {
  return element instanceof HTMLImageElement || element instanceof HTMLVideoElement
}

function mediaDimensions(media: BackgroundMedia) {
  return media instanceof HTMLVideoElement
    ? { width: media.videoWidth, height: media.videoHeight }
    : { width: media.naturalWidth, height: media.naturalHeight }
}

async function captureForeground(root: HTMLElement, media: BackgroundMedia | null, width: number, height: number) {
  const rootBackground = root.style.background
  const mediaDisplay = media?.style.display
  const settledElements = [...root.querySelectorAll<HTMLElement>(
    '.vault-copy h1, .vault-copy p, .vault-cta, .vex-heading-line, .vex-heading-character, .vex-fade',
  )]
    .map((element) => ({
      element,
      cssText: element.style.cssText,
      children: [...element.querySelectorAll<HTMLElement>('span')]
        .map((child) => ({ child, cssText: child.style.cssText })),
    }))
  root.style.background = 'transparent'
  // html2canvas has a Chromium video paint-order bug: `visibility: hidden`
  // still lets the cloned video cover siblings. The media is absolute, so
  // removing it from layout is safe and guarantees a transparent foreground.
  if (media) media.style.display = 'none'
  for (const { element } of settledElements) {
    element.style.setProperty('opacity', '1', 'important')
    element.style.setProperty('transform', 'none', 'important')
    element.style.setProperty('transition', 'none', 'important')
    if (element.matches('.vault-cta')) {
      element.querySelectorAll<HTMLElement>('span').forEach((child) => {
        child.style.setProperty('position', 'relative', 'important')
        child.style.setProperty('z-index', '1', 'important')
      })
    }
  }

  try {
    return await html2canvas(root, {
      backgroundColor: null,
      useCORS: true,
      allowTaint: false,
      logging: false,
      scale: 1,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    })
  } finally {
    root.style.background = rootBackground
    if (media) media.style.display = mediaDisplay ?? ''
    for (const { element, cssText, children } of settledElements) {
      element.style.cssText = cssText
      for (const child of children) child.child.style.cssText = child.cssText
    }
  }
}

type FrameRenderer = {
  render(): HTMLCanvasElement
}

async function createFrameRenderer(root: HTMLElement, width: number, height: number): Promise<FrameRenderer> {
  await waitForPreviewAssets(root)
  const mediaElement = root.querySelector('.preset-bg-media')
  const media = isBackgroundMedia(mediaElement) ? mediaElement : null
  if (!media) {
    const snapshot = await html2canvas(root, {
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
    return { render: () => snapshot }
  }

  const foreground = await captureForeground(root, media, width, height)
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (!context) throw new Error('无法创建画布合成上下文。')
  const fit = getComputedStyle(media).objectFit === 'contain' ? 'contain' : 'cover'

  return {
    render() {
      context.clearRect(0, 0, width, height)
      context.fillStyle = '#000000'
      context.fillRect(0, 0, width, height)
      const dimensions = mediaDimensions(media)
      if (dimensions.width > 0 && dimensions.height > 0) {
        const rect = objectFitRect(dimensions.width, dimensions.height, width, height, fit)
        context.drawImage(media, rect.x, rect.y, rect.width, rect.height)
      }
      context.drawImage(foreground, 0, 0, width, height)
      return output
    },
  }
}

async function captureElement(root: HTMLElement, width: number, height: number) {
  const renderer = await createFrameRenderer(root, width, height)
  return renderer.render()
}

function getWebmMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? ''
}

async function capturePng(
  root: HTMLElement,
  request: WebComposerPreviewCaptureMessage,
  postToParent: WebComposerPostToParent,
) {
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

async function captureWebm(
  root: HTMLElement,
  request: WebComposerPreviewCaptureMessage,
  postToParent: WebComposerPostToParent,
) {
  const mimeType = getWebmMimeType()
  if (!mimeType) throw new Error('当前桌面 Chromium 不支持 WebM 画布录制。')

  const { width, height, fps, durationSeconds } = request.settings
  const renderer = await createFrameRenderer(root, width, height)
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const context = output.getContext('2d')
  if (!context) throw new Error('无法创建视频输出画布。')

  const stream = output.captureStream(fps)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: Math.min(24_000_000, Math.max(4_000_000, width * height * fps)),
  })
  const blob = await recordPreviewFrames({
    context,
    durationSeconds,
    fps,
    height,
    mimeType,
    recorder,
    renderer,
    stream,
    waitForNextFrame: sleep,
    width,
    onProgress(current, total) {
      postToParent({
        channel: WEB_COMPOSER_CHANNEL,
        type: 'capture-progress',
        requestId: request.requestId,
        current,
        total,
      })
    },
  })
  const buffer = await blob.arrayBuffer()
  postToParent({
    channel: WEB_COMPOSER_CHANNEL,
    type: 'capture-complete',
    requestId: request.requestId,
    kind: 'webm',
    buffer,
    mimeType,
  }, [buffer])
}

export function capturePreview(
  root: HTMLElement,
  request: WebComposerPreviewCaptureMessage,
  postToParent: WebComposerPostToParent,
) {
  return request.kind === 'png'
    ? capturePng(root, request, postToParent)
    : captureWebm(root, request, postToParent)
}
