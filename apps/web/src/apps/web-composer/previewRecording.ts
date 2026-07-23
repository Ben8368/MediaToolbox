type PreviewFrameRenderer = {
  render: () => HTMLCanvasElement
}

type RecordPreviewFramesOptions = {
  context: CanvasRenderingContext2D
  durationSeconds: number
  fps: number
  height: number
  mimeType: string
  onProgress: (current: number, total: number) => void
  recorder: MediaRecorder
  renderer: PreviewFrameRenderer
  stream: MediaStream
  waitForNextFrame: (ms: number) => Promise<void>
  width: number
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // Best-effort cleanup must not hide the capture error.
    }
  }
}

export async function recordPreviewFrames({
  context,
  durationSeconds,
  fps,
  height,
  mimeType,
  onProgress,
  recorder,
  renderer,
  stream,
  waitForNextFrame,
  width,
}: RecordPreviewFramesOptions) {
  const chunks: Blob[] = []
  let recordingError: Error | null = null
  let resolveFinished: () => void = () => undefined
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  const throwIfRecordingFailed = () => {
    if (recordingError) throw recordingError
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.onstop = resolveFinished
  recorder.onerror = () => {
    recordingError = new Error('浏览器帧录制失败。')
    resolveFinished()
  }

  try {
    recorder.start(1000)
    const frameCount = Math.max(1, Math.round(durationSeconds * fps))
    for (let frame = 0; frame < frameCount; frame += 1) {
      throwIfRecordingFailed()
      const snapshot = renderer.render()
      context.clearRect(0, 0, width, height)
      context.drawImage(snapshot, 0, 0, width, height)
      onProgress(frame + 1, frameCount)
      await waitForNextFrame(1000 / fps)
    }

    throwIfRecordingFailed()
    recorder.stop()
    await finished
    throwIfRecordingFailed()
    return new Blob(chunks, { type: mimeType })
  } finally {
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        // The recorder may have become inactive between the state check and stop.
      }
    }
    stopTracks(stream)
    recorder.ondataavailable = null
    recorder.onerror = null
    recorder.onstop = null
  }
}
