import { describe, expect, it } from 'vitest'

import { buildWebComposerFfmpegArgs } from './index.js'

describe('buildWebComposerFfmpegArgs', () => {
  it('builds a deterministic H.264 MP4 command without shell interpolation', () => {
    expect(buildWebComposerFfmpegArgs({
      inputWebmPath: 'capture.webm',
      outputPath: 'output.mp4',
      fps: 24,
      videoFormat: 'mp4',
    })).toEqual([
      '-hide_banner', '-i', 'capture.webm', '-an', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '24', 'output.mp4',
    ])
  })

  it('uses ProRes 4444 with an alpha pixel format for transparent MOV output', () => {
    expect(buildWebComposerFfmpegArgs({
      inputWebmPath: 'capture.webm',
      outputPath: 'output.mov',
      fps: 24,
      videoFormat: 'mov-alpha',
    })).toEqual([
      '-hide_banner', '-i', 'capture.webm', '-an', '-c:v', 'prores_ks', '-profile:v', '4',
      '-alpha_bits', '8', '-pix_fmt', 'yuva444p10le', '-r', '24', 'output.mov',
    ])
  })
})
