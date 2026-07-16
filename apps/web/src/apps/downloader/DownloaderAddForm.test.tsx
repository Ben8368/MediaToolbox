import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { DownloaderAddForm } from './DownloaderAddForm'

describe('DownloaderAddForm', () => {
  it('keeps compact options and exposes their explanations as accessible tooltips', () => {
    const markup = renderToStaticMarkup(
      <DownloaderAddForm
        taskUrl="https://example.com/video"
        taskOutputDir=""
        taskCookieBrowser="none"
        taskCompatibleFormat={false}
        addingTask={false}
        submitError=""
        onTaskUrlChange={vi.fn()}
        onTaskOutputDirChange={vi.fn()}
        onTaskCookieBrowserChange={vi.fn()}
        onTaskCompatibleFormatChange={vi.fn()}
        onOpenDirectoryPicker={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('class="dl-form-command-row"')
    expect(markup).toContain('class="dl-field dl-option-control dl-login-option"')
    expect(markup).toContain('aria-label="登录态"')
    expect(markup).not.toContain('>可选<')
    expect(markup).not.toContain('for="download-cookie-browser"')
    expect(markup).toContain('aria-describedby="download-cookie-browser-help"')
    expect(markup).toContain('aria-describedby="download-compatible-format-help"')
    expect(markup).toContain('id="download-cookie-browser-help" class="dl-option-help__tooltip" role="tooltip"')
    expect(markup).toContain('id="download-compatible-format-help" class="dl-option-help__tooltip" role="tooltip"')
    expect(markup).toContain('确认添加')
  })
})
