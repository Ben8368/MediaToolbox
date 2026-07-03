import { buildFfmpegArgs } from '@mediatoolbox/ffmpeg'

export function describeTranscodeWorker() {
  return {
    name: 'transcode-worker',
    commandPreview: buildFfmpegArgs({
      inputPath: 'input.mov',
      outputPath: 'output.mp4',
      preset: 'mp4-h264-aac',
    }),
  }
}
