import { useCallback, useState } from 'react'

import { requestReadGrant, requestWriteGrant } from '@/api/real/pathGrants'

/**
 * 管理"从外部导入只读文件"这一交互：申请 read grant、把展示路径切成占位文案、
 * 用户手动改路径或点击清除时归还 fallbackPath。PsdApp 和 TranscodeApp 共用同一套交互。
 */
export function useExternalReadGrant(fallbackPath: string) {
  const [grantId, setGrantId] = useState<string | null>(null)
  const [displayPath, setDisplayPath] = useState(fallbackPath)

  const importExternal = useCallback(async () => {
    const grant = await requestReadGrant()
    if (!grant) return
    setGrantId(grant.id)
    setDisplayPath(`[外部文件] ${grant.displayName}`)
  }, [])

  const clearGrant = useCallback(() => {
    setGrantId(null)
    setDisplayPath(fallbackPath)
  }, [fallbackPath])

  return { grantId, displayPath, setDisplayPath, importExternal, clearGrant }
}

/** 管理"选择工作区外写入路径"这一交互：申请 write grant，供 PsdApp 和 TranscodeApp 共用。 */
export function useExternalWriteGrant() {
  const [grantId, setGrantId] = useState<string | null>(null)

  const selectOutputPath = useCallback(async (defaultPath?: string) => {
    const grant = await requestWriteGrant(defaultPath)
    if (!grant) return
    setGrantId(grant.id)
  }, [])

  const clearGrant = useCallback(() => setGrantId(null), [])

  return { grantId, selectOutputPath, clearGrant }
}
