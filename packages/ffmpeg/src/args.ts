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
  targetBitrateKbps?: number
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

export function buildTwoPassFfmpegArgs(request: TranscodeRequest, pass: 1 | 2, passLogFile: string): string[] {
  const encPreset = request.videoEncodePreset ?? 'slow'
  const bitrate = request.targetBitrateKbps ?? 8000
  const audioBitrate = request.audioBitrate ?? 192
  const codec = request.preset === 'mp4-h264-aac' ? 'libx264' : 'libx265'

  if (pass === 1) {
    return [
      '-i', request.inputPath,
      '-map', '0:v:0',
      '-c:v', codec, '-b:v', `${bitrate}k`, '-preset', encPreset,
      '-pass', '1', '-passlogfile', passLogFile,
      // NUL is the Windows null device; this project only targets Windows.
      '-an', '-f', 'null', 'NUL',
    ]
  }

  const mapArgs = request.preset === 'mkv-h265-aac'
    ? ['-map', '0:v:0', '-map', '0:a?', '-map', '0:s?']
    : ['-map', '0:v:0', '-map', '0:a?']

  return [
    '-i', request.inputPath,
    ...mapArgs,
    '-c:v', codec, '-b:v', `${bitrate}k`, '-preset', encPreset,
    '-pass', '2', '-passlogfile', passLogFile,
    '-c:a', 'aac', '-b:a', `${audioBitrate}k`,
    request.outputPath,
  ]
}
