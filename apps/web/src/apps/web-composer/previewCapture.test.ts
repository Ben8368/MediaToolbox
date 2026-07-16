import { describe, expect, it, vi } from 'vitest'

import { objectFitRect, waitForPreviewImage, waitForPreviewImages } from './previewCapture'

type FakeImage = {
  addEventListener: ReturnType<typeof vi.fn>
  alt: string
  complete: boolean
  currentSrc: string
  decode: ReturnType<typeof vi.fn>
  naturalHeight: number
  naturalWidth: number
  removeEventListener: ReturnType<typeof vi.fn>
  src: string
}

function createFakeImage(overrides: Partial<FakeImage> = {}) {
  const listeners = new Map<string, () => void>()
  const image: FakeImage = {
    addEventListener: vi.fn((type: string, listener: () => void) => {
      listeners.set(type, listener)
    }),
    alt: 'Logo',
    complete: true,
    currentSrc: '/api/filebrowser/file?path=logo.png',
    decode: vi.fn(async () => undefined),
    naturalHeight: 64,
    naturalWidth: 128,
    removeEventListener: vi.fn((type: string) => {
      listeners.delete(type)
    }),
    src: '/api/filebrowser/file?path=logo.png',
    ...overrides,
  }
  return {
    image,
    emit(type: 'load' | 'error') {
      listeners.get(type)?.()
    },
  }
}

describe('objectFitRect', () => {
  it('covers the export canvas while preserving the source aspect ratio', () => {
    expect(objectFitRect(1920, 1080, 1080, 1080, 'cover')).toEqual({
      x: -420,
      y: 0,
      width: 1920,
      height: 1080,
    })
  })

  it('contains the source when that fit mode is requested', () => {
    expect(objectFitRect(1920, 1080, 1080, 1080, 'contain')).toEqual({
      x: 0,
      y: 236.25,
      width: 1080,
      height: 607.5,
    })
  })
})

describe('waitForPreviewImage', () => {
  it('accepts an already loaded image with natural dimensions', async () => {
    const { image } = createFakeImage()

    await expect(waitForPreviewImage(image as unknown as HTMLImageElement)).resolves.toBeUndefined()
    expect(image.decode).not.toHaveBeenCalled()
  })

  it('waits for load and decodes an image that is still loading', async () => {
    const { image, emit } = createFakeImage({
      complete: false,
      naturalHeight: 0,
      naturalWidth: 0,
    })
    const ready = waitForPreviewImage(image as unknown as HTMLImageElement)

    image.complete = true
    image.naturalWidth = 320
    image.naturalHeight = 180
    emit('load')

    await expect(ready).resolves.toBeUndefined()
    expect(image.decode).toHaveBeenCalledOnce()
    expect(image.removeEventListener).toHaveBeenCalledWith('load', expect.any(Function))
    expect(image.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('rejects an image load error with a readable message', async () => {
    const { image, emit } = createFakeImage({
      complete: false,
      naturalHeight: 0,
      naturalWidth: 0,
    })
    const ready = waitForPreviewImage(image as unknown as HTMLImageElement)

    emit('error')

    await expect(ready).rejects.toThrow('图片“Logo”加载失败，请重新选择素材后再导出。')
  })

  it('rejects a completed image without natural dimensions', async () => {
    const { image } = createFakeImage({
      currentSrc: '',
      naturalHeight: 0,
      naturalWidth: 0,
      src: '',
    })

    await expect(waitForPreviewImage(image as unknown as HTMLImageElement))
      .rejects.toThrow('图片“Logo”加载失败，请重新选择素材后再导出。')
  })

  it('checks every image under the capture root', async () => {
    const first = createFakeImage().image
    const second = createFakeImage({ alt: 'Hero', naturalHeight: 0, naturalWidth: 0 }).image
    const root = {
      querySelectorAll: vi.fn(() => [first, second]),
    }

    await expect(waitForPreviewImages(root as unknown as Pick<HTMLElement, 'querySelectorAll'>))
      .rejects.toThrow('图片“Hero”加载失败，请重新选择素材后再导出。')
    expect(root.querySelectorAll).toHaveBeenCalledWith('img')
  })
})
