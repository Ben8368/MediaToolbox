import { describe, expect, it } from 'vitest'

import {
  buildYtdlpArgs,
  getYtdlpCandidates,
  normalizeYtdlpError,
  parseYtdlpProgressLine,
  resolveYtdlpTool,
  YtdlpToolNotFoundError,
} from './index.js'

describe('buildYtdlpArgs', () => {
  it('builds video download args with newline progress enabled', () => {
    expect(buildYtdlpArgs({
      url: 'https://example.com/video',
      mode: 'video',
      outputTemplate: '%(title)s.%(ext)s',
    })).toEqual([
      '--newline',
      '--no-playlist',
      '--output',
      '%(title)s.%(ext)s',
      'https://example.com/video',
    ])
  })

  it('adds audio extraction and subtitle options when requested', () => {
    expect(buildYtdlpArgs({
      url: 'https://example.com/video',
      mode: 'audio',
      outputTemplate: '%(title)s.%(ext)s',
      subtitles: { languages: ['en', 'zh-Hans'], auto: true },
    })).toEqual([
      '--newline',
      '--no-playlist',
      '--output',
      '%(title)s.%(ext)s',
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      'en,zh-Hans',
      'https://example.com/video',
    ])
  })

  it('maps H264, subtitle format, and browser-cookie options safely', () => {
    expect(buildYtdlpArgs({
      url: 'https://example.com/video',
      mode: 'video',
      outputTemplate: '%(title)s.%(ext)s',
      video: { preferH264: true, recodeH264: true },
      subtitles: { languages: ['zh-Hans'], auto: true, format: 'srt' },
      cookiesFromBrowser: 'chrome',
    })).toEqual(expect.arrayContaining([
      '--format', 'bestvideo[vcodec^=avc1]+bestaudio/best[vcodec^=avc1]/best',
      '--recode-video', 'mp4',
      '--convert-subs', 'srt',
      '--cookies-from-browser', 'chrome',
    ]))
  })
})

describe('parseYtdlpProgressLine', () => {
  it('parses standard progress output', () => {
    expect(parseYtdlpProgressLine('[download]  42.7% of 128.00MiB at 4.20MiB/s ETA 00:12')).toEqual({
      type: 'progress',
      percent: 42.7,
      totalText: '128.00MiB',
      speedText: '4.20MiB/s',
      etaText: '00:12',
      raw: '[download]  42.7% of 128.00MiB at 4.20MiB/s ETA 00:12',
    })
  })

  it('parses destination and error lines', () => {
    expect(parseYtdlpProgressLine('[download] Destination: C:/Downloads/video.mp4')).toEqual({
      type: 'stage',
      stage: 'destination',
      message: 'C:/Downloads/video.mp4',
      raw: '[download] Destination: C:/Downloads/video.mp4',
    })
    expect(parseYtdlpProgressLine('ERROR: Unsupported URL: https://example.com/nope')).toEqual({
      type: 'error',
      message: 'Unsupported URL: https://example.com/nope',
      raw: 'ERROR: Unsupported URL: https://example.com/nope',
    })
  })
})

describe('resolveYtdlpTool', () => {
  it('tries custom, managed, and PATH candidates in order', () => {
    expect(getYtdlpCandidates({
      customPath: 'C:/tools/yt-dlp.exe',
      managedPath: 'C:/MediaToolbox/bin/yt-dlp.exe',
    })).toEqual([
      { source: 'custom', command: 'C:/tools/yt-dlp.exe' },
      { source: 'managed', command: 'C:/MediaToolbox/bin/yt-dlp.exe' },
      { source: 'path', command: 'yt-dlp' },
    ])
  })

  it('returns the first candidate that probes successfully', async () => {
    const attempts: string[] = []
    const tool = await resolveYtdlpTool({
      customPath: 'missing-custom',
      managedPath: 'managed-yt-dlp',
      probe: async (command) => {
        attempts.push(command)
        return command === 'managed-yt-dlp' ? { ok: true, version: '2026.01.01' } : { ok: false }
      },
    })

    expect(attempts).toEqual(['missing-custom', 'managed-yt-dlp'])
    expect(tool).toEqual({ source: 'managed', command: 'managed-yt-dlp', version: '2026.01.01' })
  })

  it('throws a typed error when no candidate is available', async () => {
    await expect(resolveYtdlpTool({
      commandName: 'missing-path',
      probe: async () => ({ ok: false }),
    })).rejects.toBeInstanceOf(YtdlpToolNotFoundError)
  })
})

describe('normalizeYtdlpError', () => {
  it('classifies unsupported URLs as non-retryable', () => {
    expect(normalizeYtdlpError('ERROR: Unsupported URL: https://example.com')).toMatchObject({
      code: 'unsupported-url',
      retryable: false,
    })
  })

  it('classifies network failures as retryable', () => {
    expect(normalizeYtdlpError('ERROR: The read operation timed out')).toMatchObject({
      code: 'network',
      retryable: true,
    })
  })
})
