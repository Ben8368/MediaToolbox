import type { PresetState } from './types'

export const systemFont = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export function getMediaProps(url: string) {
  return url.startsWith('blob:') ? {} : { crossOrigin: 'anonymous' as const }
}

export function MediaBackground({ state }: { state: PresetState }) {
  if (state.backgroundKind === 'image') {
    return (
      <img
        className="preset-bg-media"
        src={state.backgroundUrl}
        alt=""
        aria-hidden="true"
        {...getMediaProps(state.backgroundUrl)}
      />
    )
  }

  return (
    <video
      className="preset-bg-media"
      src={state.backgroundUrl}
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
      {...getMediaProps(state.backgroundUrl)}
    />
  )
}
