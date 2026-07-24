import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { systemFont } from '../shared'
import { collectSlots, iconSlot, mediaSlot, textSlot } from './helpers'

const slots = collectSlots([
  mediaSlot({
    id: 'background',
    label: '背景纹理',
    group: '画布',
    src: '/static/web-composer/trace-grid-background.svg',
    kind: 'image',
  }),
  iconSlot({ id: 'brand.mark', label: '品牌图标', group: '页头', iconId: 'fingerprint', allowImage: true }),
  textSlot({ id: 'brand.logo', label: '品牌名称', group: '页头', value: 'TRACE GRID', fontRole: 'heading', allowImage: true }),
  ...['Platform', 'Solutions', 'Resources', 'Pricing'].map((value, index) => textSlot({
    id: `nav.${index}`,
    label: `导航：${value}`,
    group: '页头',
    value,
    allowIcon: false,
  })),
  textSlot({ id: 'nav.cta', label: '页头按钮', group: '页头', value: 'Book a demo', allowIcon: false }),
  textSlot({ id: 'hero.eyebrow', label: '眉题', group: '主视觉', value: 'Autonomous threat intelligence', allowIcon: false }),
  textSlot({ id: 'hero.heading.line1', label: '标题第一行', group: '主视觉', value: 'Tracing', fontRole: 'heading', allowImage: true }),
  textSlot({ id: 'hero.heading.line2', label: '标题第二行', group: '主视觉', value: 'the unseen', fontRole: 'heading', allowImage: true }),
  textSlot({
    id: 'hero.subtext',
    label: '副标题',
    group: '主视觉',
    value: 'See hidden attack paths before they become incidents. Trace Grid maps every signal into one continuously learning security surface.',
    multiline: true,
    maxLength: 280,
    allowIcon: false,
  }),
  textSlot({ id: 'hero.cta', label: '行动按钮', group: '主视觉', value: 'Start secure scan', allowIcon: false }),
  textSlot({ id: 'metric.label', label: '指标名称', group: '实时指标', value: 'Threats neutralized', allowIcon: false }),
  textSlot({ id: 'metric.value', label: '指标数值', group: '实时指标', value: '187,941', fontRole: 'heading', allowIcon: false }),
  textSlot({ id: 'footer.status', label: '系统状态', group: '页脚', value: 'All systems protected', allowIcon: false }),
  textSlot({ id: 'footer.coordinate', label: '扫描坐标', group: '页脚', value: 'SCAN / 37.7749° N / 122.4194° W', allowIcon: false }),
])

export const traceGridManifest: WebComposerPresetManifest = {
  id: 'trace-grid',
  version: WEB_COMPOSER_PRESET_CATALOG['trace-grid'].currentVersion,
  upstreamSourceSha: 'motionsites-comment-cybersecurity-saas-20260723',
  upstreamStyleSha: 'original-reimplementation-20260723',
  name: 'Trace Grid',
  style: '网络安全 SaaS / 数据可视化',
  description: '深蓝扫描网格、实时威胁指标与动态数据带组成的科技感首屏。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'trace-grid',
    slots: slots.values,
    theme: {
      headingFont: "'Figtree', sans-serif",
      bodyFont: systemFont,
      accentColor: '#8C72FF',
      textColor: '#F4F8FF',
    },
  },
}
