import { useId, useState, type ChangeEvent } from 'react'
import type {
  WebComposerFontWeight,
  WebComposerNumberControl,
  WebComposerPresetState,
  WebComposerSlotContentKind,
  WebComposerSlotManifest,
  WebComposerSlotValue,
  WebComposerTextContent,
} from '@mediatoolbox/contracts'

import { filebrowserFileDownloadUrl, uploadFilebrowserFile } from '@/api'
import type { WebComposerSlotRect } from './previewMessages'
import { webComposerIconLabels } from './WebComposerIcon'
import { fontWeightLabel, getFontOptions, getFontSizeOptions } from './typographyOptions'
import {
  clampSlotNumber,
  setSlotActiveKind,
  setSlotOffset,
  setSlotVisibility,
  updateSlotIcon,
  updateSlotImage,
  updateSlotMedia,
  updateSlotText,
} from './slotState'

export type WebComposerSlotMetrics = WebComposerSlotRect

const contentKinds: readonly WebComposerSlotContentKind[] = ['text', 'icon', 'image', 'media']
const kindLabels: Record<WebComposerSlotContentKind, string> = {
  text: '文案',
  icon: '图标',
  image: '图片',
  media: '媒体',
}

function NullableNumberField({
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
      <input
        type="number"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value ?? ''}
        placeholder="预设"
        onChange={(event) => {
          const rawValue = event.currentTarget.value
          onChange(rawValue === '' ? null : clampSlotNumber(Number(rawValue), control))
        }}
      />
    </label>
  )
}

