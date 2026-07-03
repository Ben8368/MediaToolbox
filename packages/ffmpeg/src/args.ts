export type TranscodePreset = 'mp4-h264-aac' | 'audio-mp3' | 'copy'

export type TranscodeRequest = {
  inputPath: string
  outputPath: string
  preset: TranscodePreset
}

export function buildFfprobeArgs(inputPath: string): string[] {
  return ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', inputPath]
}

export function buildFfmpegArgs(request: TranscodeRequest): string[] {
  if (request.preset === 'copy') {
    return ['-i', request.inputPath, '-map', '0', '-c', 'copy', request.outputPath]
  }

  if (request.preset === 'audio-mp3') {
    return ['-i', request.inputPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', request.outputPath]
  }

  return ['-i', request.inputPath, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-c:a', 'aac', request.outputPath]
}
