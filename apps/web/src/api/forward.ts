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
export const analyzeDownloadStrategy = forwardMethod('analyzeDownloadStrategy')
export const getActiveTasks = forwardMethod('getActiveTasks')
export const getWeeklyHistory = forwardMethod('getWeeklyHistory')
export const cancelTask = forwardMethod('cancelTask')
export const deleteTaskRecord = forwardMethod('deleteTaskRecord')
export const clearTaskRecords = forwardMethod('clearTaskRecords')
export const getFetchTaskFileUrl = forwardMethod('getFetchTaskFileUrl')

export const listJobs = forwardMethod('listJobs')
export const getJob = forwardMethod('getJob')
export const fetchAssets = forwardMethod('fetchAssets')
export const submitTranscodeJob = forwardMethod('submitTranscodeJob')
export const cancelJob = forwardMethod('cancelJob')
export const scanPsd = forwardMethod('scanPsd')
export const getWorkOrder = forwardMethod('getWorkOrder')
export const updateWorkOrder = forwardMethod('updateWorkOrder')
export const applyWorkOrder = forwardMethod('applyWorkOrder')
export const submitWebComposerPng = forwardMethod('submitWebComposerPng')
export const submitWebComposerVideo = forwardMethod('submitWebComposerVideo')

export const probeTranscodeSource = forwardMethod('probeTranscodeSource')
export const previewTranscodeCommand = forwardMethod('previewTranscodeCommand')

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
export const uploadFilebrowserFile = forwardMethod('uploadFilebrowserFile')
export const filebrowserFileDownloadUrl = forwardMethod('filebrowserFileDownloadUrl')

export const getSystemMetrics = forwardMethod('getSystemMetrics')
export const fetchSystemRuntimeMetrics = forwardMethod('fetchSystemRuntimeMetrics')
export const shutdownSystem = forwardMethod('shutdownSystem')

export const fetchLogs = forwardMethod('fetchLogs')
export const fetchLogMetadata = forwardMethod('fetchLogMetadata')
export const clearLogs = forwardMethod('clearLogs')
export const getUnreadNotificationCount = forwardMethod('getUnreadNotificationCount')
export const fetchNotifications = forwardMethod('fetchNotifications')
export const clearNotifications = forwardMethod('clearNotifications')
export const markAllNotificationsAsRead = forwardMethod('markAllNotificationsAsRead')
