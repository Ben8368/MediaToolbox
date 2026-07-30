import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { collectSlots, iconSlot, mediaSlot, textSlot } from './helpers'

export const wandorVideoSource = 'https://pollen-batch-41236914.figma.site/_components/v2/f0ee2dae7671c170c34f12e31c4cb41418976c98/769c564298c132f7919405cd9f17c1b1231f341d.769c5642.mp4'

const slots = collectSlots([
  mediaSlot({ id: 'background', label: '背景视频', group: '画布', src: wandorVideoSource }),
  textSlot({ id: 'brand.logo', label: '品牌名称', group: '导航', value: 'wandor', fontRole: 'heading', allowIcon: false }),
  textSlot({ id: 'nav.discover', label: '导航：Discover', group: '导航', value: 'Discover', allowIcon: false }),
  textSlot({ id: 'nav.pricing', label: '导航：Pricing', group: '导航', value: 'Pricing', allowIcon: false }),
  textSlot({ id: 'nav.faqs', label: '导航：FAQs', group: '导航', value: 'FAQs', allowIcon: false }),
  textSlot({ id: 'nav.login', label: '登录按钮', group: '导航', value: 'Login', allowIcon: false }),
  textSlot({ id: 'nav.cta', label: '导航行动按钮', group: '导航', value: 'Plan My Trip', allowIcon: false }),
  textSlot({ id: 'hero.heading', label: '主标题', group: '主视觉', value: 'Where will you go next?', fontRole: 'heading', allowImage: true }),
  textSlot({
    id: 'hero.subtext',
    label: '副标题',
    group: '主视觉',
    value: "Tell our AI where you're going and what you love. We'll create a personalized itinerary for you.",
    multiline: true,
    maxLength: 220,
    allowIcon: false,
  }),
  textSlot({
    id: 'prompt.text',
    label: '行程提示词',
    group: '液态玻璃提示卡',
    value: "I'm planning a 7-day trip to Japan in October. I love food, hidden cafes, scenic hikes, and want to avoid crowds....",
    multiline: true,
    maxLength: 360,
    allowIcon: false,
  }),
  textSlot({ id: 'prompt.cta', label: '提示卡行动按钮', group: '液态玻璃提示卡', value: 'Plan My Trip', allowIcon: false }),
  iconSlot({ id: 'prompt.upload', label: '上传灵感', group: '液态玻璃提示卡', iconId: 'upload' }),
])

export const wandorManifest: WebComposerPresetManifest = {
  id: 'wandor',
  version: WEB_COMPOSER_PRESET_CATALOG.wandor.currentVersion,
  upstreamSourceSha: 'user-provided-figma-video-20260730',
  upstreamStyleSha: 'user-provided-wandor-prompt-20260730',
  name: 'Wandor',
  style: '旅行 AI / 液态玻璃视频首屏',
  description: '环境视频、白色渐变与液态玻璃行程提示卡组成的旅行 AI 落地页。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'wandor',
    slots: slots.values,
    theme: {
      headingFont: "'Geist', sans-serif",
      bodyFont: "'Geist', sans-serif",
      accentColor: '#905831',
      textColor: '#1A1A1A',
    },
  },
}
