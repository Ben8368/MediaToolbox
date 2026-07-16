import { describe, expect, it } from 'vitest'

import { buildTwoPassFfmpegArgs } from './args.js'

const request = {
  inputPath: 'input.mov',
  outputPath: 'output.mp4',
  preset: 'mp4-h264-aac' as const,
  targetBitrateKbps: 6000,
}

describe('buildTwoPassFfmpegArgs', () => {
  it('uses the platform null device for the analysis pass', () => {
    const args = buildTwoPassFfmpegArgs(request, 1, 'pass-log')
    expect(args.at(-1)).toBe(process.platform === 'win32' ? 'NUL' : '/dev/null')
  })

  it('allows deterministic null-device overrides in cross-platform tests', () => {
    expect(buildTwoPassFfmpegArgs(request, 1, 'pass-log', { nullDevice: '/dev/null' }).at(-1)).toBe('/dev/null')
    expect(buildTwoPassFfmpegArgs(request, 1, 'pass-log', { nullDevice: 'NUL' }).at(-1)).toBe('NUL')
  })

  it('keeps the requested output path for the encoding pass', () => {
    expect(buildTwoPassFfmpegArgs(request, 2, 'pass-log').at(-1)).toBe('output.mp4')
  })
})
