import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { FastifyInstance } from 'fastify'
import type { FontEntry, FontsListResponse } from '@mediatoolbox/contracts'

const execFileAsync = promisify(execFile)

let fontsCache: FontEntry[] | null = null

async function scanWindows(): Promise<FontEntry[]> {
  const { stdout } = await execFileAsync(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Add-Type -AssemblyName System.Drawing; [System.Drawing.Text.InstalledFontCollection]::new().Families | Select-Object -ExpandProperty Name',
    ],
    { timeout: 8000 },
  )
  return stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((family) => ({ postScriptName: family.replace(/\s+/g, ''), family, style: 'Regular' }))
}

async function scanMac(): Promise<FontEntry[]> {
  const { stdout } = await execFileAsync(
    'fc-list',
    ['--format', '%{family}:%{postscriptname}:%{style}\n'],
    { timeout: 8000 },
  )
  const seen = new Set<string>()
  const fonts: FontEntry[] = []
  for (const line of stdout.split('\n')) {
    const parts = line.split(':')
    const family = (parts[0] ?? '').split(',')[0]?.trim() ?? ''
    if (!family) continue
    const style = (parts[2] ?? '').split(',')[0]?.trim() || 'Regular'
    const key = `${family}\0${style}`
    if (seen.has(key)) continue
    seen.add(key)
    fonts.push({
      postScriptName: (parts[1] ?? '').split(',')[0]?.trim() || family.replace(/\s+/g, ''),
      family,
      style,
    })
  }
  return fonts.sort((a, b) => a.family.localeCompare(b.family))
}

async function getSystemFonts(): Promise<FontEntry[]> {
  if (fontsCache) return fontsCache
  try {
    const fonts = process.platform === 'win32' ? await scanWindows() : await scanMac()
    fontsCache = fonts
    return fonts
  } catch {
    return []
  }
}

export function registerFontsRoutes(app: FastifyInstance) {
  app.get<{ Reply: FontsListResponse }>('/api/fonts/system', async () => {
    const fonts = await getSystemFonts()
    return { ok: true, fonts }
  })
}
