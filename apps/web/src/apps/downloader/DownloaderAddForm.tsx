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
    <div className="dl-add-form">
      <div className="dl-field">
        <label>下载链接</label>
        <textarea
          value={taskUrl}
          onChange={(event) => onTaskUrlChange(event.target.value)}
          placeholder={'输入视频 URL（YouTube、Bilibili 等）\n支持多行，每行一个链接'}
          rows={4}
          style={{ resize: 'vertical', minHeight: '80px' }}
        />
        <small className="dl-field-hint">平台与任务通道会按链接自动识别并分流；检测到字幕时，仅下载一份原始语言的 SRT 字幕。</small>
      </div>

      <div className="dl-form-row">
        <div className="dl-field dl-field--path">
          <label>目标目录</label>
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
        <div className="dl-field">
          <label>登录态</label>
          <select
            value={taskCookieBrowser}
            onChange={(event) => onTaskCookieBrowserChange(event.target.value as CookieBrowser)}
          >
            <option value="none">不使用浏览器登录态</option>
            <option value="chrome">Chrome</option>
            <option value="edge">Edge</option>
            <option value="safari">Safari</option>
            <option value="firefox">Firefox</option>
          </select>
          <small className="dl-field-hint">遇到 YouTube 登录或机器人验证时，选择已登录的浏览器。使用浏览器登录态前需完全退出该浏览器，否则无法读取 Cookie；公开视频通常无需登录态。</small>
        </div>
      </div>

      <div className="dl-field dl-compatible-format">
        <label className="dl-checkbox-label">
          <input
            type="checkbox"
            checked={taskCompatibleFormat}
            onChange={(event) => onTaskCompatibleFormatChange(event.target.checked)}
          />
          <span>兼容格式（H.264 / MP4）</span>
        </label>
        <small className="dl-field-hint">
          默认下载最高规格、不转码，并在合并音视频时优先使用 MKV 封装。勾选后会先下载最高规格，再转码为 H.264 / MP4。
        </small>
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
