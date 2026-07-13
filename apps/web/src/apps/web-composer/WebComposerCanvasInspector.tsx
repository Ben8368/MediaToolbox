import { useId } from 'react'
import type { WebComposerPresetState } from '@mediatoolbox/contracts'

import { getFontOptions } from './typographyOptions'

export function WebComposerCanvasInspector({
  state,
  onStateChange,
}: {
  state: WebComposerPresetState
  onStateChange: (state: WebComposerPresetState) => void
}) {
  const titleId = useId()
  const updateTheme = (patch: Partial<WebComposerPresetState['theme']>) => {
    onStateChange({ ...state, theme: { ...state.theme, ...patch } })
  }

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
          {getFontOptions(state.theme.headingFont).map((option) => (
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
          {getFontOptions(state.theme.bodyFont).map((option) => (
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
