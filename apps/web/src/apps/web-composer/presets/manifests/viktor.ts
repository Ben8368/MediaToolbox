import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { viktorVideos } from '../ViktorPreset'
import { collectSlots, mediaSlot, textSlot } from './helpers'

const slots = collectSlots([
  mediaSlot({ id: 'background', label: '背景素材', group: '画布', src: viktorVideos[0].src }),
  ...['Works', 'Services', 'About', 'Contact'].map((value, index) => textSlot({
    id: `nav.${index}`,
    label: `导航：${value}`,
    group: '页头',
    value,
    allowIcon: false,
  })),
  textSlot({ id: 'contact.email', label: '联系邮箱', group: '页头', value: 'Davies@gmail.com', allowIcon: false }),
  ...viktorVideos.map((video, index) => textSlot({
    id: `switch.${index}`,
    label: `作品按钮 ${index + 1}`,
    group: '作品切换',
    value: video.label,
    allowIcon: false,
  })),
  textSlot({ id: 'hero.status', label: '状态', group: '主视觉', value: 'Available for work' }),
  textSlot({ id: 'hero.name', label: '姓名', group: '主视觉', value: 'Viktor', fontRole: 'heading', allowImage: true }),
  textSlot({
    id: 'hero.subtext',
    label: '简介',
    group: '主视觉',
    value: 'I craft bold brands and modern websites with purpose, bringing sharp strategy and polished digital experiences to ambitious teams.',
    multiline: true,
    maxLength: 360,
  }),
  textSlot({ id: 'hero.cta', label: '行动按钮', group: '主视觉', value: 'start a project' }),
])

export const viktorManifest: WebComposerPresetManifest = {
  id: 'viktor',
  version: WEB_COMPOSER_PRESET_CATALOG.viktor.currentVersion,
  upstreamSourceSha: '83c7482bd3014784b5f787bfc684688600fe0285',
  upstreamStyleSha: '418c93c524bbb1f85d0bc108ef0e3bc5d22d1175',
  name: 'Viktor',
  style: '创意作品集 / 动态视频',
  description: '带视频切换和实时钟表的全屏创意作品集首屏。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'viktor',
    slots: slots.values,
    theme: {
      headingFont: "'Figtree', sans-serif",
      bodyFont: "'Figtree', sans-serif",
      accentColor: '#F598F2',
      textColor: '#ffffff',
    },
  },
}
