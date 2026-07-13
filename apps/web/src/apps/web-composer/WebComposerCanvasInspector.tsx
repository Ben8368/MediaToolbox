import { useEffect, useId, useState } from 'react'
import type { WebComposerPresetState } from '@mediatoolbox/contracts'

import { listSystemFonts } from '@/api'
import { getFontOptions } from './typographyOptions'

type FontOption = { label: string; value: string }

function useSystemFontOptions(): FontOption[] {
  const [systemFonts, setSystemFonts] = useState<FontOption[]>([])
  useEffect(() => {
    listSystemFonts()
      .then((res) => {
        if (!res.fonts?.length) return
        const seen = new Set<string>()
        const opts: FontOption[] = []
        for (const f of res.fonts) {
          if (seen.has(f.family)) continue
          seen.add(f.family)
          opts.push({ label: f.family, value: `'${f.family}', sans-serif` })
        }
        setSystemFonts(opts)
      })
      .catch(() => {})
  }, [])
  return systemFonts
}

function mergedFontOptions(builtIn: readonly FontOption[], system: FontOption[], currentValue: string | null): FontOption[] {
  const allValues = new Set(builtIn.map((o) => o.value))
  const extra = system.filter((o) => !allValues.has(o.value))
  const base = [...builtIn, ...extra]
  if (!currentValue || base.some((o) => o.value === currentValue)) return base
  return [{ label: '当前自定义字体', value: currentValue }, ...base]
}

export function WebComposerCanvasInspector({
  state,
  onStateChange,
}: {
  state: WebComposerPresetState
  onStateChange: (state: WebComposerPresetState) => void
}) {
  const titleId = useId()
  const systemFonts = useSystemFontOptions()
  const updateTheme = (patch: Partial<WebComposerPresetState['theme']>) => {
    onStateChange({ ...state, theme: { ...state.theme, ...patch } })
  }

  const headingFontOpts = mergedFontOptions(getFontOptions(state.theme.headingFont), systemFonts, state.theme.headingFont)
  const bodyFontOpts = mergedFontOptions(getFontOptions(state.theme.bodyFont), systemFonts, state.theme.bodyFont)

  return (
    <section className="wc-context-section" aria-labelledby={titleId}>
      <div className="wc-context-heading">
        <strong id={titleId}>画布主题</strong>
      </div>
      <label className="wc-context-field">
        <span>标题字体</span>
        <select
          value={state.theme.headingFont}
          onChange={(event) => updateTheme({ headingFont: event.currentTarget.value })}
        >
          {headingFontOpts.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="wc-context-field">
        <span>正文字体</span>
        <select
          value={state.theme.bodyFont}
          onChange={(event) => updateTheme({ bodyFont: event.currentTarget.value })}
        >
          {bodyFontOpts.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <div className="wc-context-grid wc-context-grid--two">
        <label className="wc-context-field">
          <span>强调色</span>
          <span className="wc-context-color">
            <input
              type="color"
              value={state.theme.accentColor}
              onChange={(event) => updateTheme({ accentColor: event.currentTarget.value })}
            />
            <output>{state.theme.accentColor}</output>
          </span>
        </label>
        <label className="wc-context-field">
          <span>文字色</span>
          <span className="wc-context-color">
            <input
              type="color"
              value={state.theme.textColor}
              onChange={(event) => updateTheme({ textColor: event.currentTarget.value })}
            />
            <output>{state.theme.textColor}</output>
          </span>
        </label>
      </div>
    </section>
  )
}
