import { useEffect, useState, type KeyboardEvent } from 'react'
import type { WebComposerNumberControl } from '@mediatoolbox/contracts'

import { clampSlotNumber } from './slotState'
import { getFontSizeOptions } from './typographyOptions'

function formatNullableNumber(value: number | null) {
  return value === null ? '' : String(value)
}

export function liveNullableNumberValue(
  rawValue: string,
  control: WebComposerNumberControl,
): number | null | undefined {
  if (rawValue.trim() === '') return null

  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) return undefined

  const normalized = clampSlotNumber(parsed, control)
  return normalized === parsed ? normalized : undefined
}

export function committedNullableNumberValue(
  rawValue: string,
  control: WebComposerNumberControl,
  fallback: number | null,
) {
  if (rawValue.trim() === '') return null

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? clampSlotNumber(parsed, control) : fallback
}

export function WebComposerNullableNumberField({
  label,
  value,
  control,
  onChange,
}: {
  label: string
  value: number | null
  control: WebComposerNumberControl
  onChange: (value: number | null) => void
}) {
  const [draft, setDraft] = useState(() => formatNullableNumber(value))

  useEffect(() => {
    setDraft(formatNullableNumber(value))
  }, [value])

  const commit = (rawValue: string) => {
    const nextValue = committedNullableNumberValue(rawValue, control, value)
    setDraft(formatNullableNumber(nextValue))
    if (nextValue !== value) onChange(nextValue)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit(event.currentTarget.value)
  }

  return (
    <label className="wc-context-field">
      <span>{label}</span>
      <input
        type="number"
        min={control.min}
        max={control.max}
        step={control.step}
        value={draft}
        placeholder="预设"
        onChange={(event) => {
          const rawValue = event.currentTarget.value
          setDraft(rawValue)
          const nextValue = liveNullableNumberValue(rawValue, control)
          if (nextValue !== undefined && nextValue !== value) onChange(nextValue)
        }}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    </label>
  )
}

export function WebComposerNullableNumberSelect({
  label,
  value,
  control,
  onChange,
}: {
  label: string
  value: number | null
  control: WebComposerNumberControl
  onChange: (value: number | null) => void
}) {
  return (
    <label className="wc-context-field">
      <span>{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.currentTarget.value === '' ? null : Number(event.currentTarget.value))}
      >
        <option value="">继承预设</option>
        {getFontSizeOptions(control, value).map((size) => <option key={size} value={size}>{size} px</option>)}
      </select>
    </label>
  )
}
