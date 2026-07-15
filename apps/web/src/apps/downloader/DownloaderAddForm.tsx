import type { CookieBrowser } from '@/apps/downloader/types'

type DownloaderAddFormProps = {
  taskUrl: string
  taskOutputDir: string
  taskCookieBrowser: CookieBrowser
  taskCompatibleFormat: boolean
  addingTask: boolean
  submitError: string
  onTaskUrlChange: (value: string) => void
  onTaskOutputDirChange: (value: string) => void
  onTaskCookieBrowserChange: (value: CookieBrowser) => void
  onTaskCompatibleFormatChange: (value: boolean) => void
  onOpenDirectoryPicker: () => void
  onSubmit: () => void
  onClose: () => void
}

export function DownloaderAddForm({
  taskUrl,
  taskOutputDir,
  taskCookieBrowser,
  taskCompatibleFormat,
  addingTask,
  submitError,
  onTaskUrlChange,
  onTaskOutputDirChange,
  onTaskCookieBrowserChange,
  onTaskCompatibleFormatChange,
  onOpenDirectoryPicker,
  onSubmit,
  onClose,
}: DownloaderAddFormProps) {
  return (
    <div className="dl-add-form" aria-label="新建下载任务">
      <div className="dl-form-section dl-form-section--source">
        <div className="dl-field dl-field--source">
          <div className="dl-field-heading">
            <label htmlFor="download-task-url">下载链接</label>
            <small>支持多条链接</small>
          </div>
          <textarea
            id="download-task-url"
            value={taskUrl}
            onChange={(event) => onTaskUrlChange(event.target.value)}
            placeholder={'输入视频 URL（YouTube、Bilibili 等）\n支持多行，每行一个链接'}
            rows={4}
            style={{ resize: 'vertical', minHeight: '80px' }}
          />
          <small className="dl-field-hint">平台与任务通道会按链接自动识别并分流；检测到字幕时，仅下载一份原始语言的 SRT 字幕。</small>
        </div>
      </div>

      <div className="dl-form-section dl-form-section--destination">
        <div className="dl-field dl-field--path">
          <div className="dl-field-heading">
            <label>目标目录</label>
            <small>{taskOutputDir ? '已选择自定义目录' : '使用默认目录'}</small>
          </div>
          <div className="dl-path-field">
            <button
              type="button"
              className={`dl-path-display ${taskOutputDir ? 'dl-path-display--filled' : ''}`}
              onClick={onOpenDirectoryPicker}
            >
              <span className="dl-path-display__label">{taskOutputDir || '留空则使用默认下载目录'}</span>
              <span className="dl-path-display__action">{taskOutputDir ? '更改' : '选择目录'}</span>
            </button>
            {taskOutputDir && (
              <button type="button" className="dl-btn dl-btn--ghost" onClick={() => onTaskOutputDirChange('')}>
                清空
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="dl-form-options">
        <div className="dl-field dl-option-card">
          <div className="dl-field-heading">
            <label htmlFor="download-cookie-browser">登录态</label>
            <small>可选</small>
          </div>
          <select
            id="download-cookie-browser"
            value={taskCookieBrowser}
            onChange={(event) => onTaskCookieBrowserChange(event.target.value as CookieBrowser)}
          >
            <option value="none">不使用浏览器登录态</option>
            <option value="chrome">Chrome</option>
            <option value="edge">Edge</option>
            <option value="safari">Safari</option>
            <option value="firefox">Firefox</option>
          </select>
          <small className="dl-field-hint">仅在遇到 YouTube 登录或机器人验证时选择；读取 Cookie 前需完全退出对应浏览器。</small>
        </div>

        <div className="dl-field dl-compatible-format dl-option-card">
          <label className="dl-checkbox-label">
            <input
              type="checkbox"
              checked={taskCompatibleFormat}
              onChange={(event) => onTaskCompatibleFormatChange(event.target.checked)}
            />
            <span>兼容格式（H.264 / MP4）</span>
          </label>
          <small className="dl-field-hint">
            默认保留最高规格，音视频合并优先使用 MKV；勾选后会转码为 H.264 / MP4。
          </small>
        </div>
      </div>

      <div className="dl-form-actions">
        <button className="dl-btn dl-btn--primary" onClick={onSubmit} disabled={addingTask || !taskUrl.trim()}>
          {addingTask ? '提交中...' : '确认添加'}
        </button>
        <button className="dl-btn" onClick={onClose}>
          取消
        </button>
      </div>
      {submitError && <div className="dl-form-error">{submitError}</div>}
    </div>
  )
}