function NullableNumberSelect({
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

function ColorOverride({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string | null
  fallback: string
  onChange: (value: string | null) => void
}) {
  const labelId = useId()
  return (
    <div className="wc-context-field">
      <span id={labelId}>{label}</span>
      <span className="wc-context-color wc-context-color--override">
        <input aria-labelledby={labelId} type="color" value={value ?? fallback} onChange={(event) => onChange(event.currentTarget.value)} />
        <output>{value ?? '继承主题'}</output>
        <button
          type="button"
          aria-label={`使${label}继承主题`}
          disabled={value === null}
          onClick={() => onChange(null)}
        >
          继承
        </button>
      </span>
    </div>
  )
}

function hasCandidate(value: WebComposerSlotValue, kind: WebComposerSlotContentKind) {
  return value[kind] !== undefined
}

export function WebComposerSlotEditor({
  slot,
  value,
  state,
  metrics,
  onStateChange,
  onTextChange,
}: {
  slot: WebComposerSlotManifest
  value: WebComposerSlotValue
  state: WebComposerPresetState
  metrics?: WebComposerSlotMetrics | null
  onStateChange: (state: WebComposerPresetState) => void
  onTextChange?: (slotId: string, patch: Partial<WebComposerTextContent>) => void
}) {
  const titleId = useId()
  const [uploadStatus, setUploadStatus] = useState('')
  const allowedKinds = contentKinds.filter((kind) => slot.editors[kind] && hasCandidate(value, kind))
  const activeKind = value.activeKind

  const handleUpload = async (target: 'image' | 'media', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setUploadStatus(`正在导入 ${file.name}…`)
    try {
      const result = await uploadFilebrowserFile('/Workspace', file)
      if (!result.ok || !result.path) throw new Error(result.message || '素材导入失败。')
      const src = filebrowserFileDownloadUrl(result.path)
      if (target === 'image') {
        onStateChange(updateSlotImage(state, slot.id, { src }))
      } else {
        const mediaEditor = slot.editors.media
        const detectedKind = file.type.startsWith('video/') ? 'video' : 'image'
        const kind = mediaEditor?.kinds.includes(detectedKind)
          ? detectedKind
          : (mediaEditor?.kinds[0] ?? detectedKind)
        onStateChange(updateSlotMedia(state, slot.id, { src, kind }))
      }
      setUploadStatus(`已导入：${result.name || file.name}`)
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : '素材导入失败。')
    }
  }

  const textEditor = slot.editors.text
  const iconEditor = slot.editors.icon
  const imageEditor = slot.editors.image
  const mediaEditor = slot.editors.media

  return (
    <section className="wc-context-section wc-slot-editor" aria-labelledby={titleId}>
      <div className="wc-context-heading wc-slot-heading">
        <span>
          <strong id={titleId}>{slot.label}</strong>
          <small>{slot.group} · {slot.id}</small>
        </span>
        <span>{kindLabels[activeKind]}</span>
      </div>

      {!value.visible && (
        <div className="wc-slot-hidden-note" role="status">
          此元素已隐藏，仍可在这里编辑或重新显示。
        </div>
      )}

      {metrics && (
        <dl className="wc-slot-metrics" aria-label="元素设计坐标">
          <div><dt>X</dt><dd>{Math.round(metrics.x)}</dd></div>
          <div><dt>Y</dt><dd>{Math.round(metrics.y)}</dd></div>
          <div><dt>宽</dt><dd>{Math.round(metrics.width)}</dd></div>
          <div><dt>高</dt><dd>{Math.round(metrics.height)}</dd></div>
        </dl>
      )}

      {allowedKinds.length > 1 && (
        <label className="wc-context-field">
          <span>内容类型</span>
          <select
            value={activeKind}
            onChange={(event) => onStateChange(setSlotActiveKind(
              state,
              slot.id,
              event.currentTarget.value as WebComposerSlotContentKind,
            ))}
          >
            {allowedKinds.map((kind) => <option key={kind} value={kind}>{kindLabels[kind]}</option>)}
          </select>
        </label>
      )}

      {activeKind === 'text' && textEditor && value.text && (
        <div className="wc-context-fields">
          <label className="wc-context-field">
            <span>具体文案</span>
            {textEditor.multiline ? (
              <textarea
                value={value.text.value}
                maxLength={textEditor.maxLength}
                onChange={(event) => onTextChange
                  ? onTextChange(slot.id, { value: event.currentTarget.value })
                  : onStateChange(updateSlotText(state, slot.id, { value: event.currentTarget.value }))}
              />
            ) : (
              <input
                value={value.text.value}
                maxLength={textEditor.maxLength}
                onChange={(event) => onTextChange
                  ? onTextChange(slot.id, { value: event.currentTarget.value })
                  : onStateChange(updateSlotText(state, slot.id, { value: event.currentTarget.value }))}
              />
            )}
          </label>
          {textEditor.fontFamily && (
            <label className="wc-context-field">
              <span>字体</span>
              <select
                value={value.text.fontFamily ?? ''}
                onChange={(event) => onStateChange(updateSlotText(state, slot.id, {
                  fontFamily: event.currentTarget.value || null,
                }))}
              >
                <option value="">{slot.fontRole === 'heading' ? '继承标题字体' : '继承正文字体'}</option>
                {getFontOptions(value.text.fontFamily).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
          <div className="wc-context-grid wc-context-grid--two">
            {textEditor.fontSize && (
              <NullableNumberSelect
                label="设计字号"
                value={value.text.fontSize}
                control={textEditor.fontSize}
                onChange={(fontSize) => onStateChange(updateSlotText(state, slot.id, { fontSize }))}
              />
            )}
            {textEditor.fontWeight && (
              <label className="wc-context-field">
                <span>字重</span>
                <select
                  value={value.text.fontWeight ?? ''}
                  onChange={(event) => onStateChange(updateSlotText(state, slot.id, {
                    fontWeight: event.currentTarget.value
                      ? Number(event.currentTarget.value) as WebComposerFontWeight
                      : null,
                  }))}
                >
                  <option value="">继承预设</option>
                  {textEditor.fontWeight.map((weight) => <option key={weight} value={weight}>{fontWeightLabel(weight)}</option>)}
                </select>
              </label>
            )}
          </div>
          {textEditor.color && (
            <ColorOverride
              label="文字颜色"
              value={value.text.color}
              fallback={state.theme.textColor}
              onChange={(color) => onStateChange(updateSlotText(state, slot.id, { color }))}
            />
          )}
        </div>
      )}

      {activeKind === 'icon' && iconEditor && value.icon && (
        <div className="wc-context-fields">
          <label className="wc-context-field">
            <span>内置图标</span>
            <select
              value={value.icon.iconId}
              onChange={(event) => onStateChange(updateSlotIcon(state, slot.id, {
                iconId: event.currentTarget.value as typeof value.icon.iconId,
              }))}
            >
              {iconEditor.iconIds.map((iconId) => <option key={iconId} value={iconId}>{webComposerIconLabels[iconId]}</option>)}
            </select>
          </label>
          {iconEditor.size && (
            <NullableNumberField
              label="图标尺寸"
              value={value.icon.size}
              control={iconEditor.size}
              onChange={(size) => onStateChange(updateSlotIcon(state, slot.id, { size }))}
            />
          )}
          {iconEditor.color && (
            <ColorOverride
              label="图标颜色"
              value={value.icon.color}
              fallback={state.theme.accentColor}
              onChange={(color) => onStateChange(updateSlotIcon(state, slot.id, { color }))}
            />
          )}
        </div>
      )}

      {activeKind === 'image' && imageEditor && value.image && (
        <div className="wc-context-fields">
          <label className="wc-context-field"><span>图片 URL</span><textarea value={value.image.src} onChange={(event) => onStateChange(updateSlotImage(state, slot.id, { src: event.currentTarget.value }))} /></label>
          <label className="wc-context-field"><span>替代文本</span><input value={value.image.alt} onChange={(event) => onStateChange(updateSlotImage(state, slot.id, { alt: event.currentTarget.value }))} /></label>
          <div className="wc-context-grid wc-context-grid--two">
            {imageEditor.width && <NullableNumberField label="宽度" value={value.image.width} control={imageEditor.width} onChange={(width) => onStateChange(updateSlotImage(state, slot.id, { width }))} />}
            {imageEditor.height && <NullableNumberField label="高度" value={value.image.height} control={imageEditor.height} onChange={(height) => onStateChange(updateSlotImage(state, slot.id, { height }))} />}
          </div>
          {imageEditor.fit && <label className="wc-context-field"><span>填充方式</span><select value={value.image.fit} onChange={(event) => onStateChange(updateSlotImage(state, slot.id, { fit: event.currentTarget.value as 'contain' | 'cover' }))}>{imageEditor.fit.map((fit) => <option key={fit} value={fit}>{fit}</option>)}</select></label>}
          <label className="wc-context-upload">从工作区替换图片<input className="wc-visually-hidden" type="file" accept={imageEditor.accept} onChange={(event) => void handleUpload('image', event)} /></label>
        </div>
      )}

      {activeKind === 'media' && mediaEditor && value.media && (
        <div className="wc-context-fields">
          <label className="wc-context-field"><span>媒体类型</span><select value={value.media.kind} onChange={(event) => onStateChange(updateSlotMedia(state, slot.id, { kind: event.currentTarget.value as 'image' | 'video' }))}>{mediaEditor.kinds.map((kind) => <option key={kind} value={kind}>{kind === 'video' ? '视频' : '图片'}</option>)}</select></label>
          <label className="wc-context-field"><span>素材 URL</span><textarea value={value.media.src} onChange={(event) => onStateChange(updateSlotMedia(state, slot.id, { src: event.currentTarget.value }))} /></label>
          {mediaEditor.fit && <label className="wc-context-field"><span>填充方式</span><select value={value.media.fit} onChange={(event) => onStateChange(updateSlotMedia(state, slot.id, { fit: event.currentTarget.value as 'contain' | 'cover' }))}>{mediaEditor.fit.map((fit) => <option key={fit} value={fit}>{fit}</option>)}</select></label>}
          <label className="wc-context-upload">从工作区替换素材<input className="wc-visually-hidden" type="file" accept={mediaEditor.accept} onChange={(event) => void handleUpload('media', event)} /></label>
        </div>
      )}

      {uploadStatus && <p className="wc-context-status" aria-live="polite">{uploadStatus}</p>}

      {slot.offset && (
        <div className="wc-context-subsection">
          <div className="wc-context-heading"><strong>位置微调</strong><span>设计坐标</span></div>
          <div className="wc-context-grid wc-context-grid--two">
            {(['x', 'y'] as const).map((axis) => (
              <label className="wc-context-field" key={axis}>
                <span>{axis.toUpperCase()} 轴偏移</span>
                <input
                  type="number"
                  min={slot.offset?.[axis].min}
                  max={slot.offset?.[axis].max}
                  step={slot.offset?.[axis].step}
                  value={value.offset[axis]}
                  onChange={(event) => {
                    if (event.currentTarget.value === '') return
                    onStateChange(setSlotOffset(
                      state,
                      slot.id,
                      axis,
                      Number(event.currentTarget.value),
                      slot.offset![axis],
                    ))
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {slot.canHide && (
        <label className="wc-context-visibility">
          <input type="checkbox" checked={value.visible} onChange={(event) => onStateChange(setSlotVisibility(state, slot.id, event.currentTarget.checked))} />
          <span>在画布和导出结果中显示此元素</span>
        </label>
      )}
    </section>
  )
}
