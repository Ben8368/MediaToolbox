import {
  ChevronIcon,
  DriveIcon,
  SettingsIcon,
  SidebarButton,
  TrashIcon,
} from '@/apps/file-manager/controls'
import type { AssetRecord } from '@/api/types'
import type { DiskInfo } from '@/apps/file-manager/types'
import { displayDiskName, formatSize, isPathOnDisk } from '@/apps/file-manager/utils'

type FileManagerSidebarProps = {
  activeSection: 'local' | 'trash'
  disks: DiskInfo[]
  assets: AssetRecord[]
  activeDiskPath: string
  currentPath: string
  onOpenLocal: () => void
  onOpenTrash: () => void
  onSelectDisk: (path: string) => void
}

export function FileManagerSidebar({
  activeSection,
  disks,
  assets,
  activeDiskPath,
  currentPath,
  onOpenLocal,
  onOpenTrash,
  onSelectDisk,
}: FileManagerSidebarProps) {
  return (
    <aside className="fm-sidebar">
      <nav className="fm-nav">
        <SidebarButton active={activeSection === 'local'} icon={<ChevronIcon />} label="我的文件" onClick={onOpenLocal} />
        {assets.length > 0 && (
          <div className="fm-asset-summary">
            <strong>资产索引</strong>
            <span>{assets.length} 项产出</span>
          </div>
        )}
        {activeSection === 'local' && disks.length > 0 && (
          <div className="fm-disk-list">
            {disks.map((disk) => (
              <button
                key={disk.root || disk.path}
                type="button"
                className={`fm-disk ${disk.browsable === false ? 'fm-disk--readonly' : ''} ${activeDiskPath === disk.path || isPathOnDisk(currentPath, disk.path) ? 'fm-disk--active' : ''}`}
                onClick={() => onSelectDisk(disk.path)}
                title={disk.browsable === false ? '仅展示容量，当前工作区未映射到此磁盘' : undefined}
              >
                <DriveIcon />
                <span className="fm-disk-main">{displayDiskName(disk.name)}</span>
                <small>{formatSize(disk.free)}</small>
              </button>
            ))}
          </div>
        )}
        <div className="fm-nav-gap" />
        <SidebarButton active={activeSection === 'trash'} icon={<TrashIcon />} label="回收站" onClick={onOpenTrash} />
      </nav>
      <button type="button" className="fm-settings"><SettingsIcon />设置</button>
    </aside>
  )
}
