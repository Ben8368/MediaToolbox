import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { collectSlots, mediaSlot, textSlot } from './helpers'

const slots = collectSlots([
  mediaSlot({
    id: 'background',
    label: '背景视频',
    group: '画布',
    src: '/static/web-composer/videos/foundation-hero.mp4',
  }),
  textSlot({ id: 'brand.logo', label: '品牌星标', group: '悬浮导航', value: '✦', fontRole: 'heading', allowIcon: false }),
  textSlot({ id: 'nav.products', label: '导航：Products', group: '悬浮导航', value: 'Products', allowIcon: false }),
  textSlot({ id: 'nav.docs', label: '导航：Docs', group: '悬浮导航', value: 'Docs', allowIcon: false }),
  textSlot({ id: 'nav.cta', label: '导航按钮', group: '悬浮导航', value: 'Get in touch', allowIcon: false }),
  textSlot({ id: 'hero.heading.line1', label: '标题第一行', group: '主视觉', value: 'Foundation of the', fontRole: 'heading', allowImage: true }),
  textSlot({ id: 'hero.heading.line2', label: '标题第二行', group: '主视觉', value: 'new digital epoch', fontRole: 'heading', allowImage: true }),
  textSlot({
    id: 'hero.subtext',
    label: '副标题',
    group: '主视觉',
    value: 'Designing products, powering ecosystems and laying the foundation of a decentralized web for enterprises, builders and communities alike.',
    multiline: true,
    maxLength: 260,
    allowIcon: false,
  }),
  textSlot({ id: 'hero.cta', label: '行动按钮', group: '主视觉', value: 'Contact Us', allowIcon: false }),
])

export const foundationManifest: WebComposerPresetManifest = {
  id: 'foundation',
  version: WEB_COMPOSER_PRESET_CATALOG.foundation.currentVersion,
  upstreamSourceSha: 'user-provided-cloudfront-video-20260723',
  upstreamStyleSha: 'user-provided-foundation-prompt-20260723',
  name: 'Foundation',
  style: '去中心化 Web / 极简视频品牌',
  description: '白色圆角视频首屏、悬浮胶囊导航与纯 CSS 连续 Logo 跑马灯组成的现代品牌落地页。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'foundation',
    slots: slots.values,
    theme: {
      headingFont: "'Outfit', 'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      accentColor: '#0A152D',
      textColor: '#0A1B33',
    },
  },
}
