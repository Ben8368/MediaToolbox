export type ApiRuntimeMode = 'contract'

type WindowStatusTone = 'online' | 'offline' | 'pending'

export type ApiRuntimePresentation = {
  mode: ApiRuntimeMode
  isReal: boolean
  modeLabel: string
  serviceBadge: string
  taskSubmitEndpoint: string
  windowStatus: {
    tone: WindowStatusTone
    label: string
    detail: string
  }
  shutdown: {
    confirm: string
    fallbackError: string
    completeTitle: string
    completeBody: string
  }
  settings: {
    initialNotice: string
    accountNotice: string
    serviceNotice: string
    toolbarDescription: string
    workspaceDescription: string
    behaviorTitle: string
    updateNotice: string
    connectionNotice: string
  }
  logsDescription: string
}

export function getApiRuntimeMode(): ApiRuntimeMode {
  return 'contract'
}

export function isRealApiRuntime(): boolean {
  return false
}

export function getApiRuntimePresentation(): ApiRuntimePresentation {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.trim() || 'same-origin /api'

  return {
    mode: 'contract',
    isReal: false,
    modeLabel: '本地 API 契约模式',
    serviceBadge: '骨架联调已启用',
    taskSubmitEndpoint: 'POST /api/fetch/tasks',
    windowStatus: {
      tone: 'online',
      label: 'HTTP API',
      detail: `此窗口通过 ${apiBase} 访问本地 API 骨架契约。`,
    },
    shutdown: {
      confirm: '将向本地 API 发送关闭请求。确定继续？',
      fallbackError: '关闭请求失败，请检查本地 API 服务状态。',
      completeTitle: '关闭请求已发送',
      completeBody: '本地 API 已接受关闭请求。当前仍处于骨架联调阶段，若前端页面保持打开，可以返回桌面继续查看状态。',
    },
    settings: {
      initialNotice: '本地 API 契约模式：本页偏好暂存浏览器，真实执行器和服务配置以后端接口为准。',
      accountNotice: '账户设置入口已预留，需后端身份接口接入后启用。',
      serviceNotice: `服务配置将通过 ${apiBase} 对接。`,
      toolbarDescription: '当前启用本地 API 骨架契约；系统设置仍保留前端偏好项。',
      workspaceDescription: '文件管理器和目录选择器将通过本地 API 请求路径数据；本页输入不会绕过后端安全边界。',
      behaviorTitle: '服务状态',
      updateNotice: '更新检查接口暂未接入。',
      connectionNotice: `本地 API 契约模式已启用：${apiBase}`,
    },
    logsDescription: '查看本地 API 骨架返回的任务事件、通知和服务日志。',
  }
}
