import { useId } from 'react'
import type { WebComposerPresetState } from '@mediatoolbox/contracts'

export function WebComposerCanvasInspector({
  presetName,
  state,
  onStateChange,
}: {
  presetName: string
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
        <span>全局变量</span>
      </div>
      <label className="wc-context-field">
        <span>标题字体</span>
        <input
          value={state.theme.headingFont}
          onChange={(event) => updateTheme({ headingFont: event.currentTarget.value })}
        />
      </label>
      <label className="wc-context-field">
        <span>正文字体</span>
        <input
          value={state.theme.bodyFont}
          onChange={(event) => updateTheme({ bodyFont: event.currentTarget.value })}
        />
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
      <div className="wc-context-lock-note">
        <strong>{presetName} · 预设已锁定</strong>
        <span>这里只修改预设声明的主题变量，不改变页面结构与动画。</span>
      </div>
    </section>
  )
}
