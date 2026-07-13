import { LumoraPreset, lumoraVideos } from './LumoraPreset'
import { systemFont } from './shared'
import type { PresetDefinition, PresetState } from './types'
import { VaultShieldPreset } from './VaultShieldPreset'
import { ViktorPreset, viktorVideos } from './ViktorPreset'

export const presets: PresetDefinition[] = [
  {
    id: "lumora",
    version: 1,
    upstreamSourceSha: "83c7482bd3014784b5f787bfc684688600fe0285",
    upstreamStyleSha: "418c93c524bbb1f85d0bc108ef0e3bc5d22d1175",
    name: "Lumora",
    style: "正念产品 / 液态玻璃",
    description: "适合正念与专注产品的全屏电影感首屏。",
    Component: LumoraPreset,
    fields: [
      { key: "badge", label: "徽章文案", kind: "text" },
      { key: "headingLine1", label: "标题第一行", kind: "text" },
      { key: "headingLine2", label: "标题第二行", kind: "text" },
      { key: "subtext", label: "副标题", kind: "textarea" },
      { key: "emailPlaceholder", label: "邮箱占位文案", kind: "text" },
      { key: "cta", label: "行动按钮", kind: "text" },
      { key: "stats", label: "底部数据，用 | 分隔", kind: "textarea" }
    ],
    defaults: {
      id: "lumora",
      texts: {
        badge: "Over 10,000 minds already finding their clarity",
        headingLine1: "Clarity in an Endlessly",
        headingLine2: "Noisy Universe",
        subtext:
          "Rise above the chaos of pings, infinite scrolling, and relentless demands. Discover how to protect your presence and create with intention.",
        emailPlaceholder: "Your Best Email",
        cta: "Get Early Access",
        stats: "60+ Deep Sessions | 12,000+ Creators | 4.8 User Satisfaction | Intentional-First Design"
      },
      headingFont: "'Instrument Serif', serif",
      bodyFont: systemFont,
      accentColor: "#ffffff",
      textColor: "#ffffff",
      backgroundKind: "video",
      backgroundUrl: lumoraVideos[0].src
    }
  },
  {
    id: "vaultshield",
    version: 1,
    upstreamSourceSha: "83c7482bd3014784b5f787bfc684688600fe0285",
    upstreamStyleSha: "418c93c524bbb1f85d0bc108ef0e3bc5d22d1175",
    name: "VaultShield",
    style: "安全 SaaS / 编辑感应用首屏",
    description: "基于 seedance-25-hero 重建的全屏密码管理器首屏。",
    Component: VaultShieldPreset,
    fields: [
      { key: "headingStart", label: "标题开头", kind: "text" },
      { key: "headingMiddle", label: "标题重点", kind: "text" },
      { key: "headingEnd", label: "标题结尾", kind: "text" },
      { key: "subtext", label: "副标题", kind: "textarea" },
      { key: "cta", label: "行动按钮", kind: "text" }
    ],
    defaults: {
      id: "vaultshield",
      texts: {
        headingStart: "Lock Down Your",
        headingMiddle: "Passwords",
        headingEnd: "with Ironclad Security",
        subtext:
          "Zero stress, total control. VaultShield keeps you covered with unbreakable storage, one-tap access, and pro-grade tools for your non-stop world.",
        cta: "Get It Free"
      },
      headingFont: "'Helvetica Now Display Bold', 'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      accentColor: "#7342E2",
      textColor: "#192837",
      backgroundKind: "video",
      backgroundUrl:
        "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_003132_8b7edcb6-c64d-4a52-a9ca-879942e122ad.mp4"
    }
  },
  {
    id: "viktor",
    version: 1,
    upstreamSourceSha: "83c7482bd3014784b5f787bfc684688600fe0285",
    upstreamStyleSha: "418c93c524bbb1f85d0bc108ef0e3bc5d22d1175",
    name: "Viktor",
    style: "创意作品集 / 动态视频",
    description: "带视频切换和实时钟表的全屏创意作品集首屏。",
    Component: ViktorPreset,
    fields: [
      { key: "name", label: "姓名", kind: "text" },
      { key: "status", label: "状态", kind: "text" },
      { key: "subtext", label: "简介", kind: "textarea" },
      { key: "cta", label: "行动按钮", kind: "text" }
    ],
    defaults: {
      id: "viktor",
      texts: {
        name: "Viktor",
        status: "Available for work",
        subtext:
          "I craft bold brands and modern websites with purpose, bringing sharp strategy and polished digital experiences to ambitious teams.",
        cta: "start a project"
      },
      headingFont: "'Figtree', sans-serif",
      bodyFont: "'Figtree', sans-serif",
      accentColor: "#F598F2",
      textColor: "#ffffff",
      backgroundKind: "video",
      backgroundUrl: viktorVideos[0].src
    }
  }
];

export const presetById = new Map(presets.map((preset) => [preset.id, preset]))

export function clonePresetState(state: PresetState): PresetState {
  return { ...state, texts: { ...state.texts } }
}
