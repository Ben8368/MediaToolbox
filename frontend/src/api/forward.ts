import { getApiClient } from './client'
import type { MediaToolboxApi } from './types'

function forwardMethod<K extends keyof MediaToolboxApi>(method: K): MediaToolboxApi[K] {
  const bound = (...args: unknown[]) => {
    const fn = getApiClient()[method] as (...innerArgs: unknown[]) => unknown
    return fn(...args)
  }
  return bound as MediaToolboxApi[K]
}

export const submitFetch = forwardMethod('submitFetch')
export const getActiveTasks = forwardMethod('getActiveTasks')
export const getWeeklyHistory = forwardMethod('getWeeklyHistory')
export const cancelTask = forwardMethod('cancelTask')
export const deleteTaskRecord = forwardMethod('deleteTaskRecord')
export const clearTaskRecords = forwardMethod('clearTaskRecords')
export const getFetchTaskFileUrl = forwardMethod('getFetchTaskFileUrl')

export const getWorkspace = forwardMethod('getWorkspace')
export const fetchFilebrowserDisks = forwardMethod('fetchFilebrowserDisks')
export const listFilebrowserDirectory = forwardMethod('listFilebrowserDirectory')
export const createFilebrowserDirectory = forwardMethod('createFilebrowserDirectory')
export const deleteFilebrowserPath = forwardMethod('deleteFilebrowserPath')
export const fetchFilebrowserTrash = forwardMethod('fetchFilebrowserTrash')
export const restoreFilebrowserTrash = forwardMethod('restoreFilebrowserTrash')
export const purgeFilebrowserTrash = forwardMethod('purgeFilebrowserTrash')
export const emptyFilebrowserTrash = forwardMethod('emptyFilebrowserTrash')
export const setWorkspace = forwardMethod('setWorkspace')

export const getSystemMetrics = forwardMethod('getSystemMetrics')
export const fetchSystemRuntimeMetrics = forwardMethod('fetchSystemRuntimeMetrics')
export const shutdownSystem = forwardMethod('shutdownSystem')

export const fetchLogs = forwardMethod('fetchLogs')
export const fetchLogMetadata = forwardMethod('fetchLogMetadata')
export const clearLogs = forwardMethod('clearLogs')
export const getUnreadNotificationCount = forwardMethod('getUnreadNotificationCount')
export const clearNotifications = forwardMethod('clearNotifications')
export const markAllNotificationsAsRead = forwardMethod('markAllNotificationsAsRead')
