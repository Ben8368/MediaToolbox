/**
 * photoshop/operations — 高层 Photoshop 操作接口
 * 封装常见的 PS 自动化操作，供 worker 调用
 */
import { resolve, join, dirname } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { runPhotoshopScript } from './executor.js'

const SCRIPTS_DIR = resolve(process.cwd(), 'scripts/ps')

export interface ReplaceTextOptions {
  psdPath: string
  outputPath: string
  replacements: Array<{
    layerName: string
    oldText?: string
    newText: string
  }>
  timeoutMs?: number
}

export interface TranslateLayersOptions {
  psdPath: string
  outputPath: string
  layerNames: string[]
  targetLanguage: string
  timeoutMs?: number
}

export interface ReplaceImageOptions {
  psdPath: string
  outputPath: string
  replacements: Array<{
    layerName: string
    imagePath: string
  }>
  timeoutMs?: number
}

export interface ChangeFontOptions {
  psdPath: string
  outputPath: string
  layerNames: string[]
  fontFamily: string
  fontSize?: number
  timeoutMs?: number
}

/**
 * 替换 PSD 文件中的文案
 */
export async function replaceText(options: ReplaceTextOptions): Promise<void> {
  const { psdPath, outputPath, replacements, timeoutMs = 10 * 60 * 1000 } = options

  // 校验输入文件存在
  if (!existsSync(psdPath)) {
    throw new Error(`PSD 文件不存在: ${psdPath}`)
  }

  // 确保输出目录存在
  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const scriptPath = join(SCRIPTS_DIR, 'replaceText.jsx')
  const handle = runPhotoshopScript({
    scriptPath,
    params: {
      psdPath,
      outputPath,
      replacements,
    },
    timeoutMs,
  })

  const result = await handle.promise

  if (result.exitCode !== 0) {
    throw new Error(`Photoshop 脚本执行失败 (exit ${result.exitCode}): ${result.stderr || result.stdout}`)
  }
}

/**
 * 翻译图层文案
 */
export async function translateLayers(options: TranslateLayersOptions): Promise<void> {
  const { psdPath, outputPath, layerNames, targetLanguage, timeoutMs = 10 * 60 * 1000 } = options

  if (!existsSync(psdPath)) {
    throw new Error(`PSD 文件不存在: ${psdPath}`)
  }

  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const scriptPath = join(SCRIPTS_DIR, 'translateLayers.jsx')
  const handle = runPhotoshopScript({
    scriptPath,
    params: {
      psdPath,
      outputPath,
      layerNames,
      targetLanguage,
    },
    timeoutMs,
  })

  const result = await handle.promise

  if (result.exitCode !== 0) {
    throw new Error(`Photoshop 脚本执行失败 (exit ${result.exitCode}): ${result.stderr || result.stdout}`)
  }
}

/**
 * 替换图层图片
 */
export async function replaceImage(options: ReplaceImageOptions): Promise<void> {
  const { psdPath, outputPath, replacements, timeoutMs = 10 * 60 * 1000 } = options

  if (!existsSync(psdPath)) {
    throw new Error(`PSD 文件不存在: ${psdPath}`)
  }

  // 校验所有替换图片存在
  for (const { imagePath } of replacements) {
    if (!existsSync(imagePath)) {
      throw new Error(`替换图片不存在: ${imagePath}`)
    }
  }

  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const scriptPath = join(SCRIPTS_DIR, 'replaceImage.jsx')
  const handle = runPhotoshopScript({
    scriptPath,
    params: {
      psdPath,
      outputPath,
      replacements,
    },
    timeoutMs,
  })

  const result = await handle.promise

  if (result.exitCode !== 0) {
    throw new Error(`Photoshop 脚本执行失败 (exit ${result.exitCode}): ${result.stderr || result.stdout}`)
  }
}

/**
 * 修改图层字体
 */
export async function changeFont(options: ChangeFontOptions): Promise<void> {
  const { psdPath, outputPath, layerNames, fontFamily, fontSize, timeoutMs = 10 * 60 * 1000 } = options

  if (!existsSync(psdPath)) {
    throw new Error(`PSD 文件不存在: ${psdPath}`)
  }

  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const scriptPath = join(SCRIPTS_DIR, 'changeFont.jsx')
  const handle = runPhotoshopScript({
    scriptPath,
    params: {
      psdPath,
      outputPath,
      layerNames,
      fontFamily,
      fontSize,
    },
    timeoutMs,
  })

  const result = await handle.promise

  if (result.exitCode !== 0) {
    throw new Error(`Photoshop 脚本执行失败 (exit ${result.exitCode}): ${result.stderr || result.stdout}`)
  }
}
