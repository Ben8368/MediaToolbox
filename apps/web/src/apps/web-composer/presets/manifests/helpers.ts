import {
  WEB_COMPOSER_ICON_NAMES,
  type WebComposerFontWeight,
  type WebComposerIconName,
  type WebComposerSlotManifest,
  type WebComposerSlotValue,
} from '@mediatoolbox/contracts'

export type SlotBundle = {
  manifest: WebComposerSlotManifest
  value: WebComposerSlotValue
}

const fontSize = { min: 8, max: 320, step: 1 } as const
const iconSize = { min: 8, max: 320, step: 1 } as const
const dimension = { min: 8, max: 960, step: 1 } as const
const offset = {
  x: { min: -400, max: 400, step: 1 },
  y: { min: -400, max: 400, step: 1 },
} as const
const fontWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const satisfies readonly WebComposerFontWeight[]

export const replacementIcons = WEB_COMPOSER_ICON_NAMES.filter((name) => name !== 'vault-logo') as WebComposerIconName[]

type TextSlotOptions = {
  id: string
  label: string
  group: string
  value: string
  fontRole?: 'heading' | 'body'
  multiline?: boolean
  maxLength?: number
  allowIcon?: boolean
  allowImage?: boolean
  canHide?: boolean
}

export function textSlot({
  id,
  label,
  group,
  value,
  fontRole = 'body',
  multiline = false,
  maxLength,
  allowIcon = true,
  allowImage = false,
  canHide = true,
}: TextSlotOptions): SlotBundle {
  return {
    manifest: {
      id,
      label,
      group,
      canHide,
      fontRole,
      offset,
      editors: {
        text: { multiline, maxLength, fontFamily: true, fontSize, fontWeight: fontWeights, color: true },
        ...(allowIcon ? { icon: { iconIds: replacementIcons, size: iconSize, color: true } } : {}),
        ...(allowImage ? { image: { accept: 'image/*' as const, width: dimension, height: dimension, fit: ['contain', 'cover'] as const } } : {}),
      },
    },
    value: {
      activeKind: 'text',
      visible: true,
      offset: { x: 0, y: 0 },
      text: { value, fontFamily: null, fontSize: null, fontWeight: null, color: null },
      ...(allowIcon ? { icon: { iconId: 'sparkles' as const, size: null, color: null } } : {}),
      ...(allowImage ? { image: { src: '', alt: label, width: null, height: null, fit: 'contain' as const } } : {}),
    },
  }
}

type IconSlotOptions = {
  id: string
  label: string
  group: string
  iconId: WebComposerIconName
  allowImage?: boolean
  canHide?: boolean
}

export function iconSlot({ id, label, group, iconId, allowImage = false, canHide = true }: IconSlotOptions): SlotBundle {
  return {
    manifest: {
      id,
      label,
      group,
      canHide,
      offset,
      editors: {
        icon: { iconIds: WEB_COMPOSER_ICON_NAMES, size: iconSize, color: true },
        ...(allowImage ? { image: { accept: 'image/*' as const, width: dimension, height: dimension, fit: ['contain', 'cover'] as const } } : {}),
      },
    },
    value: {
      activeKind: 'icon',
      visible: true,
      offset: { x: 0, y: 0 },
      icon: { iconId, size: null, color: null },
      ...(allowImage ? { image: { src: '', alt: label, width: null, height: null, fit: 'contain' as const } } : {}),
    },
  }
}

export function mediaSlot({
  id,
  label,
  group,
  src,
  kind = 'video',
}: {
  id: string
  label: string
  group: string
  src: string
  kind?: 'video' | 'image'
}): SlotBundle {
  return {
    manifest: {
      id,
      label,
      group,
      canHide: true,
      offset,
      editors: {
        media: { accept: 'image/*,video/*', kinds: ['video', 'image'], fit: ['cover', 'contain'] },
      },
    },
    value: {
      activeKind: 'media',
      visible: true,
      offset: { x: 0, y: 0 },
      media: { kind, src, fit: 'cover' },
    },
  }
}

export function imageSlot({
  id,
  label,
  group,
  src,
  alt = label,
  fit = 'cover',
}: {
  id: string
  label: string
  group: string
  src: string
  alt?: string
  fit?: 'contain' | 'cover'
}): SlotBundle {
  return {
    manifest: {
      id,
      label,
      group,
      canHide: true,
      offset,
      editors: {
        image: { accept: 'image/*', width: dimension, height: dimension, fit: ['contain', 'cover'] },
      },
    },
    value: {
      activeKind: 'image',
      visible: true,
      offset: { x: 0, y: 0 },
      image: { src, alt, width: null, height: null, fit },
    },
  }
}

export function collectSlots(bundles: SlotBundle[]) {
  return {
    manifests: bundles.map((bundle) => bundle.manifest),
    values: Object.fromEntries(bundles.map((bundle) => [bundle.manifest.id, bundle.value])),
  }
}
