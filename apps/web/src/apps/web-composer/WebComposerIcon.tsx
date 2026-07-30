import type { CSSProperties } from 'react'
import {
  ArrowRight,
  ArrowRightCircle,
  BadgeCheck,
  CircleCheck,
  Fingerprint,
  Heart,
  ImageIcon,
  LockKeyhole,
  Menu,
  Shield,
  Sparkles,
  Star,
  Upload,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { WebComposerIconName } from '@mediatoolbox/contracts'

export const webComposerIconLabels: Record<WebComposerIconName, string> = {
  'arrow-right': '向右箭头',
  'arrow-right-circle': '圆形向右箭头',
  'badge-check': '认证徽章',
  'circle-check': '圆形勾选',
  fingerprint: '指纹',
  heart: '爱心',
  image: '图片',
  'lock-keyhole': '安全锁',
  menu: '菜单',
  shield: '盾牌',
  sparkles: '闪光',
  star: '星标',
  upload: '上传',
  'vault-logo': 'VaultShield Logo',
  zap: '闪电',
}

const iconRegistry: Partial<Record<WebComposerIconName, LucideIcon>> = {
  'arrow-right': ArrowRight,
  'arrow-right-circle': ArrowRightCircle,
  'badge-check': BadgeCheck,
  'circle-check': CircleCheck,
  fingerprint: Fingerprint,
  heart: Heart,
  image: ImageIcon,
  'lock-keyhole': LockKeyhole,
  menu: Menu,
  shield: Shield,
  sparkles: Sparkles,
  star: Star,
  upload: Upload,
  zap: Zap,
}

function VaultLogo({ className, size = 32, style }: { className?: string; size?: number; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} fill="none" overflow="visible" viewBox="0 0 256 256" aria-hidden="true">
      <path
        d="M64 128h.5L32 95 0 64V0h64l64 64v.5L161 32l31-32h64v64l-64 64h-64v64l-32 31-32.5 33H0v-64l64-64Zm192 64-32 31-32.5 33H128v-64l64-64h64v64Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function WebComposerIcon({ iconId, className, size, style }: {
  iconId: WebComposerIconName
  className?: string
  size?: number
  style?: CSSProperties
}) {
  if (iconId === 'vault-logo') return <VaultLogo className={className} size={size} style={style} />
  const Icon = iconRegistry[iconId] ?? Sparkles
  return <Icon className={className} size={size} style={style} aria-hidden="true" />
}
