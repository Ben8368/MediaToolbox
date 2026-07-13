import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const DEFAULT_SIDEBAR_WIDTH = 200
const DEFAULT_MIN_WIDTH = 160
const DEFAULT_MAX_WIDTH = 360
const KEYBOARD_STEP = 8
const STORAGE_PREFIX = 'mediatoolbox.appSidebarWidth.'

type ResizableAppSidebarProps = ComponentPropsWithoutRef<'aside'> & {
  storageKey: string
  minWidth?: number
  maxWidth?: number
  resizeLabel?: string
}

type DragState = {
  startX: number
  startWidth: number
  currentWidth: number
}

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)))
}

function readStoredWidth(storageKey: string, minWidth: number, maxWidth: number) {
  try {
    const storedWidth = Number(window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`))
    return Number.isFinite(storedWidth) && storedWidth > 0
      ? clampWidth(storedWidth, minWidth, maxWidth)
      : clampWidth(DEFAULT_SIDEBAR_WIDTH, minWidth, maxWidth)
  } catch {
    return clampWidth(DEFAULT_SIDEBAR_WIDTH, minWidth, maxWidth)
  }
}

function storeWidth(storageKey: string, width: number) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, String(width))
  } catch {
    // Storage can be unavailable in a restricted browser context; resizing still works for this session.
  }
}

export function ResizableAppSidebar({
  storageKey,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  resizeLabel = '调整左侧栏宽度',
  className,
  children,
  ...asideProps
}: ResizableAppSidebarProps) {
  const resolvedMinWidth = Math.min(minWidth, maxWidth)
  const resolvedMaxWidth = Math.max(minWidth, maxWidth)
  const sidebarRef = useRef<HTMLElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const [width, setWidth] = useState(() => readStoredWidth(storageKey, resolvedMinWidth, resolvedMaxWidth))
  const [resizing, setResizing] = useState(false)

  useLayoutEffect(() => {
    const host = sidebarRef.current?.parentElement
    if (!host) return

    host.classList.add('app-resizable-sidebar-host')
    return () => {
      host.classList.remove('app-resizable-sidebar-host')
      host.style.removeProperty('--app-sidebar-width')
    }
  }, [])

  useLayoutEffect(() => {
    sidebarRef.current?.parentElement?.style.setProperty('--app-sidebar-width', `${width}px`)
  }, [width])

  const commitWidth = (nextWidth: number) => {
    const clampedWidth = clampWidth(nextWidth, resolvedMinWidth, resolvedMaxWidth)
    setWidth(clampedWidth)
    storeWidth(storageKey, clampedWidth)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      startX: event.clientX,
      startWidth: width,
      currentWidth: width,
    }
    setResizing(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState) return

    const nextWidth = clampWidth(
      dragState.startWidth + event.clientX - dragState.startX,
      resolvedMinWidth,
      resolvedMaxWidth,
    )
    dragState.currentWidth = nextWidth
    setWidth(nextWidth)
  }

  const finishPointerResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState) return

    dragStateRef.current = null
    setResizing(false)
    commitWidth(dragState.currentWidth)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextWidth: number | null = null
    const step = event.shiftKey ? KEYBOARD_STEP * 4 : KEYBOARD_STEP

    if (event.key === 'ArrowLeft') nextWidth = width - step
    if (event.key === 'ArrowRight') nextWidth = width + step
    if (event.key === 'Home') nextWidth = resolvedMinWidth
    if (event.key === 'End') nextWidth = resolvedMaxWidth
    if (nextWidth === null) return

    event.preventDefault()
    commitWidth(nextWidth)
  }

  const sidebarClassName = [
    'app-resizable-sidebar',
    resizing ? 'app-resizable-sidebar--resizing' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <aside ref={sidebarRef} className={sidebarClassName} {...asideProps}>
        {children}
      </aside>
      <div
        className="app-sidebar-resize-handle"
        role="separator"
        aria-label={resizeLabel}
        aria-orientation="vertical"
        aria-valuemin={resolvedMinWidth}
        aria-valuemax={resolvedMaxWidth}
        aria-valuenow={width}
        tabIndex={0}
        title="拖动调整宽度，双击恢复 200px"
        onDoubleClick={() => commitWidth(DEFAULT_SIDEBAR_WIDTH)}
        onKeyDown={handleKeyDown}
        onPointerCancel={finishPointerResize}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerResize}
      />
    </>
  )
}
