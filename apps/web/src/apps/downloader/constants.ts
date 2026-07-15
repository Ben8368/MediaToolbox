import type { CategoryKey, CategoryMeta, PlatformOption } from '@/apps/downloader/types'

export const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    value: 'auto',
    label: '智能识别',
  },
  {
    value: 'youtube',
    label: 'YouTube / Shorts',
  },
  {
    value: 'bilibili',
    label: 'Bilibili',
  },
  {
    value: 'short_video',
    label: '短视频平台',
  },
]

export const CATEGORY_MAP: Record<CategoryKey, CategoryMeta> = {
  all: { label: '全部', icon: 'grid', key: 'all' },
  downloading: { label: '下载中', icon: 'download', key: 'downloading' },
  completed: { label: '已完成', icon: 'check', key: 'completed' },
  paused: { label: '已停止', icon: 'pause', key: 'paused' },
  error: { label: '错误', icon: 'error', key: 'error' },
}
