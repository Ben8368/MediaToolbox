/** 模拟异步延迟 */
export const delay = (ms = 180) => new Promise((resolve) => window.setTimeout(resolve, ms))

/** 当前 Unix 秒级时间戳 */
export const nowSeconds = () => Math.floor(Date.now() / 1000)

/** 生成短随机 ID */
export const randomId = () => Math.random().toString(36).slice(2, 9)

/** ISO 时间偏移（分钟前） */
export function isoOffset(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString()
}

/** 网络速率格式化 */
export function formatSpeed(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB/s`
  if (bytes > 1024) return `${Math.round(bytes / 1024)} KB/s`
  return `${Math.round(bytes)} B/s`
}

/** 路径归一化（反斜杠→正斜杠、合并连续斜杠、去尾斜杠） */
export function normalizePath(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
  return normalized.startsWith('/') ? normalized || '/Workspace' : `/${normalized}`
}

/** 取父目录路径 */
export function parentPath(path: string) {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  if (index <= 0) return ''
  return normalized.slice(0, index)
}

/** 从路径推导目录/文件条目 */
export function entryFromPath(path: string, type: 'directory' | 'file') {
  const name = path.split('/').filter(Boolean).pop() || path
  return { name, path, type, size: 0, modified: isoOffset(45) }
}

/** 生成模拟服务状态对象 */
export function service(id: string, name: string) {
  return {
    id,
    name,
    online: true,
    status: 'ready',
    runtime_status: 'online',
    availability_status: 'ready',
    detail: 'Demo 模式：模拟服务已连接',
    dep: null,
  }
}
