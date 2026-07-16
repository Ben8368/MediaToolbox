import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { WorkbenchAppId } from '@mediatoolbox/contracts'

import { APP_ICON_PATHS } from '@/icon-library'

const BrowserApp = lazy(() => import('@/apps/BrowserApp').then((module) => ({ default: module.BrowserApp })))
const DownloaderApp = lazy(() => import('@/apps/DownloaderApp').then((module) => ({ default: module.DownloaderApp })))
const FileManagerApp = lazy(() => import('@/apps/FileManagerApp').then((module) => ({ default: module.FileManagerApp })))
const PsdApp = lazy(() => import('@/apps/PsdApp').then((module) => ({ default: module.PsdApp })))
const SettingsApp = lazy(() => import('@/apps/SettingsApp').then((module) => ({ default: module.SettingsApp })))
const TranscodeApp = lazy(() => import('@/apps/TranscodeApp').then((module) => ({ default: module.TranscodeApp })))
const WebComposerApp = lazy(() => import('@/apps/WebComposerApp').then((module) => ({ default: module.WebComposerApp })))
const LogViewer = lazy(() => import('@/LogViewer').then((module) => ({ default: module.LogViewer })))

export type RegisteredApp = {
  id: WorkbenchAppId
  title: string
  label: string
  icon: string
  component: ComponentType | LazyExoticComponent<ComponentType>
  status: 'stable' | 'beta' | 'hidden'
  launcherVisible?: boolean
}

export const appRegistry: RegisteredApp[] = [
  { id: 'browser', label: 'Scry浏览器', title: 'Scry浏览器', icon: APP_ICON_PATHS.browser, component: BrowserApp, status: 'beta' },
  { id: 'file-manager', label: '文件管理', title: '文件管理', icon: APP_ICON_PATHS.fileManager, component: FileManagerApp, status: 'stable' },
  { id: 'fetcher', label: '下载', title: '下载', icon: APP_ICON_PATHS.fetcher, component: DownloaderApp, status: 'stable' },
  { id: 'transcode', label: '转码', title: '转码', icon: APP_ICON_PATHS.transcode, component: TranscodeApp, status: 'hidden', launcherVisible: false },
  { id: 'ps', label: 'PS', title: 'PS', icon: APP_ICON_PATHS.ps, component: PsdApp, status: 'beta' },
  { id: 'web-composer', label: '网页合成', title: '网页合成工作台', icon: APP_ICON_PATHS.webComposer, component: WebComposerApp, status: 'beta' },
  { id: 'settings', label: '设置', title: '设置', icon: APP_ICON_PATHS.settings, component: SettingsApp, status: 'beta', launcherVisible: false },
  { id: 'logs', label: '日志', title: '日志', icon: APP_ICON_PATHS.logs, component: LogViewer, status: 'hidden', launcherVisible: false },
]

const appRegistryById = new Map(appRegistry.map((app) => [app.id, app]))

export function getRegisteredApp(appId: string): RegisteredApp | undefined {
  return appRegistryById.get(appId as WorkbenchAppId)
}

export function getAppMetadata(appId: string): Pick<RegisteredApp, 'id' | 'title' | 'label' | 'icon'> | undefined {
  const app = getRegisteredApp(appId)
  if (!app) return undefined
  return {
    id: app.id,
    title: app.title,
    label: app.label,
    icon: app.icon,
  }
}

export function getLauncherApps(): RegisteredApp[] {
  return appRegistry.filter((app) => app.launcherVisible !== false && (app.status === 'stable' || app.status === 'beta'))
}
