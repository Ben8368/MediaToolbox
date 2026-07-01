import type { RefObject } from 'react'

import type { DiskInfo, FileEntry } from '@/apps/file-manager/types'
import {
  BackIcon,
  CloseIcon,
  DriveIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  ForwardIcon,
  IconButton,
  ParentDirIcon,
  RefreshIcon,
  SearchIcon,
} from '@/apps/file-manager/controls'
import { displayDiskName, entryType, formatDate, formatSize, isPathOnDisk, locationLabel } from '@/apps/file-manager/utils'

type DirectoryPickerToolbarProps = {
  canGoBack: boolean
  canGoForward: boolean
  currentParent: string | null
  currentPath: string
  searchText: string
  searchPlaceholder: string
  addressDraft: string
  addressInputRef: RefObject<HTMLInputElement>
  onGoBack: () => void
  onGoForward: () => void
  onGoParent: () => void
  onRefresh: () => void
  onAddressChange: (value: string) => void
  onAddressFocus: () => void
  onAddressBlur: () => void
  onSearchChange: (value: string) => void
}

export function DirectoryPickerToolbar({
  canGoBack,
  canGoForward,
  currentParent,
  currentPath,
  searchText,
  searchPlaceholder,
  addressDraft,
  addressInputRef,
  onGoBack,
  onGoForward,
  onGoParent,
  onRefresh,
  onAddressChange,
  onAddressFocus,
  onAddressBlur,
  onSearchChange,
}: DirectoryPickerToolbarProps) {
  return (
    <div className="fm-picker__toolbar">
      <div className="fm-nav-buttons">
        <IconButton disabled={!canGoBack} title="后退" onClick={onGoBack}>
          <BackIcon />
        </IconButton>
        <IconButton disabled={!canGoForward} title="前进" onClick={onGoForward}>
          <ForwardIcon />
        </IconButton>
        <IconButton disabled={!currentParent} title="返回上一级目录" onClick={onGoParent}>
          <ParentDirIcon />
        </IconButton>
        <IconButton disabled={!currentPath} title="刷新" onClick={onRefresh}>
          <RefreshIcon />
        </IconButton>
      </div>
      <input
        ref={addressInputRef}
        type="text"
        className="fm-picker__address-input"
        value={addressDraft}
        onChange={(event) => onAddressChange(event.target.value)}
        onFocus={onAddressFocus}
        onBlur={onAddressBlur}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
        spellCheck={false}
        autoComplete="off"
        aria-label="当前路径"
        placeholder={currentPath ? '编辑路径后按 Enter 跳转' : '加载中…'}
      />
      <label className="fm-search fm-picker__search">
        <SearchIcon />
        <input value={searchText} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} />
      </label>
    </div>
  )
}

type DirectoryPickerDriveBarProps = {
  disks: DiskInfo[]
  activeDiskPath: string
  currentPath: string
  loading: boolean
  mkdirBusy: boolean
  onSelectDisk: (path: string) => void
  onNewFolder: () => void
}

export function DirectoryPickerDriveBar({
  disks,
  activeDiskPath,
  currentPath,
  loading,
  mkdirBusy,
  onSelectDisk,
  onNewFolder,
}: DirectoryPickerDriveBarProps) {
  return (
    <div className="fm-picker__drives">
      <div className="fm-picker__drives-disks">
        {disks.map((disk) => (
          <button
            key={disk.path}
            type="button"
            className={`fm-picker__drive fm-picker__drive--disk ${activeDiskPath === disk.path || isPathOnDisk(currentPath, disk.path) ? 'fm-picker__drive--active' : ''}`}
            onClick={() => onSelectDisk(disk.path)}
          >
            <span className="fm-picker__drive-icon" aria-hidden>
              <DriveIcon />
            </span>
            <span className="fm-picker__drive-label">{displayDiskName(disk.name)}</span>
            <small className="fm-picker__drive-meta">{formatSize(disk.free)}</small>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="fm-picker__drive fm-picker__drive--new-folder"
        disabled={!currentPath || loading || mkdirBusy}
        title="在本目录下新建文件夹"
        aria-label="新建文件夹"
        onClick={onNewFolder}
      >
        <span className="fm-picker__drive-icon fm-picker__drive-icon--compact" aria-hidden>
          <FolderPlusIcon />
        </span>
        <span className="fm-picker__drive-label">新建文件夹</span>
      </button>
    </div>
  )
}

type DirectoryPickerEntryListProps = {
  loading: boolean
  error: string
  currentPath: string
  disks: DiskInfo[]
  directories: FileEntry[]
  files: FileEntry[]
  selectedPath: string
  canPickDirectory: boolean
  canPickFile: boolean
  onSelectPath: (path: string) => void
  onOpenDirectory: (path: string) => void
}

export function DirectoryPickerEntryList({
  loading,
  error,
  currentPath,
  disks,
  directories,
  files,
  selectedPath,
  canPickDirectory,
  canPickFile,
  onSelectPath,
  onOpenDirectory,
}: DirectoryPickerEntryListProps) {
  return (
    <div className="fm-picker__list">
      {loading && <div className="fm-empty">正在加载...</div>}
      {!loading && error && <div className="fm-empty fm-empty--error">{error}</div>}
      {!loading && !error && directories.map((entry) => (
        <button
          key={entry.path}
          type="button"
          className={`fm-picker__row ${canPickDirectory && selectedPath === entry.path ? 'fm-picker__row--selected' : ''}`}
          onClick={() => canPickDirectory && onSelectPath(entry.path)}
          onDoubleClick={() => onOpenDirectory(entry.path)}
        >
          <div className="fm-picker__row-main">
            <FolderIcon />
            <div className="fm-picker__row-copy">
              <strong>{entry.name}</strong>
              <span>{formatDate(entry.modified)}</span>
            </div>
          </div>
          <em>{locationLabel(entry.path, disks)}</em>
        </button>
      ))}
      {!loading && !error && files.map((entry) => (
        <button
          key={entry.path}
          type="button"
          className={`fm-picker__row ${selectedPath === entry.path ? 'fm-picker__row--selected' : ''}`}
          onClick={() => canPickFile && onSelectPath(entry.path)}
        >
          <div className="fm-picker__row-main">
            <FileIcon ext={entry.extension} />
            <div className="fm-picker__row-copy">
              <strong>{entry.name}</strong>
              <span>{entryType(entry)} | {formatSize(entry.size)}</span>
            </div>
          </div>
          <em>{formatDate(entry.modified)}</em>
        </button>
      ))}
      {!loading && !error && currentPath && directories.length === 0 && files.length === 0 && (
        <div className="fm-empty">当前目录下没有可选内容</div>
      )}
    </div>
  )
}

export { CloseIcon }
