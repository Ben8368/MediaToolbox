import { getApiRuntimePresentation, shutdownSystem } from '@/api'
import { getAppIcon } from '@/icon-library'
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling'
import {
  IconBell,
  IconGear,
  IconGlobe,
  IconGrid,
  IconMonitor,
  IconPower,
  IconUser,
} from '@/LeftNavbarIcons'
import { useNotificationUnreadStore } from '@/notificationUnreadStore'
import { useSystemStore } from '@/store'
import { getErrorMessage } from '@/utils'
import { useWindowStore } from '@/windowStore'
import { useState } from 'react'

export function LeftNavbar() {
  const { showLauncher, toggleLauncher } = useSystemStore()
  const windows = useWindowStore((state) => state.windows)
  const openWindow = useWindowStore((state) => state.openWindow)
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow)
  const focusWindow = useWindowStore((state) => state.focusWindow)
  const unreadNotificationCount = useNotificationUnreadStore((s) => s.unreadNotificationCount)
  const pullUnreadNotificationCount = useNotificationUnreadStore((s) => s.pullUnreadNotificationCount)
  const [showPowerMenu, setShowPowerMenu] = useState(false)
  const [isShuttingDown, setIsShuttingDown] = useState(false)
  const [powerComplete, setPowerComplete] = useState<'shutdown' | null>(null)
  const runtime = getApiRuntimePresentation()

  const uniqueRunningApps = windows.filter(
    (windowItem, index, allWindows) =>
      allWindows.findIndex((candidate) => candidate.appType === windowItem.appType) === index,
  )

  useVisibilityPolling(() => void pullUnreadNotificationCount(), 3000)

  function doClick(appType: string) {
    const existingWindow = windows.find((windowItem) => windowItem.appType === appType)
    if (!existingWindow) return

    if (existingWindow.isMinimized) {
      openWindow(appType)
      return
    }

    const topZIndex = Math.max(...windows.map((windowItem) => windowItem.zIndex))
    if (existingWindow.zIndex === topZIndex) {
      minimizeWindow(existingWindow.id)
      return
    }

    focusWindow(existingWindow.id)
  }

  async function doShutdown() {
    if (isShuttingDown) return
    if (!window.confirm(runtime.shutdown.confirm)) return

    setIsShuttingDown(true)
    try {
      await shutdownSystem()
      setPowerComplete('shutdown')
    } catch (error: unknown) {
      window.alert(getErrorMessage(error) || runtime.shutdown.fallbackError)
      setIsShuttingDown(false)
    }
  }

  if (powerComplete) {
    return (
      <div className="fnos-shutdown-overlay">
        <div className="fnos-shutdown-card">
          <div className="fnos-shutdown-card__title">{runtime.shutdown.completeTitle}</div>
          <div className="fnos-shutdown-card__body">
            {runtime.shutdown.completeBody}
          </div>
          <button type="button" className="fnos-shutdown-card__reload" onClick={() => window.location.reload()}>
            返回桌面
          </button>
        </div>
      </div>
    )
  }

  const topZIndex = Math.max(...windows.map((windowItem) => windowItem.zIndex), 0)

  return (
    <div className="fnos-left-nav">
      <div className="fnos-left-nav__section fnos-left-nav__section--top">
        <NavButton icon={<IconMonitor />} tooltip="MediaTools" />
        <NavButton icon={<IconGrid />} tooltip="所有应用" active={showLauncher} onClick={toggleLauncher} />
      </div>

      <div className="fnos-left-nav__sep" />

      <div className="fnos-left-nav__section fnos-left-nav__section--apps">
        {uniqueRunningApps.map((windowItem) => (
          <button
            key={windowItem.id}
            onClick={() => doClick(windowItem.appType)}
            title={windowItem.title}
            className={`fnos-left-nav__app-btn ${windowItem.zIndex === topZIndex ? 'fnos-left-nav__app-btn--active' : ''}`}
          >
            <img src={getAppIcon(windowItem.appType)} alt={windowItem.title} />
          </button>
        ))}
      </div>

      <div className="fnos-left-nav__sep fnos-left-nav__sep--bottom" />

      <div className="fnos-left-nav__section fnos-left-nav__section--bottom">
        <NavButton icon={<IconGlobe />} tooltip="网络" />
        <div className="fnos-left-nav__notify-wrap">
          <NavButton
            icon={<IconBell />}
            tooltip="日志"
            active={windows.some((item) => item.appType === 'logs' && !item.isMinimized)}
            onClick={() => {
              void pullUnreadNotificationCount()
              openWindow('logs')
            }}
          />
          {unreadNotificationCount > 0 && (
            <div className="fnos-left-nav__badge">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </div>
          )}
        </div>
        <NavButton icon={<IconUser />} tooltip="账号" />
        <NavButton icon={<IconGear />} tooltip="设置" onClick={() => openWindow('settings')} />
        <NavButton
          ariaLabel="power-menu"
          icon={<IconPower />}
          tooltip={isShuttingDown ? '关闭中...' : '退出'}
          active={showPowerMenu}
          onClick={() => setShowPowerMenu((visible) => !visible)}
          disabled={isShuttingDown}
        />
      </div>

      {showPowerMenu && (
        <div className="fnos-left-nav__power-menu">
          <button
            type="button"
            aria-label="shutdown-backend"
            className="fnos-left-nav__power-btn"
            onClick={() => {
              setShowPowerMenu(false)
              void doShutdown()
            }}
          >
            <IconPower />
            <span>关闭</span>
          </button>
        </div>
      )}
    </div>
  )
}

function NavButton({
  icon,
  tooltip,
  active,
  onClick,
  disabled,
  ariaLabel,
}: {
  icon: React.ReactNode
  tooltip: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`sb-btn ${active ? 'sb-btn--active' : ''}`}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {icon}
    </button>
  )
}
