import { useId, useMemo, useState } from 'react'
import type {
  WebComposerPresetState,
  WebComposerSlotContentKind,
  WebComposerSlotManifest,
} from '@mediatoolbox/contracts'

const kindLabels: Record<WebComposerSlotContentKind, string> = {
  text: '文',
  icon: '图标',
  image: '图片',
  media: '媒体',
}

export function WebComposerElementOutline({
  slots,
  state,
  selectedSlotId,
  onSelectSlot,
  onRestoreSlot,
}: {
  slots: readonly WebComposerSlotManifest[]
  state: WebComposerPresetState
  selectedSlotId: string | null
  onSelectSlot: (slotId: string) => void
  onRestoreSlot: (slotId: string) => void
}) {
  const titleId = useId()
  const searchId = useId()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()

  const groups = useMemo(() => {
    const grouped = new Map<string, WebComposerSlotManifest[]>()
    for (const slot of slots) {
      const value = state.slots[slot.id]
      const haystack = `${slot.label} ${slot.id} ${slot.group} ${value?.activeKind ?? ''}`.toLocaleLowerCase()
      if (normalizedQuery && !haystack.includes(normalizedQuery)) continue
      const group = grouped.get(slot.group) ?? []
      group.push(slot)
      grouped.set(slot.group, group)
    }
    return [...grouped.entries()]
  }, [normalizedQuery, slots, state.slots])

  const resultCount = groups.reduce((total, [, groupSlots]) => total + groupSlots.length, 0)

  return (
    <section className="wc-element-outline" aria-labelledby={titleId}>
      <div className="wc-context-heading">
        <strong id={titleId}>元素</strong>
        <span>{slots.length} 个 Slot</span>
      </div>
      <label className="wc-outline-search" htmlFor={searchId}>
        <span className="wc-visually-hidden">搜索可编辑元素</span>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder="搜索元素…"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <div className="wc-outline-groups" aria-label="可编辑元素列表">
        {groups.map(([groupName, groupSlots]) => (
          <section className="wc-outline-group" key={groupName} aria-label={groupName}>
            <h3>{groupName}</h3>
            {groupSlots.map((slot) => {
              const value = state.slots[slot.id]
              const visible = value?.visible !== false
              const activeKind = value?.activeKind ?? 'text'
              return (
                <div className={`wc-outline-row${visible ? '' : ' is-hidden'}`} key={slot.id}>
                  <button
                    type="button"
                    className="wc-outline-select"
                    aria-pressed={selectedSlotId === slot.id}
                    onClick={() => onSelectSlot(slot.id)}
                  >
                    <span className="wc-outline-kind" aria-hidden="true">{kindLabels[activeKind]}</span>
                    <span className="wc-outline-label" title={slot.label}>{slot.label}</span>
                    {!visible && <span className="wc-outline-state">已隐藏</span>}
                  </button>
                  {!visible && (
                    <button
                      type="button"
                      className="wc-outline-restore"
                      aria-label={`重新显示${slot.label}`}
                      onClick={() => onRestoreSlot(slot.id)}
                    >
                      显示
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        ))}
        {resultCount === 0 && (
          <p className="wc-outline-empty">没有匹配的元素。</p>
        )}
      </div>
    </section>
  )
}
