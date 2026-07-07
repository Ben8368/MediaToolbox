import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type CheckLevel = 'ok' | 'warn' | 'fail'

type ReleaseCheck = {
  level: CheckLevel
  label: string
  detail?: string
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict') || process.env.MEDIATOOLBOX_RELEASE_STRICT === '1'

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(rootDir, relativePath))
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8')) as T
}

function checkExists(label: string, relativePath: string): ReleaseCheck {
  return exists(relativePath)
    ? { level: 'ok', label, detail: relativePath }
    : { level: 'fail', label, detail: `Missing ${relativePath}` }
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

type DesktopPackage = {
  build?: {
    appId?: string
    productName?: string
    artifactName?: string
    files?: string[]
    extraResources?: Array<{ from?: string; to?: string }>
    win?: { target?: unknown }
    mac?: { target?: unknown; category?: string }
    linux?: { target?: unknown; category?: string }
  }
}

const desktopPackage = readJson<DesktopPackage>('apps/desktop/package.json')
const build = desktopPackage.build ?? {}
const extraResources = build.extraResources ?? []

const checks: ReleaseCheck[] = [
  build.appId ? { level: 'ok', label: 'Electron appId', detail: build.appId } : { level: 'fail', label: 'Electron appId', detail: 'build.appId is required.' },
  build.productName ? { level: 'ok', label: 'Product name', detail: build.productName } : { level: 'fail', label: 'Product name', detail: 'build.productName is required.' },
  build.artifactName ? { level: 'ok', label: 'Artifact naming', detail: build.artifactName } : { level: 'warn', label: 'Artifact naming', detail: 'build.artifactName is not configured.' },
  Array.isArray(build.files) && build.files.includes('dist/**/*')
    ? { level: 'ok', label: 'Desktop dist included', detail: 'dist/**/*' }
    : { level: 'fail', label: 'Desktop dist included', detail: 'build.files must include dist/**/*.' },
  extraResources.some((item) => item.from === '../../apps/web/dist' && item.to === 'renderer')
    ? { level: 'ok', label: 'Renderer resource bundle', detail: '../../apps/web/dist -> renderer' }
    : { level: 'fail', label: 'Renderer resource bundle', detail: 'apps/web/dist must be packaged as renderer.' },
  extraResources.some((item) => item.from === '../../apps/api/dist' && item.to === 'api')
    ? { level: 'ok', label: 'API runtime bundle', detail: '../../apps/api/dist -> api' }
    : { level: 'fail', label: 'API runtime bundle', detail: 'apps/api/dist must be packaged as api.' },
  build.win?.target ? { level: 'ok', label: 'Windows target configured' } : { level: 'fail', label: 'Windows target configured' },
  build.mac?.target ? { level: 'ok', label: 'macOS target configured' } : { level: 'fail', label: 'macOS target configured' },
  build.linux?.target ? { level: 'ok', label: 'Linux target configured' } : { level: 'fail', label: 'Linux target configured' },
  checkExists('Renderer build output', 'apps/web/dist/index.html'),
  checkExists('API production runtime', 'apps/api/dist/server.cjs'),
  checkExists('Desktop main process build', 'apps/desktop/dist/main.js'),
  checkExists('Desktop preload source', 'apps/desktop/src/preload.cjs'),
  checkExists('Shared app icon source', 'apps/web/public/static/app/icons/default/setting.png'),
  hasAnyEnv(['CSC_LINK', 'CSC_NAME'])
    ? { level: 'ok', label: 'Code signing identity', detail: 'CSC_LINK/CSC_NAME detected.' }
    : { level: 'warn', label: 'Code signing identity', detail: 'Set CSC_LINK or CSC_NAME before signed release builds.' },
  hasAnyEnv(['APPLE_ID']) && hasAnyEnv(['APPLE_APP_SPECIFIC_PASSWORD']) && hasAnyEnv(['APPLE_TEAM_ID'])
    ? { level: 'ok', label: 'macOS notarization credentials', detail: 'APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID detected.' }
    : { level: 'warn', label: 'macOS notarization credentials', detail: 'Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID before notarized macOS releases.' },
]

let failures = checks.filter((check) => check.level === 'fail').length
const warnings = checks.filter((check) => check.level === 'warn').length
if (strict) failures += warnings

console.log('MediaToolbox release preflight')
for (const check of checks) {
  const marker = check.level === 'ok' ? '[OK]' : check.level === 'warn' ? '[WARN]' : '[FAIL]'
  console.log(`${marker} ${check.label}${check.detail ? ` - ${check.detail}` : ''}`)
}

if (failures > 0) {
  console.error(strict
    ? `Release preflight failed with ${failures} blocking issue(s); strict mode treats warnings as failures.`
    : `Release preflight failed with ${failures} blocking issue(s).`)
  process.exitCode = 1
} else if (warnings > 0) {
  console.warn(`Release preflight passed with ${warnings} warning(s).`)
} else {
  console.log('Release preflight passed.')
}
