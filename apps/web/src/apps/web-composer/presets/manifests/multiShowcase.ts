import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { systemFont } from '../shared'
import { collectSlots, imageSlot, mediaSlot, textSlot } from './helpers'

const asset = (name: string) => `/static/web-composer/multi-showcase/${name}`

const cards = [
  { id: 'camera-motion', label: 'Camera Motion', image: 'card-camera-motion.png' },
  { id: 'vfx', label: 'VFX', image: 'card-vfx.png' },
  { id: 'shot-scales', label: 'Shot Scales', image: 'card-shot-scales.png' },
]

const slots = collectSlots([
  mediaSlot({
    id: 'background',
    label: '页面背景',
    group: '画布',
    kind: 'image',
    src: asset('multi-showcase-gradient-background.png'),
  }),
  imageSlot({
    id: 'brand.mark',
    label: '品牌图标',
    group: '品牌',
    src: asset('byteplus-logo-blue-black.png'),
    alt: 'BytePlus logo',
    fit: 'contain',
  }),
  textSlot({ id: 'hero.product', label: '产品名称', group: '主视觉', value: 'Dreamina Seedance 2.0', fontRole: 'heading', allowIcon: false }),
  textSlot({
    id: 'hero.heading',
    label: '主标题',
    group: '主视觉',
    value: 'Action, Composition and Pro Camera\nEffects\nAt Your Command',
    fontRole: 'heading',
    multiline: true,
    maxLength: 180,
    allowIcon: false,
  }),
  ...cards.flatMap((card) => [
    imageSlot({ id: `card.${card.id}.image`, label: `卡片图片：${card.label}`, group: '能力卡片', src: asset(card.image), alt: card.label }),
    textSlot({ id: `card.${card.id}.label`, label: `卡片文案：${card.label}`, group: '能力卡片', value: card.label, allowIcon: false }),
  ]),
  textSlot({ id: 'hero.cta', label: '行动按钮', group: '主视觉', value: 'Learn more', allowIcon: false }),
  imageSlot({ id: 'hero.image', label: '主视觉图片', group: '主视觉', src: asset('hero-image.png'), alt: 'Dreamina hero image' }),
])

export const multiShowcaseManifest: WebComposerPresetManifest = {
  id: 'multi-showcase',
  version: WEB_COMPOSER_PRESET_CATALOG['multi-showcase'].currentVersion,
  upstreamSourceSha: 'user-provided-reference-20260720',
  upstreamStyleSha: 'user-provided-gradient-background-20260720',
  name: '多展示',
  style: 'AI 视频生成 / 产品能力展示',
  description: '基于 Dreamina Seedance 参考稿重建的明亮双栏产品首屏，支持替换背景、主视觉和能力卡片图片。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'multi-showcase',
    slots: slots.values,
    theme: {
      headingFont: systemFont,
      bodyFont: systemFont,
      accentColor: '#8247ff',
      textColor: '#06070a',
    },
  },
}
