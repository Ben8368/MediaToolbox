import type { WebComposerFontWeight, WebComposerNumberControl } from '@mediatoolbox/contracts'

export const webComposerFontOptions = [
  { label: '系统无衬线', value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { label: 'Instrument Serif', value: "'Instrument Serif', serif" },
  { label: 'Figtree', value: "'Figtree', sans-serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Helvetica Now Display', value: "'Helvetica Now Display Bold', 'Inter', sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: '微软雅黑 / 苹方', value: "'Microsoft YaHei', 'PingFang SC', sans-serif" },
] as const

const commonFontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128, 144, 160, 192, 224, 256, 288, 320]

export function getFontOptions(currentValue: string | null) {
  if (!currentValue || webComposerFontOptions.some((option) => option.value === currentValue)) {
    return webComposerFontOptions
  }
  return [{ label: '当前自定义字体', value: currentValue }, ...webComposerFontOptions]
}

export function getFontSizeOptions(control: WebComposerNumberControl, currentValue: number | null) {
  const options = commonFontSizes.filter((size) => (
    size >= control.min
    && size <= control.max
    && Number.isInteger((size - control.min) / control.step)
  ))
  if (currentValue !== null && currentValue >= control.min && currentValue <= control.max && !options.includes(currentValue)) {
    options.push(currentValue)
    options.sort((left, right) => left - right)
  }
  return options
}

const fontWeightNames: Record<WebComposerFontWeight, string> = {
  100: '极细',
  200: '纤细',
  300: '细体',
  400: '常规',
  500: '中等',
  600: '半粗',
  700: '粗体',
  800: '特粗',
  900: '黑体',
}

export function fontWeightLabel(weight: WebComposerFontWeight) {
  return `${weight} · ${fontWeightNames[weight]}`
}
