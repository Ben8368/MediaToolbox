/**
 * argsBuilder — 根据提交参数拼装 yt-dlp 命令行参数
 *
 * 需求映射：
 *  1. 优先 H264 → -S "vcodec:h264,res,fps,acodec:aac" + preset mp4
 *  2. 最高规格非 H264 → --recode-video mp4 + --postprocessor-args 强制 libx264
 *  3. 字幕 VTT→SRT → --convert-subs srt
 *  4. 不转码 → 不加 recode 参数；subtitle_format vtt → 不加 convert-subs
 */
import { join, resolve, relative, isAbsolute } from 'node:path'
import type { SubmitFetchBody } from '../../types/task.js'

export interface BuiltArgs {
  /** yt-dlp 位置参数之前的所有选项（不含 URL） */
  args: string[]
  /** 输出模板，含输出目录 */
  outputTemplate: string
}

export function buildYtdlpArgs(body: SubmitFetchBody, workDir: string): BuiltArgs {
  const {
    output_dir,
    write_subs = false,
    write_auto_subs = false,
    sub_langs = 'original',
    prefer_h264 = true,
    no_transcode = false,
    subtitle_format = 'srt',
    cookies_from_browser,
  } = body

  // 安全：确保 output_dir 解析后的绝对路径仍在 workDir 内，防路径穿越
  let outDir: string
  if (output_dir) {
    const abs = resolve(workDir, output_dir)
    const rel = relative(workDir, abs)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`output_dir 路径越界: ${output_dir}`)
    }
    outDir = abs
  } else {
    outDir = join(workDir, 'downloads')
  }
  // %(title)s 用视频标题命名，%(ext)s 由 yt-dlp 自动填充
  const outputTemplate = join(outDir, '%(title)s.%(ext)s')

  const args: string[] = []

  // ── 进度与日志格式 ─────────────────────────────────────────────────────────
  // --newline 让每行进度输出一条，便于 stdout 逐行解析
  args.push('--newline', '--no-colors')

  // ── 视频格式选择 ───────────────────────────────────────────────────────────
  if (no_transcode) {
    // 需求4：不转码，直接按画质排序，合并输出 mp4 容器（如果流本身兼容的话 copy，不强制 recode）
    args.push('-S', 'res,fps', '--merge-output-format', 'mp4')
  } else if (prefer_h264) {
    // 需求1+2：优先 H264；若最高画质非 H264 则 yt-dlp 下载后自动 recode
    args.push('-S', 'vcodec:h264,res,fps,acodec:aac', '--merge-output-format', 'mp4')
    // --recode-video mp4 在编码不兼容时触发转码；
    // VideoConvertor:-c:v libx264 强制用 libx264 而非仅 remux
    args.push('--recode-video', 'mp4')
    args.push('--postprocessor-args', 'VideoConvertor:-c:v libx264 -c:a aac')
  } else {
    // prefer_h264=false, no_transcode=false：最高规格 + 封装成 mp4
    args.push('-S', 'res,fps', '--merge-output-format', 'mp4')
    args.push('--recode-video', 'mp4')
  }

  // ── 字幕 ──────────────────────────────────────────────────────────────────
  if (write_subs) {
    args.push('--write-subs')
  }
  if (write_auto_subs) {
    args.push('--write-auto-subs')
  }
  if (write_subs || write_auto_subs) {
    args.push('--sub-langs', sub_langs)
    // 需求3：默认 SRT；需求4：vtt 则不转换
    if (subtitle_format === 'srt') {
      args.push('--convert-subs', 'srt')
    }
  }

  // ── Cookie / 登录态 ────────────────────────────────────────────────────────
  if (cookies_from_browser && cookies_from_browser !== 'none') {
    args.push('--cookies-from-browser', cookies_from_browser)
  }

  // ── 输出路径 ───────────────────────────────────────────────────────────────
  args.push('-o', outputTemplate)

  return { args, outputTemplate }
}
