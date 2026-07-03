import { useCallback, useEffect } from 'react'
import { LeftNavbar } from '@/LeftNavbar'
import { AppLauncher } from '@/AppLauncher'
import { WindowContainer } from '@/WindowContainer'
import { DesktopIcons } from '@/DesktopIcons'
import { RightPanel } from '@/components/RightPanel'
import { useWindowStore } from '@/windowStore'
import { useSystemStore } from '@/store'

export default function App() {
  const { openWindow } = useWindowStore()
  const { setShowLauncher, wallpaper } = useSystemStore()

  const handleOpenApp = useCallback((id: string) => {
    openWindow(id)
    setShowLauncher(false)
  }, [openWindow, setShowLauncher])

  useEffect(() => {
    document.documentElement.style.setProperty('--mt-wp', `url('/static/bg/live/wallpaper-${wallpaper + 1}-dark.webp')`)
  }, [wallpaper])

  return (
    <div className="mt-desktop">
      <LeftNavbar />
      <div className="mt-main">
        <DesktopIcons onOpenApp={handleOpenApp} />
      </div>
      <WindowContainer />
      <AppLauncher onOpenApp={handleOpenApp} />
      <RightPanel />
    </div>
  )
}
