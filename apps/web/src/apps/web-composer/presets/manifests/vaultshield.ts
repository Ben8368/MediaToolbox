import { WEB_COMPOSER_PRESET_CATALOG, type WebComposerPresetManifest } from '@mediatoolbox/contracts'

import { collectSlots, iconSlot, mediaSlot, textSlot } from './helpers'

const slots = collectSlots([
  mediaSlot({
    id: 'background',
    label: '背景素材',
    group: '画布',
    src: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_003132_8b7edcb6-c64d-4a52-a9ca-879942e122ad.mp4',
  }),
  iconSlot({ id: 'brand.logo', label: 'Logo', group: '页头', iconId: 'vault-logo', allowImage: true }),
  ...['Vault', 'Plans', 'Install', 'News', 'Help'].map((value, index) => textSlot({
    id: `nav.${index}`,
    label: `导航：${value}`,
    group: '页头',
    value,
    allowIcon: false,
  })),
  textSlot({ id: 'nav.primary', label: '页头主按钮', group: '页头', value: 'Start For Free' }),
  textSlot({ id: 'nav.login', label: '页头登录按钮', group: '页头', value: 'Sign In' }),
  textSlot({ id: 'hero.heading.start', label: '标题开头', group: '主视觉', value: 'Lock Down Your', fontRole: 'heading' }),
  iconSlot({ id: 'hero.icon.zap', label: '标题闪电图标', group: '主视觉', iconId: 'zap' }),
  textSlot({ id: 'hero.heading.middle', label: '标题重点', group: '主视觉', value: 'Passwords', fontRole: 'heading' }),
  iconSlot({ id: 'hero.icon.lock', label: '标题锁图标', group: '主视觉', iconId: 'lock-keyhole' }),
  textSlot({ id: 'hero.heading.end', label: '标题结尾', group: '主视觉', value: 'with Ironclad Security', fontRole: 'heading' }),
  iconSlot({ id: 'hero.icon.fingerprint', label: '标题指纹图标', group: '主视觉', iconId: 'fingerprint' }),
  textSlot({
    id: 'hero.subtext',
    label: '副标题',
    group: '主视觉',
    value: 'Zero stress, total control. VaultShield keeps you covered with unbreakable storage, one-tap access, and pro-grade tools for your non-stop world.',
    multiline: true,
    maxLength: 360,
  }),
  textSlot({ id: 'hero.cta', label: '行动按钮', group: '主视觉', value: 'Get It Free' }),
  iconSlot({ id: 'hero.cta.icon', label: '按钮箭头图标', group: '主视觉', iconId: 'arrow-right-circle' }),
])

export const vaultShieldManifest: WebComposerPresetManifest = {
  id: 'vaultshield',
  version: WEB_COMPOSER_PRESET_CATALOG.vaultshield.currentVersion,
  upstreamSourceSha: '83c7482bd3014784b5f787bfc684688600fe0285',
  upstreamStyleSha: '418c93c524bbb1f85d0bc108ef0e3bc5d22d1175',
  name: 'VaultShield',
  style: '安全 SaaS / 编辑感应用首屏',
  description: '基于 seedance-25-hero 重建的全屏密码管理器首屏。',
  designSize: { width: 1920, height: 1080 },
  slots: slots.manifests,
  defaults: {
    schemaVersion: 2,
    id: 'vaultshield',
    slots: slots.values,
    theme: {
      headingFont: "'Helvetica Now Display Bold', 'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      accentColor: '#7342E2',
      textColor: '#192837',
    },
  },
}
