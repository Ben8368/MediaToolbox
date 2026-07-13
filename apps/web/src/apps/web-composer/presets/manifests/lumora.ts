import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { lumoraVideos } from '../LumoraPreset'
import { systemFont } from '../shared'
import { collectSlots, mediaSlot, textSlot } from './helpers'

const slots = collectSlots([
  mediaSlot({ id: 'background', label: '背景素材', group: '画布', src: lumoraVideos[0].src }),
  textSlot({ id: 'brand.logo', label: 'Logo', group: '页头', value: 'Lumora', fontRole: 'heading', allowImage: true }),
  textSlot({ id: 'nav.how', label: '导航：How It Works', group: '页头', value: 'How It Works' }),
  textSlot({ id: 'nav.features', label: '导航：Features', group: '页头', value: 'Features' }),
  textSlot({ id: 'nav.pricing', label: '导航：Pricing', group: '页头', value: 'Pricing' }),
  textSlot({ id: 'nav.community', label: '导航：Community', group: '页头', value: 'Community' }),
  textSlot({ id: 'nav.cta', label: '页头按钮', group: '页头', value: 'Get Started' }),
  textSlot({ id: 'hero.badge', label: '徽章文案', group: '主视觉', value: 'Over 10,000 minds already finding their clarity' }),
  textSlot({ id: 'hero.heading.line1', label: '标题第一行', group: '主视觉', value: 'Clarity in an Endlessly', fontRole: 'heading' }),
  textSlot({ id: 'hero.heading.line2', label: '标题第二行', group: '主视觉', value: 'Noisy Universe', fontRole: 'heading' }),
  textSlot({
    id: 'hero.subtext',
    label: '副标题',
    group: '主视觉',
    value: 'Rise above the chaos of pings, infinite scrolling, and relentless demands. Discover how to protect your presence and create with intention.',
    multiline: true,
    maxLength: 360,
  }),
  textSlot({ id: 'hero.email-placeholder', label: '邮箱占位文案', group: '主视觉', value: 'Your Best Email', allowIcon: false, canHide: false }),
  textSlot({ id: 'hero.cta', label: '行动按钮', group: '主视觉', value: 'Get Early Access' }),
  textSlot({
    id: 'hero.stats',
    label: '底部数据',
    group: '主视觉',
    value: '60+ Deep Sessions | 12,000+ Creators | 4.8 User Satisfaction | Intentional-First Design',
    multiline: true,
  }),
  ...lumoraVideos.map((video, index) => textSlot({
    id: `switch.${index}`,
    label: `场景按钮 ${index + 1}`,
    group: '场景切换',
    value: video.label,
    allowIcon: false,
  })),
])

export const lumoraManifest: WebComposerPresetManifest = {
  id: 'lumora',
  version: WEB_COMPOSER_PRESET_CATALOG.lumora.currentVersion,
  upstreamSourceSha: '83c7482bd3014784b5f787bfc684688600fe0285',
  upstreamStyleSha: '418c93c524bbb1f85d0bc108ef0e3bc5d22d1175',
  name: 'Lumora',
  style: '正念产品 / 液态玻璃',
  description: '适合正念与专注产品的全屏电影感首屏。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'lumora',
    slots: slots.values,
    theme: {
      headingFont: "'Instrument Serif', serif",
      bodyFont: systemFont,
      accentColor: '#ffffff',
      textColor: '#ffffff',
    },
  },
}
