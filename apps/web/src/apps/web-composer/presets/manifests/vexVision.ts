import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { collectSlots, mediaSlot, textSlot } from './helpers'

const slots = collectSlots([
  mediaSlot({
    id: 'background',
    label: '背景视频',
    group: '画布',
    src: '/static/web-composer/videos/vex-vision-hero.mp4',
  }),
  textSlot({ id: 'brand.logo', label: '品牌名称', group: '页头', value: 'VEX', fontRole: 'heading', allowImage: true }),
  ...['Story', 'Investing', 'Building', 'Advisory'].map((value, index) => textSlot({
    id: `nav.${index}`,
    label: `导航：${value}`,
    group: '页头',
    value,
    allowIcon: false,
  })),
  textSlot({ id: 'nav.cta', label: '页头按钮', group: '页头', value: 'Start a Chat', allowIcon: false }),
  textSlot({ id: 'hero.heading.line1', label: '标题第一行', group: '主视觉', value: 'Shaping tomorrow', fontRole: 'heading', allowImage: true }),
  textSlot({ id: 'hero.heading.line2', label: '标题第二行', group: '主视觉', value: 'with vision and action.', fontRole: 'heading', allowImage: true }),
  textSlot({
    id: 'hero.subtext',
    label: '副标题',
    group: '主视觉',
    value: 'We back visionaries and craft ventures that define what comes next.',
    multiline: true,
    maxLength: 220,
    allowIcon: false,
  }),
  textSlot({ id: 'hero.primary', label: '主按钮', group: '主视觉', value: 'Start a Chat', allowIcon: false }),
  textSlot({ id: 'hero.secondary', label: '次按钮', group: '主视觉', value: 'Explore Now', allowIcon: false }),
  textSlot({ id: 'hero.tag', label: '业务标签', group: '主视觉', value: 'Investing. Building. Advisory.', fontRole: 'heading', allowIcon: false }),
])

export const vexVisionManifest: WebComposerPresetManifest = {
  id: 'vex-vision',
  version: WEB_COMPOSER_PRESET_CATALOG['vex-vision'].currentVersion,
  upstreamSourceSha: '5b417706d4b6bcddd8e437a8ede18d20164bd8aee9587538cf8ace4a5431afcf',
  upstreamStyleSha: 'prompt-spec-20260723',
  name: 'VEX Vision',
  style: '投资品牌 / 全屏视频玻璃质感',
  description: '原始全屏视频、液态玻璃导航与底部双栏叙事组成的投资品牌首屏。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'vex-vision',
    slots: slots.values,
    theme: {
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      accentColor: '#FFFFFF',
      textColor: '#FFFFFF',
    },
  },
}