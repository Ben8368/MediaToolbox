import type { AssetKind } from '@mediatoolbox/contracts'

export function inferAssetKindFromExtension(extension: string): AssetKind {
  const normalized = extension.toLowerCase().replace(/^\./, '')

  if (['mp4', 'mov', 'mkv', 'webm'].includes(normalized)) return 'video'
  if (['mp3', 'wav', 'flac', 'm4a'].includes(normalized)) return 'audio'
  if (['srt', 'vtt', 'ass'].includes(normalized)) return 'subtitle'
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff'].includes(normalized)) return 'image'
  if (normalized === 'psd' || normalized === 'psb') return 'psd'

  return 'other'
}
