import type { FetchTaskRecord } from '@mediatoolbox/contracts'

import type { ApiState } from './state.js'

export function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

export function formatLogTime(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export function addLog(state: ApiState, level: string, module: string, message: string) {
  state.logs.unshift({ level, module, time: formatLogTime(), user: 'api', event: message, message })
}

export function isTerminalTask(task: FetchTaskRecord) {
  return ['completed', 'failed', 'cancelled', 'paused', 'partial'].includes(task.status)
}

export function entryName(path: string) {
  return path.split('/').filter(Boolean).pop() || path
}
