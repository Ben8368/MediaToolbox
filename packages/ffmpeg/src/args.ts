export type TranscodePreset =
  | 'mp4-h264-aac'
  | 'mp4-h265-aac'
  | 'mkv-h265-aac'
  | 'audio-aac'
  | 'audio-mp3'
  | 'copy'
  | 'remux'

export type VideoEncodePreset = 'fast' | 'slow' | 'veryslow'

export type TranscodeRequest = {
  inputPath: string
  outputPath: string
  preset: TranscodePreset
  videoCrf?: number
  videoEncodePreset?: VideoEncodePreset
  audioBitrate?: number
}

export function buildFfprobeArgs(inputPath: string): string[] {
  return ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', inputPath]
}

export function buildFfmpegArgs(request: TranscodeRequest): string[] {
  const crf = request.videoCrf ?? 20
  const encPreset = request.videoEncodePreset ?? 'slow'
  const audioBitrate = request.audioBitrate ?? 192

  switch (request.preset) {
    case 'copy':
      return ['-i', request.inputPath, '-map', '0', '-c', 'copy', request.outputPath]

    case 'remux':
      return [
        '-i', request.inputPath,
        '-map', '0:v', '-map', '0:a?',
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', `${audioBitrate}k`,
        request.outputPath,
      ]

    case 'audio-mp3':
      return ['-i', request.inputPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', request.outputPath]

    case 'audio-aac':
      return [
        '-i', request.inputPath,
        '-vn',
        '-c:a', 'aac', '-b:a', `${audioBitrate}k`,
        request.outputPath,
      ]

    case 'mkv-h265-aac':
      return [
        '-i', request.inputPath,
        '-map', '0:v:0', '-map', '0:a?', '-map', '0:s?',
        '-c:v', 'libx265', '-crf', String(crf), '-preset', encPreset,
        '-c:a', 'aac', '-b:a', `${audioBitrate}k`,
        request.outputPath,
      ]

    case 'mp4-h265-aac':
      return [
        '-i', request.inputPath,
        '-map', '0:v:0', '-map', '0:a?',
        '-c:v', 'libx265', '-crf', String(crf), '-preset', encPreset,
        '-c:a', 'aac', '-b:a', `${audioBitrate}k`,
        request.outputPath,
      ]

    case 'mp4-h264-aac':
    default:
      return [
        '-i', request.inputPath,
        '-map', '0:v:0', '-map', '0:a?',
        '-c:v', 'libx264', '-crf', String(crf), '-preset', encPreset,
        '-c:a', 'aac', '-b:a', `${audioBitrate}k`,
        request.outputPath,
      ]
  }
}
