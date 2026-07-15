import html2canvas from 'html2canvas'

import {
  WEB_COMPOSER_CHANNEL,
  type WebComposerPreviewCaptureMessage,
  type WebComposerPreviewOutboundMessage,
} from './previewMessages'

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
  const settledElements = [...root.querySelectorAll<HTMLElement>('.vault-copy h1, .vault-copy p, .vault-cta')]
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
    const snapshot = renderer.render()
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

export function capturePreview(
  root: HTMLElement,
  request: WebComposerPreviewCaptureMessage,
  postToParent: WebComposerPostToParent,
) {
  return request.kind === 'png'
    ? capturePng(root, request, postToParent)
    : captureWebm(root, request, postToParent)
}
