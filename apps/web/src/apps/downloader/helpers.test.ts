import { describe, expect, it } from 'vitest'

import {
  buildRetryPayload,
  getTaskDownloadFilePath,
  isTaskRetryable,
} from '@/apps/downloader/helpers'
import type { DownloadTask } from '@/apps/downloader/types'

function task(overrides: Partial<DownloadTask>): DownloadTask {
  return {
    id: 'task-1',
    type: 'download',
    name: 'https://example.com/video',
    status: 'failed',
    progress: 0,
    stage: 'failed',
    created_at: 1,
    ...overrides,
  }
}

describe('buildRetryPayload', () => {
  it('normalizes url into urls for retry submissions', () => {
    const payload = buildRetryPayload(task({ params: { url: ' https://example.com/a ' } }))

    expect(payload).toEqual({ url: ' https://example.com/a ', urls: ['https://example.com/a'] })
  })

  it('filters invalid urls values and preserves other params', () => {
    const payload = buildRetryPayload(task({
      params: {
        output_dir: 'downloads',
        urls: ['https://example.com/a', '', 42, ' https://example.com/b '],
      },
    }))

    expect(payload).toEqual({
      output_dir: 'downloads',
      urls: ['https://example.com/a', 'https://example.com/b'],
    })
  })

  it('returns null when a task has no retryable source URL', () => {
    expect(buildRetryPayload(task({ name: '', params: {}, source_url: '3 URLs' }))).toBeNull()
  })
})

describe('task file helpers', () => {
  it('prefers output_files over nested result paths', () => {
    const value = getTaskDownloadFilePath(task({
      output_files: [' C:/downloads/final.mp4 '],
      result: {
        items: [{ info: { local_path: 'C:/downloads/fallback.mp4' } }],
      },
    }))

    expect(value).toBe('C:/downloads/final.mp4')
  })

  it('falls back to local media and subtitle paths from result info', () => {
    expect(getTaskDownloadFilePath(task({
      result: { items: [{ info: { local_path: 'C:/downloads/video.mp4' } }] },
    }))).toBe('C:/downloads/video.mp4')

    expect(getTaskDownloadFilePath(task({
      result: { items: [{ info: { subtitle_path: 'C:/downloads/subtitle.srt' } }] },
    }))).toBe('C:/downloads/subtitle.srt')
  })
})

describe('isTaskRetryable', () => {
  it('requires a terminal status and a retryable URL', () => {
    expect(isTaskRetryable(task({ status: 'failed', params: { urls: ['https://example.com/a'] } }))).toBe(true)
    expect(isTaskRetryable(task({ status: 'running', params: { urls: ['https://example.com/a'] } }))).toBe(false)
    expect(isTaskRetryable(task({ status: 'failed', params: {} }))).toBe(false)
  })
})
