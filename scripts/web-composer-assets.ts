import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

type AssetFile = {
  path: string
  size: number
  sha256: string
}

type AssetManifest = {
  schemaVersion: 1
  packageVersion: string
  installPath: string
  release: {
    repository: string
    tag: string
    assetName: string
    downloadUrl: string
    sha256: string
  }
  files: AssetFile[]
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(rootDir, 'assets', 'web-composer', 'manifest.json')
const artifactDir = path.join(rootDir, '.artifacts', 'web-composer')

async function readManifest(): Promise<AssetManifest> {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as AssetManifest
  if (manifest.schemaVersion !== 1 || !manifest.files.length) {
    throw new Error('Web Composer 素材清单无效。')
  }
  const paths = new Set<string>()
  for (const asset of manifest.files) {
    const isFlatFile = asset.path === path.basename(asset.path)
      && !asset.path.includes('\\')
      && asset.path.endsWith('.mp4')
    if (!isFlatFile || paths.has(asset.path) || asset.size <= 0 || !/^[a-f0-9]{64}$/u.test(asset.sha256)) {
      throw new Error(`Web Composer 素材条目无效：${asset.path}`)
    }
    paths.add(asset.path)
  }
  return manifest
}

function resolveInstallDirectory(manifest: AssetManifest): string {
  const directory = path.resolve(rootDir, manifest.installPath)
  if (!directory.startsWith(`${rootDir}${path.sep}`)) throw new Error('Web Composer 素材安装路径越界。')
  return directory
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  const input = await fs.open(filePath, 'r')
  try {
    for await (const chunk of input.createReadStream()) hash.update(chunk)
  } finally {
    await input.close()
  }
  return hash.digest('hex')
}

async function verifyDirectory(directory: string, manifest: AssetManifest): Promise<string[]> {
  const errors: string[] = []
  for (const asset of manifest.files) {
    const filePath = path.join(directory, asset.path)
    try {
      const stat = await fs.lstat(filePath)
      if (!stat.isFile()) {
        errors.push(`${asset.path}: 不是文件`)
        continue
      }
      if (stat.size !== asset.size) {
        errors.push(`${asset.path}: 大小应为 ${asset.size}，实际为 ${stat.size}`)
        continue
      }
      const actualHash = await sha256(filePath)
      if (actualHash !== asset.sha256) errors.push(`${asset.path}: SHA-256 不匹配`)
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN'
      errors.push(`${asset.path}: ${code === 'ENOENT' ? '文件缺失' : code}`)
    }
  }
  return errors
}

async function requireValidDirectory(directory: string, manifest: AssetManifest): Promise<void> {
  const errors = await verifyDirectory(directory, manifest)
  if (errors.length > 0) throw new Error(`Web Composer 素材校验失败：\n- ${errors.join('\n- ')}`)
}

function runTar(args: string[]): string {
  const result = spawnSync('tar', args, { encoding: 'utf8', windowsHide: true })
  if (result.error) throw new Error(`无法运行 tar：${result.error.message}`)
  if (result.status !== 0) throw new Error(`tar 执行失败：${result.stderr.trim() || result.stdout.trim()}`)
  return result.stdout
}

function normalizeArchiveEntry(entry: string): string {
  return entry.trim().replaceAll('\\', '/').replace(/^\.\//, '')
}

function validateArchiveEntries(archivePath: string, manifest: AssetManifest): void {
  const expected = new Set(manifest.files.map((asset) => asset.path))
  const entries = runTar(['-tzf', archivePath])
    .split(/\r?\n/u)
    .map(normalizeArchiveEntry)
    .filter(Boolean)

  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('../') || path.win32.isAbsolute(entry)) {
      throw new Error(`素材包包含不安全路径：${entry}`)
    }
    if (!expected.delete(entry)) throw new Error(`素材包包含未声明文件：${entry}`)
  }
  if (expected.size > 0) throw new Error(`素材包缺少文件：${[...expected].join(', ')}`)
}

async function copySource(source: string, destination: string): Promise<void> {
  if (/^https?:\/\//iu.test(source)) {
    const response = await fetch(source, { redirect: 'follow' })
    if (!response.ok || !response.body) throw new Error(`素材包下载失败：HTTP ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
    return
  }

  const localPath = source.startsWith('file://') ? fileURLToPath(source) : path.resolve(rootDir, source)
  await fs.copyFile(localPath, destination)
}

async function install(manifest: AssetManifest): Promise<void> {
  if (!/^[a-f0-9]{64}$/u.test(manifest.release.sha256)) {
    throw new Error('素材清单尚未写入有效的 Release Asset SHA-256。')
  }

  const source = process.env.MEDIATOOLBOX_WEB_COMPOSER_ASSET_SOURCE?.trim()
    || manifest.release.downloadUrl
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mediatoolbox-web-composer-assets-'))
  const archivePath = path.join(stagingRoot, manifest.release.assetName)
  const extractedDir = path.join(stagingRoot, 'extracted')
  try {
    console.log(`获取 Web Composer 素材包：${source}`)
    await copySource(source, archivePath)
    const archiveHash = await sha256(archivePath)
    if (archiveHash !== manifest.release.sha256) throw new Error('素材包 SHA-256 不匹配。')

    validateArchiveEntries(archivePath, manifest)
    await fs.mkdir(extractedDir, { recursive: true })
    runTar(['-xzf', archivePath, '-C', extractedDir])
    await requireValidDirectory(extractedDir, manifest)

    const targetDir = resolveInstallDirectory(manifest)
    await fs.mkdir(targetDir, { recursive: true })
    for (const asset of manifest.files) {
      await fs.copyFile(path.join(extractedDir, asset.path), path.join(targetDir, asset.path))
    }
    await requireValidDirectory(targetDir, manifest)
    console.log(`Web Composer 素材包 ${manifest.packageVersion} 已安装。`)
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true })
  }
}

async function pack(manifest: AssetManifest): Promise<void> {
  const sourceDir = resolveInstallDirectory(manifest)
  await requireValidDirectory(sourceDir, manifest)
  await fs.mkdir(artifactDir, { recursive: true })
  const archivePath = path.join(artifactDir, manifest.release.assetName)
  runTar(['-czf', archivePath, '-C', sourceDir, ...manifest.files.map((asset) => asset.path)])
  validateArchiveEntries(archivePath, manifest)
  const archiveHash = await sha256(archivePath)
  const stat = await fs.stat(archivePath)
  console.log(`素材包：${archivePath}`)
  console.log(`大小：${stat.size} bytes`)
  console.log(`SHA-256：${archiveHash}`)
}

async function main(): Promise<void> {
  const command = process.argv[2]
  const manifest = await readManifest()
  const installDir = resolveInstallDirectory(manifest)

  if (command === 'verify') {
    await requireValidDirectory(installDir, manifest)
    console.log(`Web Composer 素材包 ${manifest.packageVersion} 校验通过。`)
    return
  }
  if (command === 'ensure') {
    const errors = await verifyDirectory(installDir, manifest)
    if (errors.length === 0) {
      console.log(`Web Composer 素材包 ${manifest.packageVersion} 已就绪。`)
      return
    }
    console.warn(`本地素材缺失或无效，将重新安装：\n- ${errors.join('\n- ')}`)
    await install(manifest)
    return
  }
  if (command === 'install') {
    await install(manifest)
    return
  }
  if (command === 'pack') {
    await pack(manifest)
    return
  }
  throw new Error('用法：tsx scripts/web-composer-assets.ts <verify|ensure|install|pack>')
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
