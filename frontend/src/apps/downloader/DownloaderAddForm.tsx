import { PLATFORM_OPTIONS } from '@/apps/downloader/constants'
import type { CookieBrowser, DownloadPlatform, PlatformOption, SubtitleFormat } from '@/apps/downloader/types'

type DownloaderAddFormProps = {
  taskUrl: string
  taskPlatform: DownloadPlatform
  taskSubtitles: boolean
  taskOutputDir: string
  taskCookieBrowser: CookieBrowser
  taskPreferH264: boolean
  taskNoTranscode: boolean
  taskSubtitleFormat: SubtitleFormat
  selectedPlatform: PlatformOption
  addingTask: boolean
  submitError: string
  onTaskUrlChange: (value: string) => void
  onTaskPlatformChange: (value: DownloadPlatform) => void
  onTaskSubtitlesChange: (value: boolean) => void
  onTaskOutputDirChange: (value: string) => void
  onTaskCookieBrowserChange: (value: CookieBrowser) => void
  onTaskPreferH264Change: (value: boolean) => void
  onTaskNoTranscodeChange: (value: boolean) => void
  onTaskSubtitleFormatChange: (value: SubtitleFormat) => void
  onOpenDirectoryPicker: () => void
  onSubmit: () => void
  onClose: () => void
}

export function DownloaderAddForm({
  taskUrl,
  taskPlatform,
  taskSubtitles,
  taskOutputDir,
  taskCookieBrowser,
  taskPreferH264,
  taskNoTranscode,
  taskSubtitleFormat,
  selectedPlatform,
  addingTask,
  submitError,
  onTaskUrlChange,
  onTaskPlatformChange,
  onTaskSubtitlesChange,
  onTaskOutputDirChange,
  onTaskCookieBrowserChange,
  onTaskPreferH264Change,
  onTaskNoTranscodeChange,
  onTaskSubtitleFormatChange,
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
      </div>

      <div className="dl-form-row">
        <div className="dl-field">
          <label>平台</label>
          <select value={taskPlatform} onChange={(event) => onTaskPlatformChange(event.target.value as DownloadPlatform)}>
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="dl-field-hint">{selectedPlatform.hint}</small>
        </div>
        <div className="dl-field">
          <label>字幕</label>
          <select
            value={String(selectedPlatform.supportsSubtitles ? taskSubtitles : false)}
            disabled={!selectedPlatform.supportsSubtitles}
            onChange={(event) => onTaskSubtitlesChange(event.target.value === 'true')}
          >
            {selectedPlatform.supportsSubtitles ? (
              <>
                <option value="true">下载字幕</option>
                <option value="false">仅视频</option>
              </>
            ) : (
              <option value="false">当前平台不提供字幕</option>
            )}
          </select>
          {!selectedPlatform.supportsSubtitles && (
            <small className="dl-field-hint">已自动切换为仅视频，适合大多数短视频平台。</small>
          )}
        </div>
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
            <option value="safari">Safari</option>
            <option value="firefox">Firefox</option>
          </select>
          <small className="dl-field-hint">
            遇到 YouTube 登录或机器人验证时，选择已登录的浏览器。使用浏览器登录态前需完全退出该浏览器，否则无法读取 Cookie；公开视频通常无需登录态。
          </small>
        </div>
      </div>

      <div className="dl-form-row">
        <div className="dl-field">
          <label>视频编码</label>
          <select
            value={String(taskPreferH264)}
            disabled={taskNoTranscode}
            onChange={(event) => onTaskPreferH264Change(event.target.value === 'true')}
          >
            <option value="true">优先 H264（兼容性好）</option>
            <option value="false">最高规格原始编码</option>
          </select>
          <small className="dl-field-hint">
            {taskNoTranscode
              ? '已选"不转码"，将保留最高规格原始编码。'
              : '优先选已是 H264 的最高规格；若最高规格非 H264，则下载后转码为 H264/MP4。'}
          </small>
        </div>
        <div className="dl-field">
          <label>转码</label>
          <select value={String(taskNoTranscode)} onChange={(event) => onTaskNoTranscodeChange(event.target.value === 'true')}>
            <option value="false">按需转码为 H264/MP4</option>
            <option value="true">不转码（保留原始格式）</option>
          </select>
          <small className="dl-field-hint">选择"不转码"可加快完成，但可能得到 VP9/AV1 等编码。</small>
        </div>
      </div>

      <div className="dl-form-row">
        <div className="dl-field">
          <label>字幕格式</label>
          <select
            value={taskSubtitleFormat}
            disabled={!selectedPlatform.supportsSubtitles || !taskSubtitles}
            onChange={(event) => onTaskSubtitleFormatChange(event.target.value as SubtitleFormat)}
          >
            <option value="srt">SRT（默认，通用）</option>
            <option value="vtt">VTT（原始，不转换）</option>
          </select>
          <small className="dl-field-hint">
            {!selectedPlatform.supportsSubtitles || !taskSubtitles
              ? '未启用字幕下载时此项不生效。'
              : 'YouTube 字幕通常为 VTT，默认自动转为 SRT。'}
          </small>
        </div>
        <div className="dl-field" />
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
