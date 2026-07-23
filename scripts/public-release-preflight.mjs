import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRootDir = path.resolve(import.meta.dirname, '..')
const requiredProvenanceFields = ['path', 'source', 'copyrightOwner', 'license', 'redistributionEvidence']

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export function runPublicReleasePreflight({ rootDir = defaultRootDir, logger = console } = {}) {
  const manifestPath = path.join(rootDir, 'assets/web-composer/manifest.json')
  const supplementalPath = path.join(rootDir, 'assets/web-composer/supplemental.json')
  const provenancePath = path.join(rootDir, 'assets/web-composer/PROVENANCE.json')
  const licensePath = path.join(rootDir, 'LICENSE')
  const failures = []
  const successes = []

  const fail = (message) => failures.push(message)
  const succeed = (message) => successes.push(message)

  if (!fs.existsSync(licensePath) || fs.statSync(licensePath).size === 0) {
    fail('根目录 LICENSE 缺失或为空。')
  } else {
    succeed('项目 LICENSE 已存在。')
  }

  if (!fs.existsSync(manifestPath)) {
    fail('assets/web-composer/manifest.json 缺失。')
  } else if (!fs.existsSync(provenancePath)) {
    fail('assets/web-composer/PROVENANCE.json 缺失，默认视频来源与再分发授权不可审计。')
  } else {
    try {
      const manifest = readJson(manifestPath)
      const provenance = readJson(provenancePath)
      const manifestEntries = Array.isArray(manifest.files) ? manifest.files : []
      const supplemental = fs.existsSync(supplementalPath) ? readJson(supplementalPath) : { files: [] }
      const supplementalEntries = Array.isArray(supplemental.files) ? supplemental.files : []
      const expectedEntries = [...manifestEntries, ...supplementalEntries]
      const entries = Array.isArray(provenance.files) ? provenance.files : []
      const expectedPathList = expectedEntries.map((entry) => entry?.path)
      const actualPathList = entries.map((entry) => entry?.path)
      const expectedPaths = new Set(expectedPathList)
      const actualPaths = new Set(actualPathList)

      if (manifestEntries.length === 0) fail('manifest 未声明任何默认素材。')
      if (expectedPathList.some((entryPath) => typeof entryPath !== 'string' || entryPath.trim() === '')) {
        fail('manifest 包含缺少有效 path 的素材条目。')
      }
      if (expectedPaths.size !== expectedEntries.length) fail('manifest 包含重复的素材路径。')
      if (actualPaths.size !== entries.length) fail('PROVENANCE 包含重复的素材路径。')

      for (const entry of entries) {
        for (const field of requiredProvenanceFields) {
          if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
            fail(`PROVENANCE 条目 ${entry?.path || '<unknown>'} 缺少 ${field}。`)
          }
        }
      }
      for (const expectedPath of expectedPaths) {
        if (typeof expectedPath === 'string' && !actualPaths.has(expectedPath)) {
          fail(`PROVENANCE 未覆盖素材：${expectedPath}`)
        }
      }
      for (const actualPath of actualPaths) {
        if (typeof actualPath === 'string' && !expectedPaths.has(actualPath)) {
          fail(`PROVENANCE 包含清单外素材：${actualPath}`)
        }
      }
      if (entries.length === expectedPaths.size && failures.length === 0) {
        succeed(`${entries.length} 个默认视频均有来源与再分发授权记录。`)
      }
    } catch (error) {
      fail(`公开发布证据 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  logger.log('MediaToolbox public release preflight')
  for (const message of successes) logger.log(`[OK] ${message}`)
  for (const message of failures) logger.error(`[FAIL] ${message}`)
  if (failures.length > 0) {
    logger.error('公开发布预检失败；内部候选构建不受影响。')
  } else {
    logger.log('公开发布预检通过。')
  }

  return { ok: failures.length === 0, failures, successes }
}

const executedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (executedDirectly) {
  const result = runPublicReleasePreflight()
  if (!result.ok) process.exitCode = 1
}
