import { describe, expect, it } from 'vitest'

import { buildWebComposerFfmpegArgs } from './index.js'

describe('buildWebComposerFfmpegArgs', () => {
  it('builds a deterministic H.264 MP4 command without shell interpolation', () => {
    expect(buildWebComposerFfmpegArgs({
      inputWebmPath: 'capture.webm',
      outputMp4Path: 'output.mp4',
      fps: 24,
    })).toEqual([
      '-hide_banner', '-i', 'capture.webm', '-an', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '24', 'output.mp4',
    ])
  })
})
