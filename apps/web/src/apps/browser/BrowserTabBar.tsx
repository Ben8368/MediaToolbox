import { tabTitle, type BrowserTab } from './helpers'

export function BrowserTabBar({
  tabs,
  activeId,
  disabled,
  onSelect,
  onClose,
  onOpen,
}: {
  tabs: BrowserTab[]
  activeId: string
  disabled: boolean
  onSelect: (viewId: string) => void
  onClose: (viewId: string) => void
  onOpen: () => void
}) {
  const canClose = tabs.length > 1
  return (
    <div className="browser-tabbar" role="tablist">
      <div className="browser-tabbar__list">
        {tabs.map((tab) => {
          const active = tab.viewId === activeId
          return (
            <div
              key={tab.viewId}
              className={`browser-tab ${active ? 'browser-tab--active' : ''}`}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              title={tab.state.url && tab.state.url !== 'about:blank' ? tab.state.url : '新标签页'}
              onMouseDown={() => onSelect(tab.viewId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(tab.viewId)
                }
              }}
            >
              <span className="browser-tab__title">{tabTitle(tab)}</span>
              {canClose && (
                <button
                  type="button"
                  className="browser-tab__close"
                  title="关闭标签页"
                  aria-label="关闭标签页"
                  onMouseDown={(event) => {
                    event.stopPropagation()
                    onClose(tab.viewId)
                  }}
                >
                  <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button
        type="button"
        className="browser-tab__new"
        title="新建标签页"
        aria-label="新建标签页"
        disabled={disabled}
        onClick={onOpen}
      >
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  )
}
